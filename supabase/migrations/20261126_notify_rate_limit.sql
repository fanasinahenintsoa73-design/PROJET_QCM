-- ============================================================
-- MEDQCM : limiteur de débit partagé pour la fonction /api/notify.
-- 26 novembre 2026
--
-- 10 notifications par fenêtre de 15 minutes et par étudiant
-- authentifié, toutes actions confondues. La clé est construite
-- côté base à partir de auth.uid() : un appelant ne peut pas
-- épuiser le quota d'un autre compte.
--
-- Table protégée par RLS sans policy : seul accès possible est la
-- fonction SECURITY DEFINER, réservée à "authenticated".
--
-- À exécuter dans le SQL Editor Supabase (les migrations ne sont
-- pas appliquées automatiquement par le dépôt).
-- ============================================================

create table if not exists public.notify_rate_limits (
  bucket_key   text primary key,
  window_start timestamptz not null default now(),
  hits         integer not null default 0
);

alter table public.notify_rate_limits enable row level security;
revoke all on table public.notify_rate_limits from public, anon, authenticated;

create or replace function public.notify_rate_limit(p_type text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_key   text;
  v_start timestamptz := now() - interval '15 minutes';
  v_hits  integer;
begin
  if v_uid is null or p_type not in ('new_request', 'access_activated') then
    return false;
  end if;

  v_key := v_uid::text || ':' || p_type;

  delete from public.notify_rate_limits
  where window_start < v_start;

  insert into public.notify_rate_limits (bucket_key, window_start, hits)
  values (v_key, now(), 1)
  on conflict (bucket_key) do update
    set hits = case
          when public.notify_rate_limits.window_start < v_start then 1
          else public.notify_rate_limits.hits + 1
        end,
        window_start = case
          when public.notify_rate_limits.window_start < v_start then now()
          else public.notify_rate_limits.window_start
        end
  returning hits into v_hits;

  return v_hits <= 10;
end;
$$;

revoke all on function public.notify_rate_limit(text) from public, anon;
grant execute on function public.notify_rate_limit(text) to authenticated;
