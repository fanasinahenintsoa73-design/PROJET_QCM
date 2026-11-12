-- MEDGAME : le chapitre devient une trajectoire de niveaux de 5 questions.
-- 12 novembre 2026
--
-- Règles :
--   * nombre de niveaux = ceil(nb_questions / 5)
--   * niveau 1 ouvert, niveau N+1 ouvert si le niveau N est réussi (5/5)
--   * une tentative = 5 questions tirées au hasard dans tout le chapitre
--   * 1 étoile par bonne réponse, meilleure tentative conservée
--   * la correction est calculée côté serveur (les étoiles ne sont pas falsifiables)
--
-- Les anciennes fonctions (anki_next_questions, anki_record_answer,
-- anki_next_review_questions) sont conservées : l'APK 1.2.1 déjà installé
-- continue de les appeler.

-- ---------------------------------------------------------------------------
-- 1) Progression par niveau
-- ---------------------------------------------------------------------------
create table if not exists public.anki_level_progress (
  ticket_code text    not null references public.tickets(code) on delete cascade,
  chapter_id  text    not null,
  level       integer not null,
  best_stars  smallint not null default 0,
  attempts    integer not null default 0,
  passed_at   timestamptz,
  primary key (ticket_code, chapter_id, level)
);

-- ---------------------------------------------------------------------------
-- 2) anki_levels : l'état de la trajectoire des niveaux d'un chapitre
-- ---------------------------------------------------------------------------
create or replace function public.anki_levels(p_chapter_id text)
returns table (
  level        integer,
  total_levels integer,
  status       text,
  best_stars   integer,
  attempts     integer,
  passed_at    timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code        text;
  v_total       integer;
  v_total_levels integer;
begin
  select t.code into v_code from public.tickets t where t.user_id = auth.uid();
  if v_code is null then
    return;
  end if;

  if not exists (
    select 1 from public.anki_ticket_chapters c
    where c.ticket_code = v_code and c.chapter_id = p_chapter_id
  ) then
    raise exception 'Chapitre non choisi pour ce ticket.';
  end if;

  select count(*)::int into v_total
  from public.questions q
  join public.subjects s on s.id = q.subject_id
  where s.chapter_id = p_chapter_id
    and s.archived = false
    and cardinality(q.correct_answers) = 1;

  if v_total = 0 then
    return;
  end if;

  v_total_levels := ceil(v_total / 5.0)::int;

  return query
  with recursive lvl(n) as (
    select 1
    union all
    select n + 1 from lvl where n < v_total_levels
  )
  select
    l.n,
    v_total_levels,
    case
      when cur.passed_at is not null then 'passed'
      when l.n = 1 or prev.passed_at is not null then 'unlocked'
      else 'locked'
    end,
    coalesce(cur.best_stars, 0),
    coalesce(cur.attempts, 0),
    cur.passed_at
  from lvl l
  left join public.anki_level_progress cur
    on cur.ticket_code = v_code
   and cur.chapter_id = p_chapter_id
   and cur.level = l.n
  left join public.anki_level_progress prev
    on prev.ticket_code = v_code
   and prev.chapter_id = p_chapter_id
   and prev.level = l.n - 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) anki_level_questions : tirage aléatoire des 5 questions d'un niveau
-- ---------------------------------------------------------------------------
create or replace function public.anki_level_questions(p_chapter_id text, p_level integer)
returns table (
  id              uuid,
  subject_id      uuid,
  number          integer,
  matiere         text,
  statement       text,
  options         jsonb,
  correct_answers text[],
  explanation     text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code   text;
  v_status text;
  v_expires timestamptz;
begin
  select t.code, t.status, t.expires_at into v_code, v_status, v_expires
  from public.tickets t where t.user_id = auth.uid();
  if v_code is null then
    raise exception 'Ticket Anki introuvable.';
  end if;
  if v_status = 'suspended' then
    raise exception 'Ce ticket est suspendu.';
  end if;
  if v_expires is not null and v_expires < now() then
    raise exception 'Ticket Anki expiré.';
  end if;
  if not exists (
    select 1 from public.anki_ticket_chapters c
    where c.ticket_code = v_code and c.chapter_id = p_chapter_id
  ) then
    raise exception 'Chapitre non choisi pour ce ticket.';
  end if;

  return query
  select q.id, q.subject_id, q.number, q.matiere, q.statement, q.options,
         q.correct_answers, coalesce(q.explanation, '')
  from public.questions q
  join public.subjects s on s.id = q.subject_id
  where s.chapter_id = p_chapter_id
    and s.archived = false
    and cardinality(q.correct_answers) = 1
  order by random()
  limit 5;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) anki_record_level : correction côté serveur + étoiles + déblocage
--    p_answers : [{ "question_id": "<uuid>", "given": ["A"] }, ...]
-- ---------------------------------------------------------------------------
create or replace function public.anki_record_level(
  p_chapter_id text,
  p_level      integer,
  p_answers    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code         text;
  v_status       text;
  v_expires      timestamptz;
  v_prev_passed  timestamptz;
  v_total        integer;
  v_total_levels integer;
  v_answered     integer := 0;
  v_correct      integer := 0;
  v_stars        integer;
  v_best         integer;
  v_passed       boolean := false;
  v_correct_count integer;
  v_remaining    integer;
  v_q            record;
  v_given        text[];
  v_correct_answers text[];
  v_answers_ok   integer;
begin
  select t.code, t.status, t.expires_at into v_code, v_status, v_expires
  from public.tickets t where t.user_id = auth.uid();
  if v_code is null then
    raise exception 'Ticket Anki introuvable.';
  end if;
  if v_status = 'suspended' then
    raise exception 'Ce ticket est suspendu.';
  end if;
  if v_expires is not null and v_expires < now() then
    raise exception 'Ticket Anki expiré.';
  end if;
  if not exists (
    select 1 from public.anki_ticket_chapters c
    where c.ticket_code = v_code and c.chapter_id = p_chapter_id
  ) then
    raise exception 'Chapitre non choisi pour ce ticket.';
  end if;

  -- Le niveau doit être débloqué : niveau 1, ou niveau précédent réussi.
  if p_level > 1 then
    select passed_at into v_prev_passed
    from public.anki_level_progress
    where ticket_code = v_code and chapter_id = p_chapter_id and level = p_level - 1;
    if v_prev_passed is null then
      raise exception 'Ce niveau est verrouillé.';
    end if;
  end if;

  select count(*)::int into v_total
  from public.questions q
  join public.subjects s on s.id = q.subject_id
  where s.chapter_id = p_chapter_id
    and s.archived = false
    and cardinality(q.correct_answers) = 1;
  v_total_levels := ceil(v_total / 5.0)::int;

  select count(*)::int into v_answered
  from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb));

  -- Correction, question par question (le serveur est seul juge).
  for v_q in
    select q.id, q.statement, q.correct_answers, coalesce(q.explanation, '') as explanation
    from public.questions q
    join public.subjects s on s.id = q.subject_id
    where s.chapter_id = p_chapter_id
      and s.archived = false
      and cardinality(q.correct_answers) = 1
      and q.id in (
        select (e->>'question_id')::uuid
        from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) e
        where (e->>'question_id') is not null
      )
  loop
    select coalesce(array_agg(g), array[]::text[])
      into v_given
    from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) e,
         lateral jsonb_array_elements_text(coalesce(e->'given', '[]'::jsonb)) g
    where (e->>'question_id')::uuid = v_q.id;

    v_correct_answers := v_q.correct_answers;

    if v_given @> v_correct_answers then
      v_correct := v_correct + 1;
      insert into public.anki_history (
        ticket_code, chapter_id, question_id, question_statement,
        given_answers, correct_answers, explanation, status
      ) values (
        v_code, p_chapter_id, v_q.id, v_q.statement,
        v_given, v_correct_answers, v_q.explanation, 'correct'
      );
    else
      insert into public.anki_history (
        ticket_code, chapter_id, question_id, question_statement,
        given_answers, correct_answers, explanation, status
      ) values (
        v_code, p_chapter_id, v_q.id, v_q.statement,
        v_given, v_correct_answers, v_q.explanation, 'wrong'
      );
    end if;
  end loop;

  v_stars := v_correct;

  -- Progression du niveau : on garde la meilleure tentative, un niveau réussi
  -- le reste (rejouer un niveau réussi ne déverrouille rien de plus).
  insert into public.anki_level_progress (
    ticket_code, chapter_id, level, best_stars, attempts, passed_at
  ) values (
    v_code, p_chapter_id, p_level, v_stars, 1,
    case when v_stars = 5 then now() else null end
  )
  on conflict (ticket_code, chapter_id, level) do update
    set best_stars = greatest(public.anki_level_progress.best_stars, excluded.best_stars),
        attempts = public.anki_level_progress.attempts + 1,
        passed_at = coalesce(public.anki_level_progress.passed_at, excluded.passed_at);

  select lp.best_stars, (lp.passed_at is not null)
    into v_best, v_passed
  from public.anki_level_progress lp
  where lp.ticket_code = v_code and lp.chapter_id = p_chapter_id and lp.level = p_level;

  -- Niveau du chapitre (champ historique conservé pour le portail du docteur).
  select count(*)::int into v_correct_count
  from public.anki_history h
  where h.ticket_code = v_code and h.chapter_id = p_chapter_id and h.status = 'correct';

  select count(*)::int into v_remaining
  from public.questions q
  join public.subjects s on s.id = q.subject_id
  where s.chapter_id = p_chapter_id
    and s.archived = false
    and cardinality(q.correct_answers) = 1
    and not exists (
      select 1 from public.anki_history h
      where h.ticket_code = v_code and h.chapter_id = p_chapter_id
        and h.question_id = q.id and h.status = 'correct'
    );

  update public.anki_chapter_progress p
  set level = 1 + v_correct_count,
      completed_blocks = v_correct_count,
      completed_at = case when v_remaining = 0 then coalesce(p.completed_at, now()) else null end
  where p.ticket_code = v_code and p.chapter_id = p_chapter_id;

  return jsonb_build_object(
    'level', p_level,
    'stars', v_stars,
    'correct', v_correct,
    'total', v_answered,
    'passed', v_passed,
    'nextUnlocked', v_passed,
    'bestStars', v_best,
    'totalLevels', v_total_levels
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) anki_chapters() : + total_levels / levels_passed / stars
--    (les 10 colonnes existantes sont conservées : l'APK 1.2.1 les lit encore)
-- ---------------------------------------------------------------------------
drop function if exists public.anki_chapters();
create function public.anki_chapters()
returns table (
  chapter_id          text,
  level               integer,
  completed_blocks    integer,
  correct_answers     integer,
  completed_at        timestamptz,
  total_questions     integer,
  answered_questions  integer,
  new_questions       integer,
  in_progress_questions integer,
  review_questions    integer,
  total_levels        integer,
  levels_passed       integer,
  stars               integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  select t.code into v_code from public.tickets t where t.user_id = auth.uid();
  if v_code is null then
    return;
  end if;

  return query
  with ch as (
    select c.chapter_id,
           (select count(*)::int from public.questions q
            join public.subjects s on s.id = q.subject_id
            where s.chapter_id = c.chapter_id and s.archived = false
              and cardinality(q.correct_answers) = 1) as total_questions,
           (select count(*)::int from public.anki_question_progress qp
            where qp.ticket_code = c.ticket_code and qp.chapter_id = c.chapter_id) as answered_questions,
           (select count(*)::int from public.anki_question_progress qp
            where qp.ticket_code = c.ticket_code and qp.chapter_id = c.chapter_id
              and qp.state = 'review') as review_questions,
           (select count(*)::int from public.anki_history h
            where h.ticket_code = c.ticket_code and h.chapter_id = c.chapter_id
              and h.status = 'correct') as correct_count,
           (select count(*)::int from public.anki_level_progress lp
            where lp.ticket_code = c.ticket_code and lp.chapter_id = c.chapter_id
              and lp.passed_at is not null) as levels_passed,
           (select coalesce(sum(lp.best_stars), 0)::int from public.anki_level_progress lp
            where lp.ticket_code = c.ticket_code and lp.chapter_id = c.chapter_id) as stars
    from public.anki_ticket_chapters c
    where c.ticket_code = v_code
  )
  select
    ch.chapter_id,
    1 + ch.correct_count,
    ch.correct_count,
    ch.correct_count,
    p.completed_at,
    ch.total_questions,
    ch.answered_questions,
    ch.total_questions - ch.review_questions,
    0,
    ch.review_questions,
    greatest(1, ceil(ch.total_questions / 5.0)::int),
    ch.levels_passed,
    ch.stars
  from ch
  left join public.anki_chapter_progress p
    on p.ticket_code = v_code and p.chapter_id = ch.chapter_id
  order by ch.chapter_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) Droits
-- ---------------------------------------------------------------------------
revoke all on function public.anki_levels(text) from public;
grant execute on function public.anki_levels(text) to authenticated;
revoke all on function public.anki_level_questions(text, integer) from public;
grant execute on function public.anki_level_questions(text, integer) to authenticated;
revoke all on function public.anki_record_level(text, integer, jsonb) from public;
grant execute on function public.anki_record_level(text, integer, jsonb) to authenticated;
revoke all on function public.anki_chapters() from public;
grant execute on function public.anki_chapters() to authenticated;
