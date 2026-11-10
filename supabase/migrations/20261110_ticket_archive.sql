-- ============================================================
-- MEDQCM : archivage des tickets, dernière activité,
-- suppression limitée aux tickets jamais utilisés.
-- ============================================================

alter table public.tickets
  add column if not exists archived_at timestamptz;

-- ------------------------------------------------------------------
-- Liste des tickets : ajoute archived_at et last_activity_at.
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
      (select count(*)::integer from public.attempts a where a.user_id = t.user_id) as series_used,
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
        (select max(h.created_at) from public.anki_history h where h.ticket_code = t.code)
      ) as last_activity_at
    from public.tickets t
    order by t.code;
end;
$$;

revoke all on function public.list_tickets() from public;
grant execute on function public.list_tickets() to authenticated;

-- ------------------------------------------------------------------
-- Archiver / désarchiver des tickets (docteur uniquement).
-- ------------------------------------------------------------------
create or replace function public.archive_tickets(p_codes text[])
returns void
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

  if p_codes is null or cardinality(p_codes) = 0 then
    return;
  end if;

  update public.tickets
    set archived_at = coalesce(archived_at, now())
  where code = any (p_codes);
end;
$$;

create or replace function public.unarchive_tickets(p_codes text[])
returns void
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

  if p_codes is null or cardinality(p_codes) = 0 then
    return;
  end if;

  update public.tickets
    set archived_at = null
  where code = any (p_codes);
end;
$$;

revoke all on function public.archive_tickets(text[]) from public;
revoke all on function public.unarchive_tickets(text[]) from public;
grant execute on function public.archive_tickets(text[]) to authenticated;
grant execute on function public.unarchive_tickets(text[]) to authenticated;

-- ------------------------------------------------------------------
-- Suppression : seulement un ticket jamais utilisé.
-- ------------------------------------------------------------------
create or replace function public.delete_tickets(p_codes text[])
returns void
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

  if p_codes is null or cardinality(p_codes) = 0 then
    return;
  end if;

  if exists (
    select 1
    from public.tickets t
    where t.code = any (p_codes)
      and (
        t.used_at is not null
        or exists (select 1 from public.attempts a where a.user_id = t.user_id)
        or exists (select 1 from public.anki_ticket_chapters c where c.ticket_code = t.code)
      )
  ) then
    raise exception 'Un ticket déjà utilisé ne peut pas être supprimé. Archive-le à la place.';
  end if;

  delete from auth.users
  where id in (select user_id from public.tickets where code = any (p_codes));
end;
$$;

revoke all on function public.delete_tickets(text[]) from public;
grant execute on function public.delete_tickets(text[]) to authenticated;

-- ------------------------------------------------------------------
-- Un ticket archivé ne peut plus changer de statut.
-- ------------------------------------------------------------------
create or replace function public.set_ticket_status(p_code text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used_at timestamptz;
  v_archived_at timestamptz;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'professor'
  ) then
    raise exception 'Réservé au docteur.';
  end if;

  if p_status not in ('suspended', 'active') then
    raise exception 'Statut invalide.';
  end if;

  select used_at, archived_at into v_used_at, v_archived_at
  from public.tickets where code = p_code;

  if not found then
    raise exception 'Ticket introuvable.';
  end if;

  if v_archived_at is not null then
    raise exception 'Désarchive le ticket avant de changer son statut.';
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
-- Connexion : un ticket archivé est refusé.
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
        last_login_at = now()
  where code = v_code;
end;
$$;

revoke all on function public.record_ticket_login() from public;
grant execute on function public.record_ticket_login() to authenticated;

-- ------------------------------------------------------------------
-- Les informations du ticket connecté ignorent les tickets archivés.
-- ------------------------------------------------------------------
create or replace function public.my_ticket_info()
returns table (status text, type text, expires_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select t.status, t.type, t.expires_at
  from public.tickets t
  where t.user_id = auth.uid()
    and t.archived_at is null
  limit 1;
$$;

revoke all on function public.my_ticket_info() from public;
grant execute on function public.my_ticket_info() to authenticated;

create or replace function public.my_ticket_status()
returns text
language sql
security definer
set search_path = public
as $$
  select t.status from public.tickets t
  where t.user_id = auth.uid()
    and t.archived_at is null;
$$;

revoke all on function public.my_ticket_status() from public;
grant execute on function public.my_ticket_status() to authenticated;
