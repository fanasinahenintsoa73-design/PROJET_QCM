-- ============================================================
-- MEDQCM : le mois Anki part du LANCEMENT du ticket, pas de sa
-- création par le docteur.
--   - un ticket Anki naît sans échéance ;
--   - sa 1re connexion pose expires_at = now() + 1 mois ;
--   - les connexions suivantes ne déplacent plus l'échéance.
-- ============================================================

-- ------------------------------------------------------------------
-- 1. Génération : plus d'échéance posée à la création.
--    L'échéance sera posée à la première connexion de l'étudiant.
-- ------------------------------------------------------------------
create or replace function public.generate_tickets_typed(p_count integer, p_type text)
returns table (code text, secret text, type text)
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
  v_prefix text;
  i integer;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'professor'
  ) then
    raise exception 'Réservé au docteur.';
  end if;

  if p_type not in ('series', 'anki') then
    raise exception 'Type de ticket invalide.';
  end if;

  if p_count is null or p_count < 1 or p_count > 500 then
    raise exception 'Nombre de tickets invalide (1 à 500).';
  end if;

  v_prefix := case when p_type = 'anki' then 'ANKI' else 'PACES' end;

  select coalesce(max(case
      when t.code ~ ('^' || v_prefix || '[0-9]+$')
        then substring(t.code from length(v_prefix) + 1)::integer
    end), 0) + 1
    into v_start
  from public.tickets t;

  for i in 0 .. p_count - 1 loop
    v_num := v_start + i;
    v_code := v_prefix || lpad(v_num::text, 4, '0');

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
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_secret, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('first_name', v_prefix, 'last_name', lpad(v_num::text, 4, '0')),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '', '', '', '',
      now(), now()
    );

    insert into auth.identities (user_id, provider, provider_id, identity_data, created_at, updated_at)
    values (
      v_user_id, 'email', v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      now(), now()
    );

    update public.profiles
      set status = 'active', activated_at = now()
    where id = v_user_id;

    insert into public.subject_assignments (user_id, subject_id, started_at, expires_at)
    values (v_user_id, null, now(), now() + interval '100 years');

    -- Pas d'échéance ici : le mois d'Anki commence au lancement.
    insert into public.tickets (code, user_id, status, type, expires_at)
    values (v_code, v_user_id, 'available', p_type, null);

    insert into public.ticket_secrets (code, secret)
    values (v_code, v_secret);

    code := v_code;
    secret := v_secret;
    type := p_type;
    return next;
  end loop;
end;
$$;

revoke all on function public.generate_tickets_typed(integer, text) from public;
grant execute on function public.generate_tickets_typed(integer, text) to authenticated;

-- ------------------------------------------------------------------
-- 2. Connexion : la 1re connexion pose le mois d'utilisation.
--    Les expressions SET lisent l'ancienne ligne : `used_at is null`
--    est vrai uniquement à la première connexion.
-- ------------------------------------------------------------------
create or replace function public.record_ticket_login()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_archived_at timestamptz;
begin
  select t.code, t.archived_at into v_code, v_archived_at
  from public.tickets t
  where t.user_id = auth.uid();

  if v_code is null then
    return;
  end if;

  if v_archived_at is not null then
    raise exception 'Ce ticket est archivé.';
  end if;

  insert into public.ticket_logins (ticket_code, user_id)
  values (v_code, auth.uid());

  update public.tickets
    set status = case when status = 'available' then 'used' else status end,
        used_at = coalesce(used_at, now()),
        last_login_at = now(),
        expires_at = case
          when type = 'anki' and used_at is null then now() + interval '1 month'
          else expires_at
        end
  where code = v_code;
end;
$$;

revoke all on function public.record_ticket_login() from public;
grant execute on function public.record_ticket_login() to authenticated;

-- ------------------------------------------------------------------
-- 3. Tickets Anki déjà créés : on applique la nouvelle règle.
-- ------------------------------------------------------------------
-- Déjà lancés : 1 mois à partir de la première connexion.
update public.tickets
set expires_at = used_at + interval '1 month'
where type = 'anki'
  and used_at is not null
  and (expires_at is null or expires_at <> used_at + interval '1 month');

-- Jamais lancés : aucune échéance (elle sera posée au lancement).
update public.tickets
set expires_at = null
where type = 'anki'
  and used_at is null;
