-- Planification du nettoyage des comptes terminés (1 h après la 30e série).
-- Fichier séparé : sans pg_cron, le nettoyage reste déclenché à la déconnexion.

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-completed-accounts') then
    perform cron.unschedule('purge-completed-accounts');
  end if;
  perform cron.schedule(
    'purge-completed-accounts',
    '0 * * * *',
    'select public.purge_completed_accounts()'
  );
end $$;
