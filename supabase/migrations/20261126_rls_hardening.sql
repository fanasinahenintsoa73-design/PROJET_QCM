-- ============================================================
-- MEDQCM : durcissement RLS après l'alerte de sécurité Supabase.
-- 26 novembre 2026
--
-- Une seule table créée sans RLS est encore présente :
--   * public.anki_level_progress (20261112_medgame_levels.sql)
--
-- public.ticket_code_migration a aussi été créée sans RLS, mais
-- elle est normalement supprimée par 20261115_ticket_codes_paces_only.sql.
-- On la couvre quand même au cas où elle existerait encore dans un
-- environnement où cette migration n'aurait pas été jouée.
--
-- L'application n'accède jamais directement à ces tables : tout
-- passe par des fonctions SECURITY DEFINER (anki_levels,
-- anki_record_level, anki_chapters...) dont l'exécution est
-- réservée à "authenticated". Activer le RLS sans créer de policy
-- (donc refus par défaut) ne casse donc aucune fonctionnalité.
--
-- Ne PAS ajouter FORCE ROW LEVEL SECURITY : les fonctions
-- SECURITY DEFINER doivent continuer à agir en tant que propriétaire.
--
-- À exécuter dans le SQL Editor Supabase (aucune migration n'est
--lancée automatiquement par le dépôt).
-- ============================================================

begin;

-- 1) Progression MEDGAME par niveau.
alter table public.anki_level_progress
  enable row level security;

revoke all on table public.anki_level_progress from public, anon, authenticated;

-- 2) Table de migration ANKI -> PACES, si elle existe encore.
do $$
begin
  if to_regclass('public.ticket_code_migration') is not null then
    execute 'alter table public.ticket_code_migration enable row level security';
    execute 'revoke all on table public.ticket_code_migration from public, anon, authenticated';
  end if;
end $$;

commit;

-- Vérification : la requête suivante ne doit rien renvoyer.
-- select schemaname, tablename
-- from pg_tables
-- where schemaname = 'public'
--   and not rowsecurity
-- order by tablename;
