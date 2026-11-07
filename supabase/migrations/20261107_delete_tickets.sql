-- ============================================================
-- MEDQCM : suppression de tickets (docteur uniquement)
-- ============================================================
--
-- delete_tickets supprime les comptes des tickets choisis. La
-- suppression du compte auth entraîne en cascade la suppression du
-- profil, du ticket, des assignations, des séries et des avis.

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

  delete from auth.users
  where id in (select user_id from public.tickets where code = any (p_codes));
end;
$$;

revoke all on function public.delete_tickets(text[]) from public;
grant execute on function public.delete_tickets(text[]) to authenticated;
