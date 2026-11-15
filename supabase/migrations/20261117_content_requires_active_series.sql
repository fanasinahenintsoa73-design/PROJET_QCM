-- ============================================================================
-- Contenus réservés aux étudiants dont le cycle de 30 séries est encore actif
-- 15 novembre 2026
-- ============================================================================
-- L'interface bloque déjà les supports et les sujets concours dès que les
-- 30 séries sont terminées (RequireStudent redirige vers /expiration).
-- Cette migration applique la même règle côté serveur : un étudiant dont le
-- quota est épuisé ne peut plus lire les contenus, ni récupérer de lien
-- signé, même en appelant directement l'API.
-- Un renouvellement d'accès (renew_ticket) rouvre l'accès : nouvelle
-- affectation et consommations archivées.
-- ============================================================================

create or replace function public.has_series_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_active_access()
    and (
      select count(*)
      from public.attempts a
      where a.user_id = auth.uid()
        and a.created_at >= public.current_cycle_start(auth.uid())
    ) + (
      select count(*)
      from public.series_consumptions s
      where s.user_id = auth.uid()
        and s.archived_at is null
    ) < 30;
$$;

revoke all on function public.has_series_access() from public, anon;
grant execute on function public.has_series_access() to authenticated;

-- ---------------------------------------------------------------------------
-- Tables de contenus
-- ---------------------------------------------------------------------------

drop policy if exists "course_supports_read" on public.course_supports;
create policy "course_supports_read"
  on public.course_supports for select
  to authenticated
  using (public.is_professor() or public.has_series_access());

drop policy if exists "exam_subjects_read" on public.exam_subjects;
create policy "exam_subjects_read"
  on public.exam_subjects for select
  to authenticated
  using (public.is_professor() or public.has_series_access());

-- ---------------------------------------------------------------------------
-- Fichiers privés : plus de lien signé quand le cycle est terminé
-- ---------------------------------------------------------------------------

drop policy if exists "course_content_read" on storage.objects;
create policy "course_content_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'course-content'
    and (public.is_professor() or public.has_series_access())
  );
