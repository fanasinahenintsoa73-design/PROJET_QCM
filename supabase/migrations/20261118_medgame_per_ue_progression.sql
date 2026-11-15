-- ============================================================================
-- MEDGAME — une planche par UE, tirage aléatoire de 5 questions par tentative
-- 18 novembre 2026
-- ============================================================================
-- Le moteur MEDGAME passe d'un parcours unique par étudiant à une planche
-- par UE : plusieurs UE peuvent être ouvertes en parallèle.
--
--   - une seule planche ACTIVE par (étudiant, UE) ;
--   - une seule run ACTIVE par planche (plus une par étudiant) ;
--   - à chaque tentative de niveau, 5 questions sont tirées au hasard dans
--     la banque de la planche et mémorisées dans medgame_runs.question_ids :
--     la correction porte exactement sur les questions affichées.
--
-- medgame_overview() et medgame_create_progress() renvoient désormais
-- { "boards": [...], "quota": {...} } : une planche par UE choisie.
--
-- Les questions renvoyées au client ne contiennent JAMAIS correctAnswers ni
-- explanation : aucune réponse ne peut fuiter avant la correction.
-- ============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. Schéma : une planche active par UE, une run active par planche
-- ---------------------------------------------------------------------------

-- L'ancien index imposait un seul parcours actif par étudiant.
drop index if exists public.medgame_progress_one_active;

create unique index if not exists medgame_progress_one_active_per_ue
  on public.medgame_progress (user_id, ue_id)
  where status = 'active';

-- L'ancien index imposait une seule run active par étudiant.
drop index if exists public.medgame_runs_one_active;

create unique index if not exists medgame_runs_one_active_per_progress
  on public.medgame_runs (user_id, progress_id)
  where status = 'in_progress';

-- Les 5 questions tirées pour le niveau en cours.
alter table public.medgame_runs
  add column if not exists question_ids uuid[];

-- Colonne de tri des planches (déjà présente sur les bases migrées).
alter table public.medgame_progress
  add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 2. Sérialisation JSON (mêmes clés que les types TypeScript)
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
    'updatedAt', p.updated_at,
    'levelStars', coalesce(p.level_stars, '{}'::jsonb)
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
    'questionIds', to_jsonb(r.question_ids),
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
          end,
        'bestStars', coalesce(
          (coalesce(p.level_stars, '{}'::jsonb) ->> l::text)::int,
          0
        )
      )
      order by l
    ),
    '[]'::jsonb
  )
  from generate_series(1, p.level_count) as l;
$$;

-- Questions à partir d'une liste d'identifiants : jamais de correctAnswers,
-- jamais d'explication (le client ne voit que l'énoncé et les propositions).
create or replace function public.medgame_questions_by_ids(p_ids uuid[])
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
    from unnest(coalesce(p_ids, '{}'::uuid[])) with ordinality as t(qid, ordinality)
  ) qids
  join public.questions q on q.id = qids.qid;
$$;

-- Tranche historique d'un niveau (repli quand la run n'a pas de tirage).
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
  select public.medgame_questions_by_ids(
    coalesce(
      p.question_ids[((p_level - 1) * 5 + 1):(p_level * 5)],
      '{}'::uuid[]
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Vue d'ensemble : une planche par UE
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
  v_boards jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  perform public.medgame_sweep();

  for v_progress in
    select *
    from public.medgame_progress
    where user_id = auth.uid()
      and status = 'active'
    order by updated_at desc, created_at desc, id desc
  loop
    select *
    into v_run
    from public.medgame_runs
    where user_id = auth.uid()
      and progress_id = v_progress.id
      and status = 'in_progress'
    order by seq desc
    limit 1;

    v_boards := v_boards || jsonb_build_array(
      jsonb_build_object(
        'progress', public.medgame_progress_json(v_progress),
        'run', case
          when v_run.id is not null then public.medgame_run_json(v_run)
          else null
        end,
        'levels', public.medgame_levels_json(v_progress)
      )
    );
  end loop;

  return jsonb_build_object(
    'boards', v_boards,
    'quota', public.medgame_quota_json()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Création d'une planche (une UE)
-- ---------------------------------------------------------------------------

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
  v_current public.medgame_progress%rowtype;
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

  -- La planche active de CETTE UE (les autres UE ne sont pas touchées).
  select *
  into v_current
  from public.medgame_progress
  where user_id = auth.uid()
    and ue_id = p_ue_id
    and status = 'active'
  order by updated_at desc
  limit 1;

  -- Une partie est déjà en cours sur cette planche : il faut la terminer.
  if v_current.id is not null and exists (
    select 1
    from public.medgame_runs r
    where r.user_id = auth.uid()
      and r.progress_id = v_current.id
      and r.status = 'in_progress'
  ) then
    raise exception 'MEDGAME_RUN_ACTIVE' using errcode = 'P0001';
  end if;

  -- Seule la planche de CETTE UE est archivée.
  update public.medgame_progress
  set status = 'archived', updated_at = now()
  where user_id = auth.uid()
    and ue_id = p_ue_id
    and status = 'active';

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

-- ---------------------------------------------------------------------------
-- 5. Démarrage d'une run sur une planche
-- ---------------------------------------------------------------------------

-- L'ancienne signature (sans paramètre) est remplacée : une run appartient
-- désormais à une planche précise.
drop function if exists public.medgame_start_run();

create or replace function public.medgame_start_run(p_progress_id uuid)
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
  v_draw uuid[];
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not public.has_active_access() then
    raise exception 'ACCESS_EXPIRED' using errcode = 'P0001';
  end if;

  perform public.medgame_sweep();

  -- Une run est déjà en cours sur cette planche : on la reprend.
  select *
  into v_run
  from public.medgame_runs
  where user_id = auth.uid()
    and progress_id = p_progress_id
    and status = 'in_progress'
  order by seq desc
  limit 1;

  if found then
    return public.medgame_run_state(v_run.id);
  end if;

  select *
  into v_progress
  from public.medgame_progress
  where id = p_progress_id
    and user_id = auth.uid()
    and status = 'active';

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

  -- Tirage aléatoire de 5 questions dans la banque de la planche.
  -- La table fonction est placée dans le FROM : le tri se fait bien sur les
  -- 39 lignes de la banque (random() évalué par ligne), et non sur une
  -- unique ligne avant expansion de unnest (tirage alors déterministe).
  select array_agg(qid)
  into v_draw
  from (
    select qid
    from unnest(v_progress.question_ids) with ordinality as x(qid, ord)
    order by random()
    limit 5
  ) s;

  insert into public.medgame_runs (
    progress_id, user_id, status, current_level, question_ids,
    started_at, last_activity_at, resumed_from_run_id
  ) values (
    v_progress.id,
    auth.uid(),
    'in_progress',
    v_progress.current_level,
    v_draw,
    now(),
    now(),
    case when v_latest.status = 'abandoned' then v_latest.id else null end
  )
  returning id into v_run_id;

  -- Reprise après abandon : la série est consommée tout de suite.
  if v_latest.status = 'abandoned' then
    perform public.medgame_consume(v_run_id, 'resume_after_abandonment');
  end if;

  return public.medgame_run_state(v_run_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. État d'une run : les questions tirées, jamais les réponses
-- ---------------------------------------------------------------------------

create or replace function public.medgame_run_state(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.medgame_runs%rowtype;
  v_progress public.medgame_progress%rowtype;
  v_ids uuid[];
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

  -- Les questions du niveau en cours : le tirage de la run, ou à défaut la
  -- tranche historique du niveau dans la banque de la planche.
  v_ids := coalesce(v_run.question_ids, '{}'::uuid[]);

  if cardinality(v_ids) = 0 then
    v_ids := coalesce(
      v_progress.question_ids[((v_run.current_level - 1) * 5 + 1):(v_run.current_level * 5)],
      '{}'::uuid[]
    );
  end if;

  return jsonb_build_object(
    'run', public.medgame_run_json(v_run),
    'progress', public.medgame_progress_json(v_progress),
    'questions', public.medgame_questions_by_ids(v_ids),
    'levels', public.medgame_levels_json(v_progress),
    'quota', public.medgame_quota_json()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Correction d'un niveau : exactement les questions tirées
-- ---------------------------------------------------------------------------

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
  v_ids uuid[];
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

  -- Correction des questions tirées pour ce niveau (repli : tranche
  -- historique du niveau dans la banque de la planche).
  v_ids := coalesce(v_run.question_ids, '{}'::uuid[]);

  if cardinality(v_ids) = 0 then
    v_ids := coalesce(
      v_progress.question_ids[((v_level - 1) * 5 + 1):(v_level * 5)],
      '{}'::uuid[]
    );
  end if;

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
      from unnest(v_ids) with ordinality as t(qid, ordinality)
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
    -- Les étoiles du niveau sont conservées au mieux : un échec plus tard ne
    -- doit pas effacer le score déjà obtenu sur ce niveau.
    update public.medgame_progress
    set level_stars = jsonb_set(
          coalesce(level_stars, '{}'::jsonb),
          ARRAY[v_level::text],
          to_jsonb(
            greatest(
              coalesce((level_stars ->> v_level::text)::int, 0),
              v_correct
            )
          ),
          true
        )
    where id = v_progress.id;

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

-- ---------------------------------------------------------------------------
-- 8. Droits RPC
-- ---------------------------------------------------------------------------

revoke all on function public.medgame_progress_json(public.medgame_progress) from public, anon;
revoke all on function public.medgame_run_json(public.medgame_runs) from public, anon;
revoke all on function public.medgame_levels_json(public.medgame_progress) from public, anon;
revoke all on function public.medgame_questions_json(public.medgame_progress, integer) from public, anon;
revoke all on function public.medgame_questions_by_ids(uuid[]) from public, anon;
revoke all on function public.medgame_overview() from public, anon;
revoke all on function public.medgame_create_progress(text, text[]) from public, anon;
revoke all on function public.medgame_start_run(uuid) from public, anon;
revoke all on function public.medgame_run_state(uuid) from public, anon;
revoke all on function public.medgame_submit_level(uuid, jsonb) from public, anon;

grant execute on function public.medgame_overview() to authenticated;
grant execute on function public.medgame_create_progress(text, text[]) to authenticated;
grant execute on function public.medgame_start_run(uuid) to authenticated;
grant execute on function public.medgame_run_state(uuid) to authenticated;
grant execute on function public.medgame_submit_level(uuid, jsonb) to authenticated;
grant execute on function public.medgame_progress_json(public.medgame_progress) to authenticated;
grant execute on function public.medgame_run_json(public.medgame_runs) to authenticated;
grant execute on function public.medgame_levels_json(public.medgame_progress) to authenticated;
grant execute on function public.medgame_questions_json(public.medgame_progress, integer) to authenticated;
grant execute on function public.medgame_questions_by_ids(uuid[]) to authenticated;
