-- ===========================================================================
-- 20261117_ticket_security.sql
-- Passe 2 du durcissement de sécurité.
--
-- 1) Vrais nombres aléatoires pour les secrets de tickets (plus de random()
--    de PostgreSQL, qui est un générateur pseudo-aléatoire prévisible).
--    N'affecte que les NOUVEAUX tickets ; les tickets existants gardent leur
--    secret (déjà hashé bcrypt dans auth.users). Aucun changement visible.
--
-- 2) Verrou progressif de la connexion par ticket :
--    - 5 échecs dans une fenêtre de 10 minutes -> blocage de 10 minutes ;
--    - à chaque nouvelle série de 5 échecs, la durée augmente : 20, 30, 40…
--    - la fenêtre de comptage reste de 10 minutes ; seul le blocage croît ;
--    - une connexion réussie remet tout à zéro.
--    Un étudiant honnête (qui tape son numéro correct) ne voit rien. Seul un
--    cas d'attaque (échecs répétés) voit un message de temporisation.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Secrets de tickets : gen_random_bytes au lieu de random()
-- ---------------------------------------------------------------------------
-- On tire 18 octets cryptographiques : 6 pour les chiffres, 3 pour les
-- lettres, 9 pour le mélange. Le secret garde exactement le même format
-- (6 chiffres + 3 lettres, ordem aléatoire) pour ne rien casser à l'affichage.

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
  v_bytes bytea;
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

    -- 6 chiffres (octets 0..5) + 3 lettres (octets 6..8), ordre mélangé par
    -- les octets 9..17. Générateur cryptographique : imprévisible.
    v_bytes := extensions.gen_random_bytes(18);
    select string_agg(pick, '' order by rnd)
      into v_secret
    from (
      select substring('0123456789' from 1 + (get_byte(v_bytes, k) % 10) for 1) as pick,
             get_byte(v_bytes, k + 9) as rnd
        from generate_series(0, 5) k
      union all
      select substring('ABCDEFGHIJKLMNOPQRSTUVWXYZ' from 1 + (get_byte(v_bytes, k + 6) % 26) for 1) as pick,
             get_byte(v_bytes, k + 15) as rnd
        from generate_series(0, 2) k
    ) shuffled;

    v_user_id := gen_random_uuid();
    v_email := lower(v_code) || '@ticket.medqcm';

    -- Les valeurs ci-dessous doivent correspondre exactement à ce que
    -- supabase-auth écrit pour un compte créé par son API, sinon la
    -- connexion du ticket échoue.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_secret, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('first_name', 'PACES', 'last_name', lpad(v_num::text, 4, '0')),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '', '', '', '',
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

    -- Numéro conservé pour l'affichage côté docteur.
    insert into public.ticket_secrets (code, secret)
    values (v_code, v_secret);

    code := v_code;
    secret := v_secret;
    return next;
  end loop;
end;
$$;

revoke all on function public.generate_tickets(integer) from public;
grant execute on function public.generate_tickets(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Verrou progressif de la connexion par ticket
-- ---------------------------------------------------------------------------

create table if not exists public.ticket_login_guard (
  email text primary key,
  failed_count integer not null default 0,
  window_start timestamptz not null default now(),
  lock_until timestamptz,
  level integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.ticket_login_guard enable row level security;

-- Aucun accès direct : la table n'est manipulée que par les RPC ci-dessous.
revoke all on public.ticket_login_guard from public, anon, authenticated;

-- Message unique, partagé par le contrôle et l'enregistrement d'échec.
create or replace function public.ticket_lock_message(p_retry_seconds integer)
returns text
language sql
immutable
as $$
  select 'Trop de tentatives de connexion. Réessaie dans '
         || greatest(1, ceil(p_retry_seconds / 60.0))::text || ' min.'
$$;

-- (a) Contrôle AVANT la tentative de connexion.
create or replace function public.ticket_login_check(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_lock_until timestamptz;
  v_retry integer;
begin
  select g.lock_until into v_lock_until
  from public.ticket_login_guard g
  where g.email = v_email;

  if v_lock_until is not null and v_lock_until > now() then
    v_retry := ceil(extract(epoch from (v_lock_until - now())))::integer;
    return jsonb_build_object(
      'blocked', true,
      'retrySeconds', v_retry,
      'message', public.ticket_lock_message(v_retry)
    );
  end if;

  return jsonb_build_object('blocked', false, 'retrySeconds', 0, 'message', '');
end;
$$;

-- (b) Enregistrement d'un échec, avec escalade 10 -> 20 -> 30 min…
create or replace function public.ticket_login_failure(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_row public.ticket_login_guard%rowtype;
  v_retry integer;
begin
  select * into v_row from public.ticket_login_guard where email = v_email;

  if not found then
    insert into public.ticket_login_guard (email, failed_count, window_start, level, updated_at)
    values (v_email, 1, now(), 0, now());
    return jsonb_build_object('blocked', false, 'retrySeconds', 0, 'message', '');
  end if;

  -- Déjà verrouillé (le contrôle bloque normalement avant) : on renvoie le
  -- temps restant sans incrémenter le compteur.
  if v_row.lock_until is not null and v_row.lock_until > now() then
    v_retry := ceil(extract(epoch from (v_row.lock_until - now())))::integer;
    return jsonb_build_object(
      'blocked', true, 'retrySeconds', v_retry,
      'message', public.ticket_lock_message(v_retry)
    );
  end if;

  -- Nouvelle fenêtre de 10 min si la précédente est expirée. Le niveau de
  -- récidive est conservé : il ne s'efface qu'à une connexion réussie.
  if now() - v_row.window_start > interval '10 minutes' then
    v_row.failed_count := 0;
    v_row.window_start := now();
  end if;

  v_row.failed_count := v_row.failed_count + 1;
  v_row.updated_at := now();

  if v_row.failed_count >= 5 then
    v_row.level := v_row.level + 1;
    v_row.lock_until := now() + (v_row.level * interval '10 minutes');
    v_row.failed_count := 0;
    v_row.window_start := now();
  end if;

  update public.ticket_login_guard
    set failed_count = v_row.failed_count,
        window_start = v_row.window_start,
        lock_until = v_row.lock_until,
        level = v_row.level,
        updated_at = v_row.updated_at
  where email = v_email;

  if v_row.lock_until is not null then
    v_retry := ceil(extract(epoch from (v_row.lock_until - now())))::integer;
    return jsonb_build_object(
      'blocked', true, 'retrySeconds', v_retry,
      'message', public.ticket_lock_message(v_retry)
    );
  end if;

  return jsonb_build_object('blocked', false, 'retrySeconds', 0, 'message', '');
end;
$$;

-- (c) Succès : remise à zéro complète (compteur, fenêtre, niveau, verrou).
create or replace function public.ticket_login_success(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.ticket_login_guard where email = lower(trim(p_email));
end;
$$;

-- Ces RPC sont appelés AVANT l'authentification : le rôle anon doit pouvoir
-- les exécuter. Aucune donnée sensible n'est exposée (la table est verrouillée).
revoke all on function public.ticket_lock_message(integer) from public, anon;
grant execute on function public.ticket_lock_message(integer) to anon, authenticated;

revoke all on function public.ticket_login_check(text) from public, anon;
grant execute on function public.ticket_login_check(text) to anon, authenticated;

revoke all on function public.ticket_login_failure(text) from public, anon;
grant execute on function public.ticket_login_failure(text) to anon, authenticated;

revoke all on function public.ticket_login_success(text) from public, anon;
grant execute on function public.ticket_login_success(text) to anon, authenticated;

-- Fin de la migration 20261117_ticket_security.sql
