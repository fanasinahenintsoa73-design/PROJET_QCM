-- ============================================================
-- MEDQCM : mode Réviser (un vrai QCM des questions à réviser)
-- - « À réviser » = les questions pas encore maîtrisées
--   = les ignorées + celles revenues par « Suivant »
-- - nouvelle sélection anki_next_review_questions()
-- - les fiches portent les options pour afficher le texte de la réponse
-- ============================================================

-- ------------------------------------------------------------------
-- 1) Compteurs de chapitre : « À réviser » = en cours + ignorées
--    (nouvelles + à réviser = total du chapitre)
-- ------------------------------------------------------------------
create or replace function public.anki_chapters()
returns table (
  chapter_id text,
  level integer,
  completed_blocks integer,
  correct_answers integer,
  completed_at timestamptz,
  total_questions integer,
  answered_questions integer,
  new_questions integer,
  in_progress_questions integer,
  review_questions integer
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
    select c.chapter_id,
      1 + (select count(*)::integer
        from public.anki_history h
        where h.ticket_code = c.ticket_code
          and h.chapter_id = c.chapter_id
          and h.status = 'correct') as level,
      (select count(*)::integer
        from public.anki_history h
        where h.ticket_code = c.ticket_code
          and h.chapter_id = c.chapter_id
          and h.status = 'correct') as completed_blocks,
      (select count(*)::integer
        from public.anki_history h
        where h.ticket_code = c.ticket_code
          and h.chapter_id = c.chapter_id
          and h.status = 'correct') as correct_answers,
      p.completed_at,
      (select count(*)::integer
        from public.questions q
        join public.subjects s on s.id = q.subject_id
        where s.chapter_id = c.chapter_id
          and s.archived = false
          and cardinality(q.correct_answers) = 1) as total_questions,
      (select count(*)::integer
        from public.anki_question_progress qp
        where qp.ticket_code = c.ticket_code
          and qp.chapter_id = c.chapter_id) as answered_questions,
      greatest(0,
        (select count(*)::integer
          from public.questions q
          join public.subjects s on s.id = q.subject_id
          where s.chapter_id = c.chapter_id
            and s.archived = false
            and cardinality(q.correct_answers) = 1)
        - (select count(*)::integer
          from public.anki_question_progress qp
          where qp.ticket_code = c.ticket_code
            and qp.chapter_id = c.chapter_id)
      ) as new_questions,
      (select count(*)::integer
        from public.anki_question_progress qp
        where qp.ticket_code = c.ticket_code
          and qp.chapter_id = c.chapter_id
          and qp.state = 'review') as in_progress_questions,
      (select count(*)::integer
        from public.anki_question_progress qp
        where qp.ticket_code = c.ticket_code
          and qp.chapter_id = c.chapter_id
          and qp.state in ('review', 'ignored')) as review_questions
    from public.anki_ticket_chapters c
    left join public.anki_chapter_progress p
      on p.ticket_code = c.ticket_code and p.chapter_id = c.chapter_id
    where c.ticket_code = v_code
    order by c.position;
end;
$$;

-- ------------------------------------------------------------------
-- 2) Sélection des questions à réviser : « En cours » d'abord,
--    puis les ignorées. 5 par série.
-- ------------------------------------------------------------------
create or replace function public.anki_next_review_questions(p_chapter_id text)
returns table (
  id uuid,
  subject_id uuid,
  number integer,
  matiere text,
  statement text,
  options jsonb,
  correct_answers text[],
  explanation text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_type text;
  v_status text;
  v_expires timestamptz;
begin
  select t.code, t.type, t.status, t.expires_at
    into v_code, v_type, v_status, v_expires
  from public.tickets t
  where t.user_id = auth.uid();

  if v_code is null or v_type <> 'anki' then
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
    select q.id, q.subject_id, q.number, q.matiere, q.statement, q.options, q.correct_answers, q.explanation
    from public.questions q
    join public.subjects s on s.id = q.subject_id
    join public.anki_question_progress qp
      on qp.ticket_code = v_code
     and qp.chapter_id = p_chapter_id
     and qp.question_id = q.id
    where s.chapter_id = p_chapter_id
      and s.archived = false
      and cardinality(q.correct_answers) = 1
      and qp.state in ('review', 'ignored')
    order by case when qp.state = 'review' then 0 else 1 end, random()
    limit 5;
end;
$$;

revoke all on function public.anki_next_review_questions(text) from public;
grant execute on function public.anki_next_review_questions(text) to authenticated;

-- ------------------------------------------------------------------
-- 3) Fiches : on ajoute les options de la question pour pouvoir
--    afficher le texte de la bonne réponse (et pas seulement E, B, C).
--    La signature de retour change : on recrée la fonction.
-- ------------------------------------------------------------------
drop function if exists public.anki_get_review_cards();

create function public.anki_get_review_cards()
returns table (
  chapter_id text,
  question_id uuid,
  statement text,
  correct_answers text[],
  explanation text,
  status text,
  last_given_answers text[],
  attempts integer,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  misses integer,
  ignored integer,
  state text,
  options jsonb
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
    select c.chapter_id, c.question_id, c.statement, c.correct_answers,
      c.explanation, c.status, c.last_given_answers, c.attempts,
      c.first_seen_at, c.last_seen_at,
      coalesce(h.misses, 0)::integer as misses,
      coalesce(h.ignored, 0)::integer as ignored,
      qp.state,
      q.options
    from public.anki_review_cards c
    left join lateral (
      select
        count(*) filter (where h.status in ('wrong', 'revealed'))::integer as misses,
        count(*) filter (where h.status = 'skipped')::integer as ignored
      from public.anki_history h
      where h.ticket_code = c.ticket_code
        and h.chapter_id = c.chapter_id
        and h.question_id = c.question_id
    ) h on true
    left join public.anki_question_progress qp
      on qp.ticket_code = c.ticket_code
        and qp.chapter_id = c.chapter_id
        and qp.question_id = c.question_id
    left join public.questions q on q.id = c.question_id
    where c.ticket_code = v_code
    order by c.chapter_id, c.last_seen_at desc;
end;
$$;

revoke all on function public.anki_get_review_cards() from public;
grant execute on function public.anki_get_review_cards() to authenticated;
