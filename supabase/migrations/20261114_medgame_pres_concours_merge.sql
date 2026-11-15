-- ============================================================================
-- MEDGAME + PRES CONCOURS — fusion des parcours et quota partagé
-- 14 novembre 2026
-- ============================================================================
-- Un seul ticket étudiant, 30 séries partagées entre Pres Concours et MEDGAME.
-- Pres Concours consomme toujours à l'ouverture d'une série (comportement
-- existant). MEDGAME consomme à la fin d'une run (échec ou réussite), à
-- l'abandon, et à la reprise après abandon.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Tables MEDGAME
-- ---------------------------------------------------------------------------

create table if not exists public.medgame_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  ticket_code text,
  ue_id text not null,
  chapter_ids text[] not null default '{}',
  question_ids uuid[] not null default '{}',
  level_count integer not null check (level_count > 0),
  current_level integer not null default 1 check (current_level > 0),
  status text not null default 'active'
    check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medgame_progress_user_idx
  on public.medgame_progress (user_id, status, updated_at desc);

create unique index if not exists medgame_progress_one_active
  on public.medgame_progress (user_id)
  where status = 'active';

create table if not exists public.medgame_runs (
  id uuid primary key default gen_random_uuid(),
  progress_id uuid not null references public.medgame_progress (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'failed', 'completed', 'abandoned')),
  current_level integer not null default 1 check (current_level > 0),
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  ended_at timestamptz,
  consumed_at timestamptz,
  consumed_reason text,
  resumed_from_run_id uuid,
  -- Compteur monotone : deux runs lancés dans la même transaction partagent
  -- le même started_at (now() = début de transaction), le séquence garantit
  -- un ordre stable pour retrouver la run la plus récente.
  seq bigserial
);

-- Le même ajout est nécessaire sur une base déjà migrée.
alter table public.medgame_runs
  add column if not exists seq bigserial;

create index if not exists medgame_runs_user_idx
  on public.medgame_runs (user_id, status, started_at desc);
create index if not exists medgame_runs_progress_idx
  on public.medgame_runs (progress_id, seq desc);
create unique index if not exists medgame_runs_one_active
  on public.medgame_runs (user_id)
  where status = 'in_progress';

create table if not exists public.series_consumptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  ticket_code text,
  run_id uuid references public.medgame_runs (id) on delete set null,
  reason text not null
    check (reason in ('failure', 'completion', 'abandonment', 'resume_after_abandonment')),
  created_at timestamptz not null default now()
);

create index if not exists series_consumptions_user_idx
  on public.series_consumptions (user_id, created_at desc);
create unique index if not exists series_consumptions_run_unique
  on public.series_consumptions (run_id)
  where run_id is not null;

create table if not exists public.medgame_run_answers (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.medgame_runs (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  given text[] not null default '{}',
  is_correct boolean not null default false,
  answered_at timestamptz not null default now(),
  unique (run_id, question_id)
);

create index if not exists medgame_run_answers_run_idx
  on public.medgame_run_answers (run_id);

-- ---------------------------------------------------------------------------
-- 2. Contenus : supports de cours et sujets concours
-- ---------------------------------------------------------------------------

create table if not exists public.course_supports (
  id uuid primary key default gen_random_uuid(),
  ue_id text not null,
  chapter_id text not null,
  title text not null,
  description text not null default '',
  storage_path text not null,
  mime_type text not null default 'application/pdf',
  file_name text not null,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists course_supports_ue_chapter_idx
  on public.course_supports (ue_id, chapter_id, created_at desc);

create table if not exists public.exam_subjects (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2014 and 2026),
  ue_id text not null,
  title text not null,
  description text not null default '',
  storage_path text not null,
  mime_type text not null default 'application/pdf',
  file_name text not null,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists exam_subjects_year_ue_idx
  on public.exam_subjects (year desc, ue_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Quota partagé
-- ---------------------------------------------------------------------------

create or replace function public.medgame_quota_json()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_attempts integer;
  v_medgame integer;
  v_used integer;
begin
  select a.started_at
  into v_start
  from public.subject_assignments a
  where a.user_id = auth.uid()
    and a.started_at <= now()
    and a.expires_at > now()
  order by a.started_at desc
  limit 1;

  select count(*)
  into v_attempts
  from public.attempts a
  where a.user_id = auth.uid()
    and (v_start is null or a.created_at >= v_start);

  select count(*)
  into v_medgame
  from public.series_consumptions s
  where s.user_id = auth.uid();

  v_used := v_attempts + v_medgame;

  return jsonb_build_object(
    'used', v_used,
    'limit', 30,
    'remaining', greatest(0, 30 - v_used),
    'reached', v_used >= 30
  );
end;
$$;

-- Le trigger bloque aussi les séries Pres Concours quand le quota partagé
-- est déjà consommé par MEDGAME, sans réécrire les RPC existantes.
create or replace function public.enforce_shared_series_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_used integer;
begin
  select a.started_at
  into v_start
  from public.subject_assignments a
  where a.user_id = new.user_id
    and a.started_at <= now()
    and a.expires_at > now()
  order by a.started_at desc
  limit 1;

  if v_start is null then
    return new;
  end if;

  select count(*)
  into v_used
  from public.attempts a
  where a.user_id = new.user_id
    and a.created_at >= v_start;

  select v_used + count(*)
  into v_used
  from public.series_consumptions s
  where s.user_id = new.user_id;

  if v_used >= 30 then
    raise exception 'SERIES_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_shared_series_quota on public.attempts;
create trigger enforce_shared_series_quota
  before insert on public.attempts
  for each row execute function public.enforce_shared_series_quota();

-- ---------------------------------------------------------------------------
-- 4. Sérialisation JSON (mêmes clés que les types TypeScript)
-- ---------------------------------------------------------------------------

create or replace function public.medgame_progress_json(p public.medgame_progress)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'studentId', p.user_id,
    'ticketId', p.ticket_code,
    'ueId', p.ue_id,
    'chapterIds', to_jsonb(p.chapter_ids),
    'questionIds', to_jsonb(p.question_ids),
    'levelCount', p.level_count,
    'currentLevel', p.current_level,
    'status', p.status,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at
  );
$$;

create or replace function public.medgame_run_json(r public.medgame_runs)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id,
    'progressId', r.progress_id,
    'studentId', r.user_id,
    'status', r.status,
    'currentLevel', r.current_level,
    'startedAt', r.started_at,
    'lastActivityAt', r.last_activity_at,
    'endedAt', r.ended_at,
    'consumedAt', r.consumed_at,
    'consumedReason', r.consumed_reason,
    'resumedFromRunId', r.resumed_from_run_id
  );
$$;

create or replace function public.medgame_levels_json(p public.medgame_progress)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'level', l,
        'totalLevels', p.level_count,
        'questionCount', greatest(
          0,
          least(5, cardinality(p.question_ids) - (l - 1) * 5)
        ),
        'status',
          case
            when p.status = 'completed' or l < p.current_level then 'passed'
            when l = p.current_level then 'unlocked'
            else 'locked'
          end
      )
      order by l
    ),
    '[]'::jsonb
  )
  from generate_series(1, p.level_count) as l;
$$;

create or replace function public.medgame_questions_json(
  p public.medgame_progress,
  p_level integer
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'subjectId', q.subject_id,
        'number', q.number,
        'matiere', q.matiere,
        'statement', q.statement,
        'options', q.options
      )
      order by qids.ordinality
    ),
    '[]'::jsonb
  )
  from (
    select qid, ordinality
    from unnest(
      p.question_ids[((p_level - 1) * 5 + 1):(p_level * 5)]
    ) with ordinality as t(qid, ordinality)
  ) qids
  join public.questions q on q.id = qids.qid;
$$;

-- ---------------------------------------------------------------------------
-- 5. Consommation d'une série (idempotente par run)
-- ---------------------------------------------------------------------------

create or replace function public.medgame_consume(
  p_run_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.medgame_runs%rowtype;
  v_ticket_code text;
begin
  select *
  into v_run
  from public.medgame_runs
  where id = p_run_id
    and user_id = auth.uid();

  if not found then
    return false;
  end if;

  if exists (
    select 1 from public.series_consumptions s where s.run_id = p_run_id
  ) then
    return false;
  end if;

  select t.code into v_ticket_code
  from public.tickets t
  where t.user_id = v_run.user_id
  limit 1;

  insert into public.series_consumptions (
    user_id, ticket_code, run_id, reason
  ) values (
    v_run.user_id, v_ticket_code, p_run_id, p_reason
  );

  update public.medgame_runs
  set consumed_at = now(),
      consumed_reason = p_reason
  where id = p_run_id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Balayage des runs sans heartbeat depuis deux minutes
-- ---------------------------------------------------------------------------

create or replace function public.medgame_sweep()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.medgame_runs%rowtype;
begin
  for v_run in
    select *
    from public.medgame_runs
    where user_id = auth.uid()
      and status = 'in_progress'
      and last_activity_at < now() - interval '2 minutes'
  loop
    update public.medgame_runs
    set status = 'abandoned',
        ended_at = now(),
        last_activity_at = now()
    where id = v_run.id;

    perform public.medgame_consume(v_run.id, 'abandonment');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC MEDGAME
-- ---------------------------------------------------------------------------

create or replace function public.medgame_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_progress public.medgame_progress%rowtype;
  v_run public.medgame_runs%rowtype;
  v_progress_json jsonb := 'null'::jsonb;
  v_run_json jsonb := 'null'::jsonb;
  v_levels jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  perform public.medgame_sweep();

  select *
  into v_run
  from public.medgame_runs
  where user_id = auth.uid()
    and status = 'in_progress'
  order by started_at desc
  limit 1;

  if found then
    select * into v_progress
    from public.medgame_progress
    where id = v_run.progress_id;
  else
    select * into v_progress
    from public.medgame_progress
    where user_id = auth.uid()
      and status = 'active'
    order by updated_at desc
    limit 1;
  end if;

  if v_progress.id is not null then
    v_progress_json := public.medgame_progress_json(v_progress);
    v_levels := public.medgame_levels_json(v_progress);
  end if;

  if v_run.id is not null then
    v_run_json := public.medgame_run_json(v_run);
  end if;

  return jsonb_build_object(
    'progress', v_progress_json,
    'run', v_run_json,
    'levels', v_levels,
    'quota', public.medgame_quota_json()
  );
end;
$$;

create or replace function public.medgame_create_progress(
  p_ue_id text,
  p_chapter_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_count integer;
  v_levels integer;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not public.has_active_access() then
    raise exception 'ACCESS_EXPIRED' using errcode = 'P0001';
  end if;

  if p_ue_id is null or btrim(p_ue_id) = ''
     or p_chapter_ids is null or cardinality(p_chapter_ids) = 0 then
    raise exception 'INVALID_CHAPTER' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.medgame_runs r
    where r.user_id = auth.uid() and r.status = 'in_progress'
  ) then
    raise exception 'MEDGAME_RUN_ACTIVE' using errcode = 'P0001';
  end if;

  update public.medgame_progress
  set status = 'archived', updated_at = now()
  where user_id = auth.uid() and status = 'active';

  with bank as (
    select distinct on (lower(btrim(q.statement))) q.id
    from public.questions q
    join public.subjects s on s.id = q.subject_id
    where s.archived = false
      and s.chapter_id = any (p_chapter_ids)
      and cardinality(q.correct_answers) = 1
    order by lower(btrim(q.statement)), random()
  )
  select array_agg(id order by random()), count(*)
  into v_ids, v_count
  from bank;

  if v_count = 0 or v_ids is null then
    raise exception 'MEDGAME_EMPTY_BANK' using errcode = 'P0001';
  end if;

  v_levels := ceil(v_count::numeric / 5.0)::integer;

  insert into public.medgame_progress (
    user_id, ticket_code, ue_id, chapter_ids, question_ids,
    level_count, current_level, status
  ) values (
    auth.uid(),
    (select t.code from public.tickets t where t.user_id = auth.uid() limit 1),
    p_ue_id,
    p_chapter_ids,
    v_ids,
    v_levels,
    1,
    'active'
  );

  return public.medgame_overview();
end;
$$;

create or replace function public.medgame_start_run()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_progress public.medgame_progress%rowtype;
  v_run public.medgame_runs%rowtype;
  v_latest public.medgame_runs%rowtype;
  v_run_id uuid;
  v_quota jsonb;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not public.has_active_access() then
    raise exception 'ACCESS_EXPIRED' using errcode = 'P0001';
  end if;

  perform public.medgame_sweep();

  select *
  into v_run
  from public.medgame_runs
  where user_id = auth.uid() and status = 'in_progress'
  order by started_at desc
  limit 1;

  if found then
    return public.medgame_run_state(v_run.id);
  end if;

  select *
  into v_progress
  from public.medgame_progress
  where user_id = auth.uid() and status = 'active'
  order by updated_at desc
  limit 1;

  if not found then
    raise exception 'MEDGAME_NO_PROGRESS' using errcode = 'P0001';
  end if;

  v_quota := public.medgame_quota_json();
  if (v_quota ->> 'reached')::boolean then
    raise exception 'SERIES_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  select *
  into v_latest
  from public.medgame_runs
  where progress_id = v_progress.id
  order by seq desc
  limit 1;

  insert into public.medgame_runs (
    progress_id, user_id, status, current_level,
    started_at, last_activity_at, resumed_from_run_id
  ) values (
    v_progress.id,
    auth.uid(),
    'in_progress',
    v_progress.current_level,
    now(),
    now(),
    case when v_latest.status = 'abandoned' then v_latest.id else null end
  )
  returning id into v_run_id;

  if v_latest.status = 'abandoned' then
    perform public.medgame_consume(v_run_id, 'resume_after_abandonment');
  end if;

  return public.medgame_run_state(v_run_id);
end;
$$;

create or replace function public.medgame_run_state(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.medgame_runs%rowtype;
  v_progress public.medgame_progress%rowtype;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select *
  into v_run
  from public.medgame_runs
  where id = p_run_id and user_id = auth.uid();

  if not found then
    raise exception 'MEDGAME_NOT_FOUND' using errcode = 'P0001';
  end if;

  select *
  into v_progress
  from public.medgame_progress
  where id = v_run.progress_id;

  if not found then
    raise exception 'MEDGAME_NOT_FOUND' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'run', public.medgame_run_json(v_run),
    'progress', public.medgame_progress_json(v_progress),
    'questions', public.medgame_questions_json(v_progress, v_run.current_level),
    'levels', public.medgame_levels_json(v_progress),
    'quota', public.medgame_quota_json()
  );
end;
$$;

create or replace function public.medgame_submit_level(
  p_run_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.medgame_runs%rowtype;
  v_progress public.medgame_progress%rowtype;
  v_level integer;
  v_answer jsonb;
  v_answers jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_correct integer := 0;
  v_passed boolean := false;
  v_completed boolean := false;
  v_failed boolean := false;
  v_consumed boolean := false;
  v_next integer;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select *
  into v_run
  from public.medgame_runs
  where id = p_run_id and user_id = auth.uid();

  if not found then
    raise exception 'MEDGAME_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_run.status <> 'in_progress' then
    raise exception 'MEDGAME_CLOSED' using errcode = 'P0001';
  end if;

  select *
  into v_progress
  from public.medgame_progress
  where id = v_run.progress_id;

  if not found then
    raise exception 'MEDGAME_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_level := v_run.current_level;

  for v_answer in
    select jsonb_build_object(
      'questionId', q.id,
      'given', coalesce(g.given, '{}'::text[]),
      'correctAnswers', to_jsonb(q.correct_answers),
      'explanation', coalesce(q.explanation, ''),
      'correct', coalesce(g.given, '{}'::text[]) = q.correct_answers
    )
    from (
      select qid, ordinality
      from unnest(
        v_progress.question_ids[((v_level - 1) * 5 + 1):(v_level * 5)]
      ) with ordinality as t(qid, ordinality)
    ) qids
    join public.questions q on q.id = qids.qid
    left join (
      select (elem ->> 'questionId')::uuid as qid,
             array(
               select jsonb_array_elements_text(elem -> 'given')
             ) as given
      from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) elem
    ) g on g.qid = q.id
    order by qids.ordinality
  loop
    v_answers := v_answers || jsonb_build_array(v_answer);
    v_total := v_total + 1;
    if (v_answer ->> 'correct')::boolean then
      v_correct := v_correct + 1;
    end if;

    insert into public.medgame_run_answers (
      run_id, question_id, given, is_correct
    ) values (
      p_run_id,
      (v_answer ->> 'questionId')::uuid,
      array(
        select jsonb_array_elements_text(v_answer -> 'given')
      ),
      (v_answer ->> 'correct')::boolean
    )
    on conflict (run_id, question_id) do update
      set given = excluded.given,
          is_correct = excluded.is_correct,
          answered_at = now();
  end loop;

  if v_total = 0 then
    raise exception 'MEDGAME_EMPTY_LEVEL' using errcode = 'P0001';
  end if;

  v_passed := v_correct = v_total;

  if v_passed then
    if v_level >= v_progress.level_count then
      v_completed := true;
      v_next := null;

      update public.medgame_runs
      set status = 'completed', ended_at = now(), last_activity_at = now()
      where id = p_run_id;

      update public.medgame_progress
      set status = 'completed',
          current_level = v_progress.level_count + 1,
          updated_at = now()
      where id = v_progress.id;

      v_consumed := public.medgame_consume(p_run_id, 'completion');
    else
      v_next := v_level + 1;

      update public.medgame_runs
      set current_level = v_next, last_activity_at = now()
      where id = p_run_id;

      update public.medgame_progress
      set current_level = v_next, updated_at = now()
      where id = v_progress.id;
    end if;
  else
    v_failed := true;
    v_next := v_level;

    update public.medgame_runs
    set status = 'failed', ended_at = now(), last_activity_at = now()
    where id = p_run_id;

    update public.medgame_progress
    set current_level = v_level, updated_at = now()
    where id = v_progress.id;

    v_consumed := public.medgame_consume(p_run_id, 'failure');
  end if;

  return jsonb_build_object(
    'runId', p_run_id,
    'level', v_level,
    'correct', v_correct,
    'total', v_total,
    'stars', v_correct,
    'passed', v_passed,
    'completed', v_completed,
    'failed', v_failed,
    'nextLevel', v_next,
    'answers', v_answers,
    'consumed', v_consumed,
    'quota', public.medgame_quota_json()
  );
end;
$$;

create or replace function public.medgame_heartbeat(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.medgame_runs
  set last_activity_at = now()
  where id = p_run_id
    and user_id = auth.uid()
    and status = 'in_progress';
end;
$$;

create or replace function public.medgame_abandon(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.medgame_runs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select *
  into v_run
  from public.medgame_runs
  where id = p_run_id and user_id = auth.uid();

  if not found or v_run.status <> 'in_progress' then
    return;
  end if;

  update public.medgame_runs
  set status = 'abandoned',
      ended_at = now(),
      last_activity_at = now()
  where id = p_run_id;

  perform public.medgame_consume(p_run_id, 'abandonment');
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------------

alter table public.medgame_progress enable row level security;
alter table public.medgame_runs enable row level security;
alter table public.series_consumptions enable row level security;
alter table public.medgame_run_answers enable row level security;
alter table public.course_supports enable row level security;
alter table public.exam_subjects enable row level security;

drop policy if exists "medgame_progress_select_own" on public.medgame_progress;
create policy "medgame_progress_select_own"
  on public.medgame_progress for select
  to authenticated
  using (user_id = auth.uid() or public.is_professor());

drop policy if exists "medgame_runs_select_own" on public.medgame_runs;
create policy "medgame_runs_select_own"
  on public.medgame_runs for select
  to authenticated
  using (user_id = auth.uid() or public.is_professor());

drop policy if exists "series_consumptions_select_own" on public.series_consumptions;
create policy "series_consumptions_select_own"
  on public.series_consumptions for select
  to authenticated
  using (user_id = auth.uid() or public.is_professor());

drop policy if exists "medgame_run_answers_select_own" on public.medgame_run_answers;
create policy "medgame_run_answers_select_own"
  on public.medgame_run_answers for select
  to authenticated
  using (
    public.is_professor()
    or exists (
      select 1 from public.medgame_runs r
      where r.id = medgame_run_answers.run_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "course_supports_read" on public.course_supports;
create policy "course_supports_read"
  on public.course_supports for select
  to authenticated
  using (true);

drop policy if exists "course_supports_professor_write" on public.course_supports;
create policy "course_supports_professor_write"
  on public.course_supports for all
  to authenticated
  using (public.is_professor())
  with check (public.is_professor());

drop policy if exists "exam_subjects_read" on public.exam_subjects;
create policy "exam_subjects_read"
  on public.exam_subjects for select
  to authenticated
  using (true);

drop policy if exists "exam_subjects_professor_write" on public.exam_subjects;
create policy "exam_subjects_professor_write"
  on public.exam_subjects for all
  to authenticated
  using (public.is_professor())
  with check (public.is_professor());

grant select on public.medgame_progress to authenticated;
grant select on public.medgame_runs to authenticated;
grant select on public.series_consumptions to authenticated;
grant select on public.medgame_run_answers to authenticated;
grant select, insert, update, delete on public.course_supports to authenticated;
grant select, insert, update, delete on public.exam_subjects to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Stockage privé des contenus
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('course-content', 'course-content', false)
on conflict (id) do nothing;

drop policy if exists "course_content_read" on storage.objects;
create policy "course_content_read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'course-content');

drop policy if exists "course_content_professor_write" on storage.objects;
create policy "course_content_professor_write"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'course-content' and public.is_professor())
  with check (bucket_id = 'course-content' and public.is_professor());

-- ---------------------------------------------------------------------------
-- 10. Droits RPC
-- ---------------------------------------------------------------------------

revoke all on function public.medgame_quota_json() from public, anon;
revoke all on function public.enforce_shared_series_quota() from public, anon;
revoke all on function public.medgame_progress_json(public.medgame_progress) from public, anon;
revoke all on function public.medgame_run_json(public.medgame_runs) from public, anon;
revoke all on function public.medgame_levels_json(public.medgame_progress) from public, anon;
revoke all on function public.medgame_questions_json(public.medgame_progress, integer) from public, anon;
revoke all on function public.medgame_consume(uuid, text) from public, anon;
revoke all on function public.medgame_sweep() from public, anon;
revoke all on function public.medgame_overview() from public, anon;
revoke all on function public.medgame_create_progress(text, text[]) from public, anon;
revoke all on function public.medgame_start_run() from public, anon;
revoke all on function public.medgame_run_state(uuid) from public, anon;
revoke all on function public.medgame_submit_level(uuid, jsonb) from public, anon;
revoke all on function public.medgame_heartbeat(uuid) from public, anon;
revoke all on function public.medgame_abandon(uuid) from public, anon;

grant execute on function public.medgame_quota_json() to authenticated;
grant execute on function public.medgame_overview() to authenticated;
grant execute on function public.medgame_create_progress(text, text[]) to authenticated;
grant execute on function public.medgame_start_run() to authenticated;
grant execute on function public.medgame_run_state(uuid) to authenticated;
grant execute on function public.medgame_submit_level(uuid, jsonb) to authenticated;
grant execute on function public.medgame_heartbeat(uuid) to authenticated;
grant execute on function public.medgame_abandon(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Compteur de séries partagé côté docteur
-- ---------------------------------------------------------------------------
-- 'series_used' additionne les séries Pres Concours et les séries consommées
-- par MEDGAME : c'est le même quota de 30 séries pour l'étudiant.

drop function if exists public.list_tickets();

create function public.list_tickets()
returns table (
  code text,
  status text,
  series_used integer,
  created_at timestamptz,
  used_at timestamptz,
  last_login_at timestamptz,
  secret text,
  type text,
  expires_at timestamptz,
  anki_chapters integer,
  anki_completed integer,
  archived_at timestamptz,
  last_activity_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'professor'
  ) then
    raise exception 'Réservé au docteur.';
  end if;

  return query
    select t.code, t.status,
      (
        (select count(*)::integer from public.attempts a where a.user_id = t.user_id)
        + (select count(*)::integer from public.series_consumptions s where s.user_id = t.user_id)
      ) as series_used,
      t.created_at, t.used_at, t.last_login_at,
      (select s.secret from public.ticket_secrets s where s.code = t.code) as secret,
      t.type, t.expires_at,
      (select count(*)::integer from public.anki_ticket_chapters c where c.ticket_code = t.code) as anki_chapters,
      (select count(*)::integer from public.anki_chapter_progress p
        where p.ticket_code = t.code and p.completed_at is not null) as anki_completed,
      t.archived_at,
      greatest(
        t.last_login_at,
        t.used_at,
        t.created_at,
        (select max(a.created_at) from public.attempts a where a.user_id = t.user_id),
        (select max(s.created_at) from public.series_consumptions s where s.user_id = t.user_id),
        (select max(h.created_at) from public.anki_history h where h.ticket_code = t.code)
      ) as last_activity_at
    from public.tickets t
    order by t.code;
end;
$$;

revoke all on function public.list_tickets() from public;
grant execute on function public.list_tickets() to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Migration des données : ticket unique et archivage de l'ancien Anki
-- ---------------------------------------------------------------------------

-- 10.1 : les anciens tickets Anki deviennent le ticket unique (30 séries
-- partagées Pres Concours + MEDGAME) et n'expirent plus. Les tickets 30 séries
-- existants sont inchangés.
update public.tickets
set type = 'series',
    expires_at = null
where type = 'anki';

-- 10.3 : l'ancienne progression Anki est archivée. Les tables et les lignes
-- sont conservées pendant la période de transition (cf. 10.5) ; seul un
-- marqueur d'archivage est ajouté.
alter table public.anki_history
  add column if not exists archived_at timestamptz;
alter table public.anki_question_progress
  add column if not exists archived_at timestamptz;

update public.anki_history
set archived_at = coalesce(archived_at, now())
where archived_at is null;

update public.anki_question_progress
set archived_at = coalesce(archived_at, now())
where archived_at is null;
