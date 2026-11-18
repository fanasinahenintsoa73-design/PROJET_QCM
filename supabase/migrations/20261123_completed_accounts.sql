-- ---------------------------------------------------------------------------
-- Fin de cycle : compte détruit, historique léger conservé côté docteur
-- ---------------------------------------------------------------------------
-- Un ticket = un compte vierge avec 30 séries. À la 30e série, l'étudiant
-- voit son résultat puis un écran final ; sa déconnexion (ou un nettoyage
-- automatique après 1 h) supprime le compte et toutes ses données.
-- Une trace anonyme est conservée dans `completed_ticket_history` pour le
-- docteur : une ligne par série, sans question, réponse ni snapshot.
-- ---------------------------------------------------------------------------

create table if not exists public.completed_ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_code text not null unique,
  student_label text not null,
  started_at timestamptz,
  completed_at timestamptz,
  deleted_at timestamptz not null default now(),
  -- [{date, kind: 'series'|'medgame', ue, chapters?, score?, total?, level?, correct?}]
  series_summary jsonb not null default '[]'::jsonb,
  average numeric(6, 2),
  created_at timestamptz not null default now()
);

alter table public.completed_ticket_history enable row level security;

-- ---------------------------------------------------------------------------
-- Résumé du cycle terminé (données lues avant la suppression du compte)
-- ---------------------------------------------------------------------------

create or replace function public.completed_ticket_data(p_user_id uuid)
returns table(summary jsonb, average numeric, completed_at timestamptz, started_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_series jsonb;
  v_medgame jsonb;
  v_summary jsonb;
  v_average numeric(6, 2);
  v_completed_at timestamptz;
begin
  v_start := public.current_cycle_start(p_user_id);

  select jsonb_agg(jsonb_build_object(
      'date', coalesce(a.completed_at, a.created_at),
      'kind', 'series',
      'ue', a.ue_id,
      'chapters', coalesce(a.chapter_ids, '{}'::text[]),
      'score', a.score,
      'total', a.total
    ) order by coalesce(a.completed_at, a.created_at))
    into v_series
  from public.attempts a
  where a.user_id = p_user_id
    and (v_start is null or a.created_at >= v_start)
    and (a.status = 'completed' or (a.status is null and a.completed_at is not null));

  select jsonb_agg(jsonb_build_object(
      'date', coalesce(r.ended_at, s.created_at),
      'kind', 'medgame',
      'ue', p.ue_id,
      'level', r.current_level,
      'correct', (select count(*) from public.medgame_run_answers ra
                   where ra.run_id = r.id and ra.is_correct),
      'total', (select count(*) from public.medgame_run_answers ra where ra.run_id = r.id)
    ) order by coalesce(r.ended_at, s.created_at))
    into v_medgame
  from public.series_consumptions s
  left join public.medgame_runs r on r.id = s.run_id
  left join public.medgame_progress p on p.id = r.progress_id
  where s.user_id = p_user_id
    and s.archived_at is null
    and (s.run_id is null or r.status = 'completed');

  select jsonb_agg(item order by (item->>'date')::timestamptz)
    into v_summary
  from jsonb_array_elements(coalesce(v_series, '[]'::jsonb) || coalesce(v_medgame, '[]'::jsonb)) as item;

  select round(avg(pct), 2)
    into v_average
  from (
    select (a.score::numeric / nullif(a.total, 0)) * 100 as pct
    from public.attempts a
    where a.user_id = p_user_id
      and (v_start is null or a.created_at >= v_start)
      and (a.status = 'completed' or (a.status is null and a.completed_at is not null))
    union all
    select ((select count(*) from public.medgame_run_answers ra
              where ra.run_id = r.id and ra.is_correct)::numeric
            / nullif((select count(*) from public.medgame_run_answers ra where ra.run_id = r.id), 0)) * 100
    from public.series_consumptions s
    join public.medgame_runs r on r.id = s.run_id and r.status = 'completed'
    where s.user_id = p_user_id and s.archived_at is null
  ) scores;

  select max((item->>'date')::timestamptz)
    into v_completed_at
  from jsonb_array_elements(coalesce(v_summary, '[]'::jsonb)) as item;

  return query select
    coalesce(v_summary, '[]'::jsonb),
    coalesce(v_average, 0),
    v_completed_at,
    coalesce(v_start, (select min(created_at) from public.attempts where user_id = p_user_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Destruction interne (utilisée par la déconnexion et par le nettoyage auto)
-- ---------------------------------------------------------------------------

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
  on conflict (ticket_code) do nothing;

  delete from auth.users where id = p_user_id;
  return true;
end;
$$;

-- Déclenché par l'étudiant au moment de la déconnexion.
create or replace function public.finalize_completed_account()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
begin
  if v_user_id is null then
    return false;
  end if;
  select t.code into v_code from public.tickets t where t.user_id = v_user_id;
  if v_code is null then
    return false;
  end if;
  return public.finalize_completed_account_internal(v_user_id, v_code);
end;
$$;

-- Filet de sécurité : détruit les comptes terminés même sans déconnexion.
create or replace function public.purge_completed_accounts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_data record;
  v_deleted integer := 0;
begin
  for v_rec in
    select t.user_id, t.code
    from public.tickets t
    where public.series_quota_used(t.user_id) >= 30
  loop
    select * into v_data from public.completed_ticket_data(v_rec.user_id);
    if coalesce(jsonb_array_length(v_data.summary), 0) >= 30
       and v_data.completed_at is not null
       and v_data.completed_at < now() - interval '1 hour'
    then
      if public.finalize_completed_account_internal(v_rec.user_id, v_rec.code) then
        v_deleted := v_deleted + 1;
      end if;
    end if;
  end loop;
  return v_deleted;
end;
$$;

-- ---------------------------------------------------------------------------
-- Historique docteur
-- ---------------------------------------------------------------------------

create or replace function public.list_completed_history()
returns table(
  id uuid, ticket_code text, student_label text, started_at timestamptz,
  completed_at timestamptz, deleted_at timestamptz, series_summary jsonb,
  average numeric, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_professor() then
    raise exception 'Réservé au docteur.' using errcode = '42501';
  end if;
  return query
    select h.id, h.ticket_code, h.student_label, h.started_at, h.completed_at,
           h.deleted_at, h.series_summary, h.average, h.created_at
    from public.completed_ticket_history h
    order by h.completed_at desc nulls last, h.created_at desc;
end;
$$;

create or replace function public.delete_completed_history(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_professor() then
    raise exception 'Réservé au docteur.' using errcode = '42501';
  end if;
  delete from public.completed_ticket_history where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Suppression manuelle d'un compte abandonné (< 30 séries)
-- ---------------------------------------------------------------------------

create or replace function public.delete_tickets(p_codes text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data record;
begin
  if not public.is_professor() then
    raise exception 'Réservé au docteur.' using errcode = '42501';
  end if;

  for v_data in
    select t.code, t.user_id
    from public.tickets t
    where t.code = any(p_codes)
  loop
    if coalesce(jsonb_array_length(
         (select d.summary from public.completed_ticket_data(v_data.user_id) d)
       ), 0) >= 30 then
      raise exception 'Un compte qui a terminé ses 30 séries est supprimé automatiquement.';
    end if;
  end loop;

  delete from auth.users
  where id in (select user_id from public.tickets where code = any(p_codes));
end;
$$;

-- ---------------------------------------------------------------------------
-- Retrait définitif du renouvellement
-- ---------------------------------------------------------------------------

drop function if exists public.renew_ticket(text);

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------

revoke all on function public.completed_ticket_data(uuid) from public, anon, authenticated;
revoke all on function public.finalize_completed_account_internal(uuid, text) from public, anon, authenticated;
revoke all on function public.purge_completed_accounts() from public, anon, authenticated;
revoke all on function public.finalize_completed_account() from public, anon;
grant execute on function public.finalize_completed_account() to authenticated;
revoke all on function public.list_completed_history() from public, anon;
revoke all on function public.delete_completed_history(uuid) from public, anon;
grant execute on function public.list_completed_history() to authenticated;
grant execute on function public.delete_completed_history(uuid) to authenticated;
