-- ============================================================
-- MEDQCM : les questions ignorées comptent aussi en « À réviser »
-- ============================================================

drop function if exists public.anki_chapters();

create function public.anki_chapters()
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
          and qp.state in ('mastered', 'ignored')) as review_questions
    from public.anki_ticket_chapters c
    left join public.anki_chapter_progress p
      on p.ticket_code = c.ticket_code and p.chapter_id = c.chapter_id
    where c.ticket_code = v_code
    order by c.position;
end;
$$;

revoke all on function public.anki_chapters() from public;
grant execute on function public.anki_chapters() to authenticated;
