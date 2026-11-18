-- ---------------------------------------------------------------------------
-- Réutilisation des codes de tickets : tirage aléatoire parmi les codes libres
-- ---------------------------------------------------------------------------
-- Un compte terminé est supprimé : sa ligne `tickets` disparaît en cascade et
-- son code redevient libre. Au lieu de faire grandir indéfiniment le numéro
-- séquentiel (PACES15000…), on tire désormais au hasard un code à 4 chiffres
-- parmi les codes encore libres, avec nouvel essai en cas de collision.
--
-- La sécurisation reste inchangée : secret aléatoire en clair affiché une seule
-- fois au docteur, stocké haché (bcrypt) dans auth.users, génération réservée
-- au docteur. L'ancien secret meurt avec l'ancien compte.
--
-- L'historique `completed_ticket_history` accepte plusieurs lignes pour un même
-- code (un code réutilisé = un autre étudiant) : la clé devient (code, date de
-- fin) au lieu de (code) seul.
-- ---------------------------------------------------------------------------

-- Helper : tire un code PACES#### encore libre (4 chiffres = 10 000 codes).
create or replace function public.random_available_ticket_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bytes bytea;
  v_num integer;
  v_code text;
  v_try integer := 0;
begin
  loop
    v_try := v_try + 1;
    -- 2 octets cryptographiques -> nombre entre 0 et 9999.
    v_bytes := extensions.gen_random_bytes(2);
    v_num := ((get_byte(v_bytes, 0)::integer * 256) + get_byte(v_bytes, 1)::integer) % 10000;
    v_code := 'PACES' || lpad(v_num::text, 4, '0');

    exit when not exists (select 1 from public.tickets where code = v_code);

    if v_try >= 500 then
      raise exception 'Aucun code de ticket disponible.';
    end if;
  end loop;
  return v_code;
end;
$$;

revoke all on function public.random_available_ticket_code() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- generate_tickets : tirage aléatoire au lieu du numéro séquentiel
-- ---------------------------------------------------------------------------
create or replace function public.generate_tickets(p_count integer)
returns table (code text, secret text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_num integer;
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

  for i in 0 .. p_count - 1 loop
    -- Code aléatoire parmi les libres (réutilise les codes des comptes supprimés).
    v_code := public.random_available_ticket_code();
    v_num := substring(v_code from 6)::integer;

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
-- generate_tickets_typed : même tirage (c'est celui qu'utilise l'application)
-- ---------------------------------------------------------------------------
create or replace function public.generate_tickets_typed(p_count integer, p_type text)
returns table (code text, secret text, type text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_num integer;
  v_secret text;
  v_bytes bytea;
  v_user_id uuid;
  v_email text;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'professor'
  ) then
    raise exception 'Réservé au docteur.';
  end if;

  if p_type is distinct from 'series' then
    raise exception 'Type de ticket invalide.';
  end if;

  if p_count is null or p_count < 1 or p_count > 500 then
    raise exception 'Nombre de tickets invalide (1 à 500).';
  end if;

  for i in 1 .. p_count loop
    v_code := public.random_available_ticket_code();
    v_num := substring(v_code from 6)::integer;

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

    insert into public.tickets (code, user_id, status, type, expires_at)
    values (v_code, v_user_id, 'available', 'series', null);

    insert into public.ticket_secrets (code, secret)
    values (v_code, v_secret);

    code := v_code;
    secret := v_secret;
    type := 'series';
    return next;
  end loop;
end;
$$;

revoke all on function public.generate_tickets_typed(integer, text) from public;
grant execute on function public.generate_tickets_typed(integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Historique : un même code peut revenir plusieurs fois (un étudiant différent)
-- ---------------------------------------------------------------------------
alter table public.completed_ticket_history
  drop constraint if exists completed_ticket_history_ticket_code_key;

alter table public.completed_ticket_history
  add constraint completed_ticket_history_code_date_key unique (ticket_code, completed_at);

create or replace function public.finalize_completed_account_internal(
  p_user_id uuid, p_code text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data record;
begin
  select * into v_data from public.completed_ticket_data(p_user_id);
  if coalesce(jsonb_array_length(v_data.summary), 0) < 30 then
    return false;
  end if;

  insert into public.completed_ticket_history (
    ticket_code, student_label, started_at, completed_at, series_summary, average
  ) values (
    p_code, p_code, v_data.started_at, v_data.completed_at, v_data.summary, v_data.average
  )
  on conflict (ticket_code, completed_at) do nothing;

  delete from auth.users where id = p_user_id;
  return true;
end;
$$;

revoke all on function public.finalize_completed_account_internal(uuid, text) from public, anon, authenticated;
