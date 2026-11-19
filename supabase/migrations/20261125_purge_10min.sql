-- ---------------------------------------------------------------------------
-- Purge des comptes terminés : délai réduit à 10 min, cron chaque minute
-- ---------------------------------------------------------------------------
-- Le délai d'une heure laissait jusqu'à 1 h 10 d'attente réelle (cron horaire)
-- avant la destruction d'un compte terminé. On passe à 10 min d'inactivité et
-- à une vérification chaque minute.
--
-- La condition de destruction est désormais basée sur le QUOTA (30 séries
-- utilisées) et non plus sur le nombre de séries « terminées » : une série
-- abandonnée compte dans le quota mais pas dans le résumé, ce qui empêchait
-- la purge d'un compte ayant consommé ses 30 séries avec des abandonns.
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
  -- Le quota inclut les séries abandonnées : c'est le critère de fin de cycle.
  if public.series_quota_used(p_user_id) < 30 then
    return false;
  end if;

  select * into v_data from public.completed_ticket_data(p_user_id);

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

create or replace function public.purge_completed_accounts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_data record;
  v_last_activity timestamptz;
  v_deleted integer := 0;
begin
  for v_rec in
    select t.user_id, t.code
    from public.tickets t
    where public.series_quota_used(t.user_id) >= 30
  loop
    select * into v_data from public.completed_ticket_data(v_rec.user_id);

    -- Dernière activité connue du cycle : fin du résumé, sinon dernière série
    -- utilisée, sinon début du cycle. Cela couvre aussi les comptes dont toutes
    -- les séries sont abandonnées (résumé vide).
    select greatest(
      coalesce(v_data.completed_at, '-infinity'::timestamptz),
      coalesce(
        (select max(a.created_at) from public.attempts a where a.user_id = v_rec.user_id),
        '-infinity'::timestamptz
      ),
      coalesce(
        (select max(s.created_at) from public.series_consumptions s
          where s.user_id = v_rec.user_id and s.archived_at is null),
        '-infinity'::timestamptz
      ),
      coalesce(v_data.started_at, '-infinity'::timestamptz)
    ) into v_last_activity;

    if v_last_activity < now() - interval '10 minutes' then
      if public.finalize_completed_account_internal(v_rec.user_id, v_rec.code) then
        v_deleted := v_deleted + 1;
      end if;
    end if;
  end loop;
  return v_deleted;
end;
$$;

revoke all on function public.finalize_completed_account_internal(uuid, text) from public, anon, authenticated;
revoke all on function public.purge_completed_accounts() from public, anon, authenticated;

-- Le cron passe de toutes les heures à chaque minute.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-completed-accounts') then
    perform cron.unschedule('purge-completed-accounts');
  end if;
  perform cron.schedule(
    'purge-completed-accounts',
    '* * * * *',
    'select public.purge_completed_accounts()'
  );
end $$;
