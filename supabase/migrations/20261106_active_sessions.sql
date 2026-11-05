-- Une seule session active par compte (anti partage)
-- À exécuter dans le SQL Editor Supabase ou via psql "$SUPABASE_DB_URL".

create table if not exists public.active_sessions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id text not null check (char_length(session_id) between 8 and 128),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, session_id)
);

create index if not exists active_sessions_user_seen_idx
  on public.active_sessions (user_id, last_seen_at desc);

alter table public.active_sessions enable row level security;

revoke all on table public.active_sessions from public, anon, authenticated;

create or replace function public.register_active_session(p_session_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id text := btrim(coalesce(p_session_id, ''));
begin
  if auth.uid() is null or char_length(v_session_id) < 8 or char_length(v_session_id) > 128 then
    raise exception 'INVALID_SESSION' using errcode = 'P0001';
  end if;

  update public.active_sessions
  set revoked_at = now(),
      last_seen_at = now()
  where user_id = auth.uid()
    and session_id <> v_session_id
    and revoked_at is null;

  insert into public.active_sessions (user_id, session_id, created_at, last_seen_at, revoked_at)
  values (auth.uid(), v_session_id, now(), now(), null)
  on conflict (user_id, session_id)
  do update set last_seen_at = now(), revoked_at = null;

  return true;
end;
$$;

create or replace function public.is_active_session(p_session_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Vrai si la session est active ou absente (migration : les comptes déjà
  -- connectés sont enregistrés à leur prochaine connexion). Faux uniquement
  -- si une session a été révoquée par une connexion plus récente.
  select not exists (
    select 1
    from public.active_sessions s
    where s.user_id = auth.uid()
      and s.session_id = btrim(coalesce(p_session_id, ''))
      and s.revoked_at is not null
  );
$$;

create or replace function public.revoke_active_session(p_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.active_sessions
  set revoked_at = now(),
      last_seen_at = now()
  where user_id = auth.uid()
    and session_id = btrim(coalesce(p_session_id, ''));
end;
$$;

revoke all on function public.register_active_session(text) from public, anon;
revoke all on function public.is_active_session(text) from public, anon;
revoke all on function public.revoke_active_session(text) from public, anon;
grant execute on function public.register_active_session(text) to authenticated;
grant execute on function public.is_active_session(text) to authenticated;
grant execute on function public.revoke_active_session(text) to authenticated;
