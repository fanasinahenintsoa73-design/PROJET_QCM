-- ============================================================
-- MEDQCM : numéros d'enregistrement réaffichables (docteur)
-- ============================================================
-- Les numéros sont conservés dans une table séparée, lisible
-- uniquement par le docteur. Les étudiants n'y ont pas accès.
-- La suppression d'un ticket supprime son numéro en cascade.

create table if not exists public.ticket_secrets (
  code text primary key references public.tickets (code) on delete cascade,
  secret text not null,
  created_at timestamptz not null default now()
);

alter table public.ticket_secrets enable row level security;

drop policy if exists "ticket_secrets_doctor_select" on public.ticket_secrets;
create policy "ticket_secrets_doctor_select"
  on public.ticket_secrets
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'professor'
    )
  );

revoke all on public.ticket_secrets from public;
grant select on public.ticket_secrets to authenticated;

-- ------------------------------------------------------------------
-- Génération : on enregistre aussi le numéro en clair pour que le
-- docteur puisse le réafficher sur la liste des tickets.
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

-- ------------------------------------------------------------------
-- Liste des tickets : ajoute le numéro d'enregistrement.
-- La fonction est réservée au docteur.
-- ------------------------------------------------------------------
drop function if exists public.list_tickets();

create function public.list_tickets()
returns table (
  code text,
  status text,
  series_used integer,
  created_at timestamptz,
  used_at timestamptz,
  last_login_at timestamptz,
  secret text
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
      t.created_at, t.used_at, t.last_login_at,
      (select s.secret from public.ticket_secrets s where s.code = t.code) as secret
    from public.tickets t
    order by t.code;
end;
$$;

revoke all on function public.list_tickets() from public;
grant execute on function public.list_tickets() to authenticated;
