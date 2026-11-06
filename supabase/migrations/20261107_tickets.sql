-- ============================================================
-- MEDQCM : tickets d'accès étudiants (1 ticket = 30 séries)
-- ============================================================
--
-- Un ticket = un compte étudiant = 30 séries.
-- - Code (ID) : PACES0001, PACES0002, ...
-- - Numéro d'enregistrement : 6 chiffres + 3 lettres mélangés,
--   généré au hasard. C'est le mot de passe du compte Auth créé
--   pour le ticket (hash bcrypt dans auth.users, jamais en clair).
-- - Le code est affiché à l'admin une seule fois à la génération.
-- - 1 ticket = 1 étudiant, séries indépendantes (nouveau ticket
--   après 30 séries = nouveau compte, zéro historique partagé).

create extension if not exists pgcrypto;

-- Table des tickets.
create table public.tickets (
  code text primary key,
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  status text not null default 'available'
    check (status in ('available', 'used', 'suspended')),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  last_login_at timestamptz
);

-- RLS activée sans policy : tout accès passe par les RPC
-- (security definer) ci-dessous.
alter table public.tickets enable row level security;

-- Historique des connexions d'un ticket.
create table public.ticket_logins (
  id bigint generated always as identity primary key,
  ticket_code text not null references public.tickets (code) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.ticket_logins enable row level security;

-- ------------------------------------------------------------------
-- Génère un lot de tickets (docteur uniquement).
-- Chaque ticket crée : un compte Auth, son profil (via le trigger
-- handle_new_user), une assignation de cycle (30 séries) et la ligne
-- dans tickets. Retourne les codes + numéros en clair, une seule fois.
-- ------------------------------------------------------------------
create or replace function public.generate_tickets(p_count integer)
returns table (code text, secret text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start integer;
  v_num integer;
  v_code text;
  v_secret text;
  v_user_id uuid;
  v_email text;
  i integer;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'professor'
  ) then
    raise exception 'Réservé au docteur.';
  end if;

  if p_count is null or p_count < 1 or p_count > 500 then
    raise exception 'Nombre de tickets invalide (1 à 500).';
  end if;

  select coalesce(max(case when t.code ~ '^PACES[0-9]+$' then substring(t.code from 6)::integer end), 0) + 1
    into v_start
  from public.tickets t;

  for i in 0 .. p_count - 1 loop
    v_num := v_start + i;
    v_code := 'PACES' || lpad(v_num::text, 4, '0');

    -- Numéro d'enregistrement : 6 chiffres + 3 lettres, mélangés.
    select string_agg(pick, '' order by rnd)
      into v_secret
    from (
      select substring('0123456789' from 1 + floor(random() * 10)::integer for 1) as pick, random() as rnd
        from generate_series(1, 6)
      union all
      select substring('ABCDEFGHIJKLMNOPQRSTUVWXYZ' from 1 + floor(random() * 26)::integer for 1) as pick, random() as rnd
        from generate_series(1, 3)
    ) shuffled;

    v_user_id := gen_random_uuid();
    v_email := lower(v_code) || '@ticket.medqcm';

    insert into auth.users (
      id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_user_meta_data, created_at, updated_at
    ) values (
      v_user_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_secret, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('first_name', 'PACES', 'last_name', lpad(v_num::text, 4, '0')),
      now(), now()
    );
    -- Le trigger handle_new_user crée le profil depuis le metadata ci-dessus.

    -- (colonne email = colonne générée depuis identity_data : ne pas l'insérer)
    insert into auth.identities (user_id, provider, provider_id, identity_data, created_at, updated_at)
    values (
      v_user_id, 'email', v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      now(), now()
    );

    -- Le ticket donne accès immédiatement (30 séries, sans date limite).
    update public.profiles
      set status = 'active', activated_at = now()
    where id = v_user_id;

    insert into public.subject_assignments (user_id, subject_id, started_at, expires_at)
    values (v_user_id, null, now(), now() + interval '100 years');

    insert into public.tickets (code, user_id, status)
    values (v_code, v_user_id, 'available');

    code := v_code;
    secret := v_secret;
    return next;
  end loop;
end;
$$;

revoke all on function public.generate_tickets(integer) from public;
grant execute on function public.generate_tickets(integer) to authenticated;

-- ------------------------------------------------------------------
-- Suspend un ticket (ou le réactive). Docteur uniquement.
-- 'active' = réactiver : disponible si jamais utilisé, en cours sinon.
-- ------------------------------------------------------------------
create or replace function public.set_ticket_status(p_code text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used_at timestamptz;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'professor'
  ) then
    raise exception 'Réservé au docteur.';
  end if;

  if p_status not in ('suspended', 'active') then
    raise exception 'Statut invalide.';
  end if;

  select used_at into v_used_at from public.tickets where code = p_code;
  if not found then
    raise exception 'Ticket introuvable.';
  end if;

  update public.tickets
    set status = case
      when p_status = 'suspended' then 'suspended'
      when v_used_at is null then 'available'
      else 'used'
    end
  where code = p_code;
end;
$$;

revoke all on function public.set_ticket_status(text, text) from public;
grant execute on function public.set_ticket_status(text, text) to authenticated;

-- ------------------------------------------------------------------
-- Liste les tickets pour l'admin (docteur uniquement).
-- 'series_used' = nombre de séries faites avec ce ticket.
-- ------------------------------------------------------------------
create or replace function public.list_tickets()
returns table (
  code text,
  status text,
  series_used integer,
  created_at timestamptz,
  used_at timestamptz,
  last_login_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'professor'
  ) then
    raise exception 'Réservé au docteur.';
  end if;

  return query
    select t.code, t.status,
      (select count(*)::integer from public.attempts a where a.user_id = t.user_id) as series_used,
      t.created_at, t.used_at, t.last_login_at
    from public.tickets t
    order by t.code;
end;
$$;

revoke all on function public.list_tickets() from public;
grant execute on function public.list_tickets() to authenticated;

-- ------------------------------------------------------------------
-- Historique des connexions d'un ticket (docteur uniquement).
-- ------------------------------------------------------------------
create or replace function public.ticket_history(p_code text)
returns table (created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'professor'
  ) then
    raise exception 'Réservé au docteur.';
  end if;

  return query
    select l.created_at
    from public.ticket_logins l
    where l.ticket_code = p_code
    order by l.created_at desc
    limit 100;
end;
$$;

revoke all on function public.ticket_history(text) from public;
grant execute on function public.ticket_history(text) to authenticated;

-- ------------------------------------------------------------------
-- Enregistre une connexion du ticket de l'utilisateur connecté.
-- À appeler par l'app à chaque connexion réussie par ticket.
-- ------------------------------------------------------------------
create or replace function public.record_ticket_login()
returns void
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

  insert into public.ticket_logins (ticket_code, user_id)
  values (v_code, auth.uid());

  update public.tickets
    set status = case when status = 'available' then 'used' else status end,
        used_at = coalesce(used_at, now()),
        last_login_at = now()
  where code = v_code;
end;
$$;

revoke all on function public.record_ticket_login() from public;
grant execute on function public.record_ticket_login() to authenticated;

-- ------------------------------------------------------------------
-- Statut du ticket de l'utilisateur connecté ('available', 'used',
-- 'suspended'), ou null si ce compte n'est pas un ticket.
-- ------------------------------------------------------------------
create or replace function public.my_ticket_status()
returns text
language sql
security definer
set search_path = public
as $$
  select t.status from public.tickets t where t.user_id = auth.uid();
$$;

revoke all on function public.my_ticket_status() from public;
grant execute on function public.my_ticket_status() to authenticated;
