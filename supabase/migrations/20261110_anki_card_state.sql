-- ============================================================
-- MEDQCM : les fiches Anki portent l'état du moteur (progress).
-- Aligne les filtres de l'historique sur les compteurs des chapitres
-- (« En cours » = state 'review', « À réviser » = 'mastered'/'ignored').
-- ============================================================

-- La signature de retour change (1 colonne ajoutée) : on recrée la fonction.
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
  state text
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
      qp.state
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
    where c.ticket_code = v_code
    order by c.chapter_id, c.last_seen_at desc;
end;
$$;

revoke all on function public.anki_get_review_cards() from public;
grant execute on function public.anki_get_review_cards() to authenticated;
