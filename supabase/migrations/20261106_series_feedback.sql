-- Avis des étudiants sur les séries (étoiles + commentaire)
-- À exécuter dans le SQL Editor Supabase ou via psql "$SUPABASE_DB_URL".
-- Sans cette migration, l'application garde l'avis en local sur l'appareil
-- de l'étudiant et la page admin "Avis" reste vide.

create table if not exists public.series_feedback (
  attempt_id uuid primary key references public.attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists series_feedback_user_created_idx
  on public.series_feedback (user_id, created_at desc);

create index if not exists series_feedback_created_idx
  on public.series_feedback (created_at desc);

create index if not exists series_feedback_rating_idx
  on public.series_feedback (rating);

alter table public.series_feedback enable row level security;

-- Aucune lecture/écriture directe : seuls les RPC sécurisés touchent la table.
revoke all on table public.series_feedback from public, anon, authenticated;

create or replace function public.save_series_feedback(
  p_attempt_id uuid,
  p_rating integer,
  p_comment text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment text := btrim(coalesce(p_comment, ''));
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'INVALID_RATING' using errcode = 'P0001';
  end if;

  if char_length(v_comment) > 500 then
    raise exception 'INVALID_RATING' using errcode = 'P0001';
  end if;

  -- L'étudiant ne note que sa propre série, une fois terminée.
  if not exists (
    select 1
    from public.attempts a
    where a.id = p_attempt_id
      and a.user_id = auth.uid()
      and coalesce(a.status, 'completed') = 'completed'
  ) then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.series_feedback (attempt_id, user_id, rating, comment, created_at, updated_at)
  values (p_attempt_id, auth.uid(), p_rating, v_comment, now(), now())
  on conflict (attempt_id)
  do update set rating = excluded.rating,
               comment = excluded.comment,
               updated_at = now()
  where public.series_feedback.user_id = auth.uid();

  select jsonb_build_object(
           'attemptId', f.attempt_id,
           'userId', f.user_id,
           'rating', f.rating,
           'comment', f.comment,
           'createdAt', f.created_at,
           'updatedAt', f.updated_at
         )
  into v_result
  from public.series_feedback f
  where f.attempt_id = p_attempt_id;

  return v_result;
end;
$$;

create or replace function public.get_my_series_feedback(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;

  select jsonb_build_object(
           'attemptId', f.attempt_id,
           'userId', f.user_id,
           'rating', f.rating,
           'comment', f.comment,
           'createdAt', f.created_at,
           'updatedAt', f.updated_at
         )
  into v_result
  from public.series_feedback f
  where f.attempt_id = p_attempt_id
    and f.user_id = auth.uid();

  return v_result;
end;
$$;

create or replace function public.list_series_feedbacks()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_professor() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'attemptId', f.attempt_id,
             'userId', f.user_id,
             'userName', p.first_name || ' ' || p.last_name,
             'userEmail', p.email,
             'rating', f.rating,
             'comment', f.comment,
             'createdAt', f.created_at,
             'updatedAt', f.updated_at,
             'ueId', a.ue_id,
             'chapterIds', to_jsonb(coalesce(a.chapter_ids, '{}'::text[])),
             'score', a.score,
             'total', a.total,
             'attemptCreatedAt', a.created_at
           )
           order by f.created_at desc
         ), '[]'::jsonb)
  into v_result
  from public.series_feedback f
  join public.profiles p on p.id = f.user_id
  join public.attempts a on a.id = f.attempt_id;

  return v_result;
end;
$$;

revoke all on function public.save_series_feedback(uuid, integer, text) from public, anon;
revoke all on function public.get_my_series_feedback(uuid) from public, anon;
revoke all on function public.list_series_feedbacks() from public, anon;
grant execute on function public.save_series_feedback(uuid, integer, text) to authenticated;
grant execute on function public.get_my_series_feedback(uuid) to authenticated;
grant execute on function public.list_series_feedbacks() to authenticated;
