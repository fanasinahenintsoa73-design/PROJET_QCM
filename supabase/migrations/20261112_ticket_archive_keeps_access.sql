-- Archiver un ticket ne doit pas casser le compte de l'étudiant.
-- L'archivage est une organisation côté docteur (le ticket sort des listes
-- actives, ses données sont conservées, on peut le réactiver) : le compte
-- continue de fonctionner normalement.
-- On retire donc :
--   1. le blocage de connexion dans record_ticket_login (raise 'archivé') ;
--   2. le filtre `archived_at is null` de my_ticket_info / my_ticket_status,
--      qui cachait le ticket à l'étudiant (plus de date d'expiration ni de type).

create or replace function public.record_ticket_login()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code text;
begin
  select t.code into v_code
  from public.tickets t
  where t.user_id = auth.uid();

  if v_code is null then
    return;
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
$function$;

create or replace function public.my_ticket_info()
returns table(status text, type text, expires_at timestamp with time zone)
language sql
security definer
set search_path to 'public'
as $function$
  select t.status, t.type, t.expires_at
  from public.tickets t
  where t.user_id = auth.uid()
  order by (t.archived_at is null) desc, t.created_at desc
  limit 1;
$function$;

create or replace function public.my_ticket_status()
returns text
language sql
security definer
set search_path to 'public'
as $function$
  select t.status from public.tickets t
  where t.user_id = auth.uid()
  order by (t.archived_at is null) desc, t.created_at desc
  limit 1;
$function$;

revoke all on function public.record_ticket_login() from public;
grant execute on function public.record_ticket_login() to authenticated;
revoke all on function public.my_ticket_info() from public;
grant execute on function public.my_ticket_info() to authenticated;
revoke all on function public.my_ticket_status() from public;
grant execute on function public.my_ticket_status() to authenticated;
