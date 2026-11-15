-- ============================================================
-- MEDQCM : les identifiants de ticket sont exclusivement PACES####.
--   - les tickets ANKI#### déjà émis sont renumérotés PACES#### ;
--   - la génération ne produit plus que des codes PACES ;
--   - la base refuse désormais tout identifiant hors format PACES.
--
-- Le numéro d'enregistrement (le secret) ne change pas : seul
-- l'identifiant d'accès est normalisé.
-- ============================================================

set search_path = public;

-- ------------------------------------------------------------------
-- 1. Correspondance ANKI#### -> PACES####
--    La numérotation continue celle des tickets PACES existants.
-- ------------------------------------------------------------------
create table if not exists public.ticket_code_migration (
  old_code text primary key,
  new_code text not null unique
);

insert into public.ticket_code_migration (old_code, new_code)
select
  t.code,
  'PACES' || lpad(
    (
      (
        select coalesce(max(substring(c.code from 6)::integer), 0)
        from public.tickets c
        where c.code ~ '^PACES[0-9]+$'
      )
      + row_number() over (order by t.code)
    )::text,
    4,
    '0'
  )
from public.tickets t
where t.code ~ '^ANKI[0-9]+$'
on conflict (old_code) do nothing;

-- ------------------------------------------------------------------
-- 2. Les clés étrangères suivent le renommage (ON UPDATE CASCADE).
--    Sans cela, la mise à jour de public.tickets.code échouerait.
-- ------------------------------------------------------------------
alter table public.ticket_secrets
  drop constraint if exists ticket_secrets_code_fkey;
alter table public.ticket_secrets
  add constraint ticket_secrets_code_fkey
  foreign key (code) references public.tickets (code)
  on delete cascade on update cascade;

alter table public.ticket_logins
  drop constraint if exists ticket_logins_ticket_code_fkey;
alter table public.ticket_logins
  add constraint ticket_logins_ticket_code_fkey
  foreign key (ticket_code) references public.tickets (code)
  on delete cascade on update cascade;

alter table public.anki_history
  drop constraint if exists anki_history_ticket_code_fkey;
alter table public.anki_history
  add constraint anki_history_ticket_code_fkey
  foreign key (ticket_code) references public.tickets (code)
  on delete cascade on update cascade;

alter table public.anki_level_progress
  drop constraint if exists anki_level_progress_ticket_code_fkey;
alter table public.anki_level_progress
  add constraint anki_level_progress_ticket_code_fkey
  foreign key (ticket_code) references public.tickets (code)
  on delete cascade on update cascade;

alter table public.anki_question_progress
  drop constraint if exists anki_question_progress_ticket_code_fkey;
alter table public.anki_question_progress
  add constraint anki_question_progress_ticket_code_fkey
  foreign key (ticket_code) references public.tickets (code)
  on delete cascade on update cascade;

alter table public.anki_review_cards
  drop constraint if exists anki_review_cards_ticket_code_fkey;
alter table public.anki_review_cards
  add constraint anki_review_cards_ticket_code_fkey
  foreign key (ticket_code) references public.tickets (code)
  on delete cascade on update cascade;

alter table public.anki_ticket_chapters
  drop constraint if exists anki_ticket_chapters_ticket_code_fkey;
alter table public.anki_ticket_chapters
  add constraint anki_ticket_chapters_ticket_code_fkey
  foreign key (ticket_code) references public.tickets (code)
  on delete cascade on update cascade;

-- Les tables de progression Anki référencent anki_ticket_chapters :
-- elles doivent suivre le renommage du code de ticket.
alter table public.anki_chapter_progress
  drop constraint if exists anki_chapter_progress_ticket_code_chapter_id_fkey;
alter table public.anki_chapter_progress
  add constraint anki_chapter_progress_ticket_code_chapter_id_fkey
  foreign key (ticket_code, chapter_id)
  references public.anki_ticket_chapters (ticket_code, chapter_id)
  on delete cascade on update cascade;

alter table public.anki_question_progress
  drop constraint if exists anki_question_progress_ticket_code_chapter_id_fkey;
alter table public.anki_question_progress
  add constraint anki_question_progress_ticket_code_chapter_id_fkey
  foreign key (ticket_code, chapter_id)
  references public.anki_ticket_chapters (ticket_code, chapter_id)
  on delete cascade on update cascade;

-- ------------------------------------------------------------------
-- 3. Renommage des tickets (les tables filles suivent en cascade).
-- ------------------------------------------------------------------
update public.tickets t
set code = m.new_code
from public.ticket_code_migration m
where t.code = m.old_code;

-- ------------------------------------------------------------------
-- 4. Identité de connexion : e-mail dérivé du nouvel identifiant.
--    L'email de connexion d'un ticket est lower(code)@ticket.medqcm.
-- ------------------------------------------------------------------
update auth.users u
set email = lower(m.new_code) || '@ticket.medqcm',
    raw_user_meta_data = jsonb_set(
      jsonb_set(
        coalesce(u.raw_user_meta_data, '{}'::jsonb),
        '{first_name}',
        to_jsonb('PACES'::text),
        true
      ),
      '{last_name}',
      to_jsonb(substring(m.new_code from 6)::text),
      true
    ),
    updated_at = now()
from public.ticket_code_migration m
join public.tickets t on t.code = m.new_code
where u.id = t.user_id;

-- auth.identities.email est une colonne générée depuis identity_data.
update auth.identities i
set identity_data = jsonb_set(
      coalesce(i.identity_data, '{}'::jsonb),
      '{email}',
      to_jsonb(lower(m.new_code) || '@ticket.medqcm'::text),
      true
    ),
    updated_at = now()
from public.ticket_code_migration m
join public.tickets t on t.code = m.new_code
where i.user_id = t.user_id;

update public.profiles p
set email = lower(m.new_code) || '@ticket.medqcm',
    first_name = 'PACES',
    last_name = substring(m.new_code from 6)
from public.ticket_code_migration m
join public.tickets t on t.code = m.new_code
where p.id = t.user_id;

-- ------------------------------------------------------------------
-- 5. Verrous : plus aucun identifiant hors PACES, un seul type.
-- ------------------------------------------------------------------
alter table public.tickets
  drop constraint if exists tickets_code_paces_check;
alter table public.tickets
  add constraint tickets_code_paces_check
  check (code ~ '^PACES[0-9]{4,}$');

alter table public.tickets
  drop constraint if exists tickets_type_check;
alter table public.tickets
  add constraint tickets_type_check
  check (type = 'series');

drop table if exists public.ticket_code_migration;

-- ------------------------------------------------------------------
-- 6. Génération : uniquement des tickets PACES.
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
  v_prefix constant text := 'PACES';
  i integer;
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
