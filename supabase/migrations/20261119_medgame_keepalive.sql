-- ============================================================================
-- MEDGAME — garder les parties actives vivantes tant que l'étudiant reste
-- dans MEDGAME (15 novembre 2026)
-- ============================================================================
-- Passer d'une UE à l'autre ne doit pas être interprété comme un abandon.
-- Un battement de cœur rafraîchit donc TOUTES les parties actives de
-- l'étudiant, et pas seulement celle en cours de jeu.
-- ============================================================================

create or replace function public.medgame_touch_runs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.medgame_runs
  set last_activity_at = now()
  where user_id = auth.uid()
    and status = 'in_progress';
end;
$$;

create or replace function public.medgame_heartbeat(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- Le battement doit porter sur une partie de l'étudiant.
  if not exists (
    select 1
    from public.medgame_runs r
    where r.id = p_run_id
      and r.user_id = auth.uid()
  ) then
    return;
  end if;

  -- Un battement garde vivres toutes les parties de l'étudiant : quitter une
  -- UE pour en ouvrir une autre n'est pas un abandon.
  perform public.medgame_touch_runs();
end;
$$;

revoke all on function public.medgame_touch_runs() from public, anon;
revoke all on function public.medgame_heartbeat(uuid) from public, anon;

grant execute on function public.medgame_touch_runs() to authenticated;
grant execute on function public.medgame_heartbeat(uuid) to authenticated;
