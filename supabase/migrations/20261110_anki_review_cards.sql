-- ============================================================
-- MEDQCM : une fiche de révision unique par question Anki.
-- ============================================================

create table if not exists public.anki_review_cards (
  ticket_code text not null references public.tickets (code) on delete cascade,
  chapter_id text not null,
  question_id uuid not null references public.questions (id) on delete cascade,
  statement text not null,
  correct_answers text[] not null default '{}',
  explanation text not null default '',
  status text not null check (status in ('correct', 'wrong', 'revealed', 'skipped')),
  last_given_answers text[] not null default '{}',
  attempts integer not null default 1 check (attempts > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (ticket_code, chapter_id, question_id)
);

create index if not exists anki_review_cards_ticket_idx
  on public.anki_review_cards (ticket_code, chapter_id, last_seen_at desc);

alter table public.anki_review_cards enable row level security;

-- ------------------------------------------------------------------
-- Reprise de l'historique existant : une ligne par question.
-- ------------------------------------------------------------------
with ranked as (
  select
    h.ticket_code,
    h.chapter_id,
    h.question_id,
    h.question_statement,
    h.correct_answers,
    coalesce(h.explanation, '') as explanation,
    h.status,
    h.given_answers,
    count(*) over (
      partition by h.ticket_code, h.chapter_id, h.question_id
    )::integer as attempts,
    min(h.created_at) over (
      partition by h.ticket_code, h.chapter_id, h.question_id
    ) as first_seen_at,
    max(h.created_at) over (
      partition by h.ticket_code, h.chapter_id, h.question_id
    ) as last_seen_at,
    row_number() over (
      partition by h.ticket_code, h.chapter_id, h.question_id
      order by h.created_at desc
    ) as rn
  from public.anki_history h
)
insert into public.anki_review_cards (
  ticket_code, chapter_id, question_id, statement, correct_answers,
  explanation, status, last_given_answers, attempts, first_seen_at, last_seen_at
)
select
  ticket_code,
  chapter_id,
  question_id,
  question_statement,
  correct_answers,
  explanation,
  status,
  given_answers,
  attempts,
  first_seen_at,
  last_seen_at
from ranked
where rn = 1
on conflict (ticket_code, chapter_id, question_id) do nothing;

-- ------------------------------------------------------------------
-- Chaque nouvelle réponse met à jour la fiche unique.
-- ------------------------------------------------------------------
create or replace function public.sync_anki_review_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.anki_review_cards (
    ticket_code, chapter_id, question_id, statement, correct_answers,
    explanation, status, last_given_answers, attempts, first_seen_at, last_seen_at
  ) values (
    new.ticket_code,
    new.chapter_id,
    new.question_id,
    new.question_statement,
    new.correct_answers,
    coalesce(new.explanation, ''),
    new.status,
    new.given_answers,
    1,
    new.created_at,
    new.created_at
  )
  on conflict (ticket_code, chapter_id, question_id) do update set
    statement = excluded.statement,
    correct_answers = excluded.correct_answers,
    explanation = excluded.explanation,
    status = excluded.status,
    last_given_answers = excluded.last_given_answers,
    attempts = public.anki_review_cards.attempts + 1,
    last_seen_at = excluded.last_seen_at;

  return new;
end;
$$;

drop trigger if exists anki_history_review_card on public.anki_history;

create trigger anki_history_review_card
after insert on public.anki_history
for each row execute function public.sync_anki_review_card();

-- ------------------------------------------------------------------
-- Lecture des fiches du ticket connecté.
-- ------------------------------------------------------------------
create or replace function public.anki_get_review_cards()
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
  last_seen_at timestamptz
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
      c.first_seen_at, c.last_seen_at
    from public.anki_review_cards c
    where c.ticket_code = v_code
    order by c.chapter_id, c.last_seen_at desc;
end;
$$;

revoke all on function public.anki_get_review_cards() from public;
grant execute on function public.anki_get_review_cards() to authenticated;

revoke all on public.anki_review_cards from public;
