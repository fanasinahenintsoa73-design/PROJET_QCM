-- Quota MEDGAME : la série consommée doit se voir immédiatement.
--
-- `medgame_abandon` consommait déjà la série (appel à `medgame_consume`) mais
-- ne renvoyait rien : le client ne pouvait donc pas rafraîchir son compteur
-- sans recharger toute la page. La fonction renvoie désormais le quota à
-- jour, comme le fait déjà `medgame_submit_level`.

-- PostgreSQL interdit de changer le type de retour d'une fonction existante :
-- on la supprime avant de la recréer.
drop function if exists public.medgame_abandon(uuid);

create or replace function public.medgame_abandon(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.medgame_runs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select *
  into v_run
  from public.medgame_runs
  where id = p_run_id and user_id = auth.uid();

  if not found or v_run.status <> 'in_progress' then
    -- Run déjà_closed : le quota reste inchangé, on le renvoie quand même.
    return public.medgame_quota_json();
  end if;

  update public.medgame_runs
  set status = 'abandoned',
      ended_at = now(),
      last_activity_at = now()
  where id = p_run_id;

  perform public.medgame_consume(p_run_id, 'abandonment');

  return public.medgame_quota_json();
end;
$$;

revoke all on function public.medgame_abandon(uuid) from public, anon;
grant execute on function public.medgame_abandon(uuid) to authenticated;
