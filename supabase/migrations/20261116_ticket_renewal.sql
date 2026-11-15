-- ============================================================================
-- Renouvellement d'accès d'un ticket
-- 16 novembre 2026
-- ============================================================================
-- Quand l'identifiant d'un ticket est épuisé (30 séries terminées) ou
-- expiré, le docteur renouvelle l'accès :
--
--   - l'ID (PACES####) est conservé : l'étudiant garde son identifiant ;
--   - un NOUVEAU numéro d'enregistrement est généré : l'ancien numéro ne
--     fonctionne plus (mot de passe réécrit dans auth.users) ;
--   - les 30 séries repartent de zéro (nouveau cycle d'affectation, les
--     consommations MEDGAME du cycle précédent sont archivées).
--
-- L'historique reste lisible : les séries Pres Concours, les runs MEDGAME et
-- les consommations du cycle précédent sont conservés, simplement hors quota.
-- ============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. Cycle : les consommations MEDGAME archivées ne comptent plus
-- ---------------------------------------------------------------------------

alter table public.series_consumptions
  add column if not exists archived_at timestamptz;

create index if not exists series_consumptions_cycle_idx
  on public.series_consumptions (user_id, archived_at, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Début du cycle courant d'un étudiant
-- ---------------------------------------------------------------------------
-- Assignation active si elle existe, sinon la plus récente. C'est la même
-- règle que le mode démonstration (`getCurrentAssignment`).

create or replace function public.current_cycle_start(p_user_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select a.started_at
      from public.subject_assignments a
      where a.user_id = p_user_id
        and a.started_at <= now()
        and a.expires_at > now()
      order by a.started_at desc
      limit 1
    ),
    (
      select max(a.started_at)
      from public.subject_assignments a
      where a.user_id = p_user_id
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Quota MEDGAME : ne compter que les consommations du cycle courant
-- ---------------------------------------------------------------------------

create or replace function public.medgame_quota_json()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_attempts integer;
  v_medgame integer;
  v_used integer;
begin
  v_start := public.current_cycle_start(auth.uid());

  select count(*)
  into v_attempts
  from public.attempts a
  where a.user_id = auth.uid()
    and (v_start is null or a.created_at >= v_start);

  select count(*)
  into v_medgame
  from public.series_consumptions s
  where s.user_id = auth.uid()
    and s.archived_at is null;

  v_used := v_attempts + v_medgame;

  return jsonb_build_object(
    'used', v_used,
    'limit', 30,
    'remaining', greatest(0, 30 - v_used),
    'reached', v_used >= 30
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Quota partagé : même règle pour les séries Pres Concours
-- ---------------------------------------------------------------------------

create or replace function public.enforce_shared_series_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_used integer;
begin
  v_start := public.current_cycle_start(new.user_id);

  if v_start is null then
    return new;
  end if;

  select count(*)
  into v_used
  from public.attempts a
  where a.user_id = new.user_id
    and a.created_at >= v_start;

  select v_used + count(*)
  into v_used
  from public.series_consumptions s
  where s.user_id = new.user_id
    and s.archived_at is null;

  if v_used >= 30 then
    raise exception 'SERIES_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Liste des tickets : la progression affichée est celle du cycle courant
-- ---------------------------------------------------------------------------

create or replace function public.list_tickets()
returns table(
  code text,
  status text,
  series_used integer,
  created_at timestamptz,
  used_at timestamptz,
  last_login_at timestamptz,
  secret text,
  type text,
  expires_at timestamptz,
  anki_chapters integer,
  anki_completed integer,
  archived_at timestamptz,
  last_activity_at timestamptz
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
      (
        (
          select count(*)::integer
          from public.attempts a
          where a.user_id = t.user_id
            and (
              public.current_cycle_start(t.user_id) is null
              or a.created_at >= public.current_cycle_start(t.user_id)
            )
        )
        + (
          select count(*)::integer
          from public.series_consumptions s
          where s.user_id = t.user_id
            and s.archived_at is null
        )
      ) as series_used,
      t.created_at, t.used_at, t.last_login_at,
      (select s.secret from public.ticket_secrets s where s.code = t.code) as secret,
      t.type, t.expires_at,
      (select count(*)::integer from public.anki_ticket_chapters c where c.ticket_code = t.code) as anki_chapters,
      (select count(*)::integer from public.anki_chapter_progress p
        where p.ticket_code = t.code and p.completed_at is not null) as anki_completed,
      t.archived_at,
      greatest(
        t.last_login_at,
        t.used_at,
        t.created_at,
        (select max(a.created_at) from public.attempts a where a.user_id = t.user_id),
        (select max(s.created_at) from public.series_consumptions s
          where s.user_id = t.user_id and s.archived_at is null),
        (select max(h.created_at) from public.anki_history h where h.ticket_code = t.code)
      ) as last_activity_at
    from public.tickets t
    order by t.code;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Renouvellement d'un ticket (docteur uniquement)
-- ---------------------------------------------------------------------------

create or replace function public.renew_ticket(p_code text)
returns table(code text, secret text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets%rowtype;
  v_user_id uuid;
  v_new_secret text;
begin
  if not public.is_professor() then
    raise exception 'Réservé au docteur.' using errcode = '42501';
  end if;

  if p_code is null or btrim(p_code) = '' then
    raise exception 'Ticket introuvable.' using errcode = 'P0001';
  end if;

  select t.*
  into v_ticket
  from public.tickets t
  where t.code = p_code;

  if not found then
    raise exception 'Ticket introuvable.' using errcode = 'P0001';
  end if;

  if v_ticket.archived_at is not null then
    raise exception 'Désarchive le ticket avant de le renouveler.' using errcode = 'P0001';
  end if;

  v_user_id := v_ticket.user_id;

  -- Nouveau numéro d'enregistrement : 6 chiffres + 3 lettres mélangés.
  select string_agg(pick, '' order by rnd)
    into v_new_secret
  from (
    select substring('0123456789' from 1 + floor(random() * 10)::integer for 1) as pick,
           random() as rnd
      from generate_series(1, 6)
    union all
    select substring('ABCDEFGHIJKLMNOPQRSTUVWXYZ' from 1 + floor(random() * 26)::integer for 1) as pick,
           random() as rnd
      from generate_series(1, 3)
  ) shuffled;

  -- L'ancien numéro est remplacé : il ne fonctionne plus.
  update public.ticket_secrets ts
    set secret = v_new_secret
    where ts.code = p_code;

  if not found then
    insert into public.ticket_secrets (code, secret)
    values (p_code, v_new_secret);
  end if;

  update auth.users
    set encrypted_password = extensions.crypt(v_new_secret, extensions.gen_salt('bf')),
        updated_at = now()
    where id = v_user_id;

  -- Nouveau cycle : les consommations MEDGAME précédentes sont archivées.
  update public.series_consumptions
    set archived_at = now()
    where user_id = v_user_id
      and archived_at is null;

  -- Le parcours MEDGAME en cours est refermé : l'étudiant repart au niveau 1.
  update public.medgame_progress
    set status = 'archived', updated_at = now()
    where user_id = v_user_id
      and status = 'active';

  update public.medgame_runs
    set status = 'abandoned', ended_at = now(), last_activity_at = now()
    where user_id = v_user_id
    and status = 'in_progress';

  -- Nouvelle affectation : les séries repartent de zéro.
  insert into public.subject_assignments (user_id, subject_id, started_at, expires_at)
  values (v_user_id, null, now(), now() + interval '100 years');

  update public.tickets t
    set status = 'used'
    where t.code = p_code;

  return query select p_code, v_new_secret;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Droits
-- ---------------------------------------------------------------------------

revoke all on function public.current_cycle_start(uuid) from public, anon;
revoke all on function public.medgame_quota_json() from public, anon;
revoke all on function public.enforce_shared_series_quota() from public, anon;
revoke all on function public.list_tickets() from public, anon;
revoke all on function public.renew_ticket(text) from public, anon;

grant execute on function public.current_cycle_start(uuid) to authenticated;
grant execute on function public.medgame_quota_json() to authenticated;
grant execute on function public.list_tickets() to authenticated;
grant execute on function public.renew_ticket(text) to authenticated;
