-- ============================================================
-- MEDQCM : règles Anki révisées (Suivant peut revenir, Ignorer non)
-- ============================================================

-- Une question peut être revue après une mauvaise réponse ou un
-- affichage du résultat si l'étudiant clique « Suivant ». « Ignorer »
-- ou une bonne réponse la retire de la file du run courant.

create table if not exists public.anki_question_progress (
  ticket_code text not null references public.tickets (code) on delete cascade,
  chapter_id text not null,
  question_id uuid not null,
  state text not null check (state in ('pending', 'review', 'mastered', 'ignored')),
  attempts integer not null default 0,
  correct_answers integer not null default 0,
  last_seen_at timestamptz,
  primary key (ticket_code, chapter_id, question_id),
  foreign key (ticket_code, chapter_id)
    references public.anki_ticket_chapters (ticket_code, chapter_id)
    on delete cascade
);

alter table public.anki_question_progress enable row level security;
alter table public.anki_history drop constraint if exists anki_history_ticket_code_chapter_id_question_id_key;

-- ------------------------------------------------------------------
-- Chapitres et progression : niveau = 1 + bonnes réponses
-- ------------------------------------------------------------------
drop function if exists public.anki_chapters();

create function public.anki_chapters()
returns table (
  chapter_id text,
  level integer,
  completed_blocks integer,
  correct_answers integer,
  completed_at timestamptz,
  total_questions integer,
  answered_questions integer
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
          and qp.chapter_id = c.chapter_id) as answered_questions
    from public.anki_ticket_chapters c
    left join public.anki_chapter_progress p
      on p.ticket_code = c.ticket_code and p.chapter_id = c.chapter_id
    where c.ticket_code = v_code
    order by c.position;
end;
$$;

revoke all on function public.anki_chapters() from public;
grant execute on function public.anki_chapters() to authenticated;

-- ------------------------------------------------------------------
-- Questions disponibles : les questions « review » reviennent en priorité
-- ------------------------------------------------------------------
create or replace function public.anki_next_questions(p_chapter_id text)
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
    left join public.anki_question_progress qp
      on qp.ticket_code = v_code
     and qp.chapter_id = p_chapter_id
     and qp.question_id = q.id
    where s.chapter_id = p_chapter_id
      and s.archived = false
      and cardinality(q.correct_answers) = 1
      and (qp.question_id is null or qp.state in ('pending', 'review'))
    order by case when qp.state = 'review' then 0 else 1 end, random()
    limit 5;
end;
$$;

revoke all on function public.anki_next_questions(text) from public;
grant execute on function public.anki_next_questions(text) to authenticated;

-- ------------------------------------------------------------------
-- Enregistrement : correct -> maîtrisée ; Suivant après faux -> review ;
-- Ignorer -> ignorée ; niveau = 1 + bonnes réponses
-- ------------------------------------------------------------------
drop function if exists public.anki_record_answer(text, uuid, text[], text);

create function public.anki_record_answer(
  p_chapter_id text,
  p_question_id uuid,
  p_given_answers text[],
  p_status text,
  p_can_return boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_type text;
  v_status text;
  v_expires timestamptz;
  v_statement text;
  v_correct text[];
  v_explanation text;
  v_state text;
  v_correct_count integer;
  v_completed boolean;
begin
  if p_status not in ('correct', 'wrong', 'revealed', 'skipped') then
    raise exception 'Statut de réponse invalide.';
  end if;

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

  select q.statement, q.correct_answers, coalesce(q.explanation, '')
    into v_statement, v_correct, v_explanation
  from public.questions q
  where q.id = p_question_id;

  if v_statement is null then
    raise exception 'Question introuvable.';
  end if;

  v_state := case
    when p_status = 'correct' then 'mastered'
    when p_status = 'skipped' or not coalesce(p_can_return, true) then 'ignored'
    else 'review'
  end;

  insert into public.anki_history (
    ticket_code, chapter_id, question_id, question_statement,
    given_answers, correct_answers, explanation, status
  ) values (
    v_code, p_chapter_id, p_question_id, v_statement,
    coalesce(p_given_answers, '{}'), v_correct, v_explanation, p_status
  );

  insert into public.anki_question_progress (
    ticket_code, chapter_id, question_id, state, attempts, correct_answers, last_seen_at
  ) values (
    v_code, p_chapter_id, p_question_id, v_state, 1,
    case when p_status = 'correct' then 1 else 0 end,
    now()
  )
  on conflict (ticket_code, chapter_id, question_id) do update set
    state = excluded.state,
    attempts = public.anki_question_progress.attempts + 1,
    correct_answers = public.anki_question_progress.correct_answers + excluded.correct_answers,
    last_seen_at = now();

  select count(*)::integer into v_correct_count
  from public.anki_history h
  where h.ticket_code = v_code
    and h.chapter_id = p_chapter_id
    and h.status = 'correct';

  select not exists (
    select 1
    from public.questions q
    join public.subjects s on s.id = q.subject_id
    left join public.anki_question_progress qp
      on qp.ticket_code = v_code
     and qp.chapter_id = p_chapter_id
     and qp.question_id = q.id
    where s.chapter_id = p_chapter_id
      and s.archived = false
      and cardinality(q.correct_answers) = 1
      and (qp.question_id is null or qp.state in ('pending', 'review'))
  ) into v_completed;

  update public.anki_chapter_progress p
    set level = 1 + v_correct_count,
        completed_blocks = v_correct_count,
        completed_at = case
          when v_completed then coalesce(p.completed_at, now())
          else p.completed_at
        end
  where p.ticket_code = v_code and p.chapter_id = p_chapter_id;

  return jsonb_build_object(
    'level', 1 + v_correct_count,
    'completedBlocks', v_correct_count,
    'correctAnswers', v_correct_count,
    'completed', v_completed
  );
end;
$$;

revoke all on function public.anki_record_answer(text, uuid, text[], text, boolean) from public;
grant execute on function public.anki_record_answer(text, uuid, text[], text, boolean) to authenticated;

-- ------------------------------------------------------------------
-- Recommencer un chapitre terminé (sans réinitialiser le niveau)
-- ------------------------------------------------------------------
create or replace function public.anki_restart_chapter(p_chapter_id text)
returns void
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

  delete from public.anki_question_progress
  where ticket_code = v_code and chapter_id = p_chapter_id;

  update public.anki_chapter_progress p
    set completed_at = null
  where p.ticket_code = v_code and p.chapter_id = p_chapter_id;
end;
$$;

revoke all on function public.anki_restart_chapter(text) from public;
grant execute on function public.anki_restart_chapter(text) to authenticated;
