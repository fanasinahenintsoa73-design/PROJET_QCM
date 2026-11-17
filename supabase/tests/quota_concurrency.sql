-- ===========================================================================
-- quota_concurrency.sql — test manuel du durcissement du quota (passe 1)
-- ===========================================================================
--
-- OBJECTIF
--   Vérifier que deux lancements de série simultanés ne peuvent pas dépasser
--   la limite de 30 séries. Sans le verrou ajouté dans start_quiz, ce test
--   échoue (31 séries). Avec le verrou, il passe (30 séries).
--
-- QUAND
--   Exécuter À LA MAIN après application de 20261117_quota_hardening.sql.
--   Ce test crée et supprime des données de démonstration : il ne doit JAMAIS
--   être inclus dans une migration ni exécuté automatiquement en production.
--
-- PRINCIPE
--   Deux sessions PostgreSQL distinctes, authentifiées comme le même étudiant
--   de test, appellent start_quiz en parallèle sur DEUX THÈMES DIFFÉRENTS
--   (obligatoire : avec le même thème, le mécanisme de reprise renverrait la
--   tentative in_progress au lieu de tester le quota).
--
--   La session A lance la 30e série et garde sa transaction ouverte 4 secondes
--   (verrou for update maintenu). La session B, lancée pendant ce temps, attend
--   le verrou, puis relit le compte à 30 et doit lever SERIES_LIMIT_REACHED.
--
--   Deux thèmes sont créés (A et B), chacun avec 10 questions.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Données de test (à exécuter une fois)
-- ---------------------------------------------------------------------------
-- Un étudiant fictif actif, deux thèmes de 10 questions, un cycle ouvert et
-- 29 séries déjà consommées : il ne reste qu'une seule série avant la limite.

do $$
declare
  v_user uuid := gen_random_uuid();
  v_subject_a uuid := gen_random_uuid();
  v_subject_b uuid := gen_random_uuid();
  i int;
begin
  insert into public.profiles (id, role, first_name, last_name, email, status)
  values (v_user, 'student', 'Quota', 'Test', 'quota_concurrency_test@medqcm.local', 'active');

  insert into public.subjects (id, title, month_label)
  values
    (v_subject_a, 'Test concurrence A', 'Test'),
    (v_subject_b, 'Test concurrence B', 'Test');

  for i in 1..10 loop
    insert into public.questions (subject_id, number, matiere, statement, options, correct_answers)
    values
      (v_subject_a, i, 'Test', 'Question A' || i,
       jsonb_build_object('A', 'a', 'B', 'b', 'C', 'c', 'D', 'd'), array['A']),
      (v_subject_b, i, 'Test', 'Question B' || i,
       jsonb_build_object('A', 'a', 'B', 'b', 'C', 'c', 'D', 'd'), array['A']);
  end loop;

  insert into public.subject_assignments (user_id, subject_id, started_at, expires_at)
  values (v_user, v_subject_a, now() - interval '1 hour', now() + interval '1 hour');

  -- 29 séries complétées, réparties sur le thème A.
  for i in 1..29 loop
    insert into public.attempts (
      user_id, subject_id, question_ids, answers, score, total, status, created_at
    )
    values (
      v_user, v_subject_a,
      array(select id from public.questions where subject_id = v_subject_a order by number limit 10),
      '{}'::jsonb, 0, 10, 'completed', now() - (30 - i) * interval '1 minute'
    );
  end loop;

  raise notice 'Données de test créées.';
end $$;

-- Récupérer les identifiants (à noter pour les sessions A et B).
select
  (select id from public.profiles where email = 'quota_concurrency_test@medqcm.local') as test_user,
  (select id from public.subjects where title = 'Test concurrence A') as subject_a,
  (select id from public.subjects where title = 'Test concurrence B') as subject_b;

-- ---------------------------------------------------------------------------
-- 2. Test de concurrence
-- ---------------------------------------------------------------------------
-- Remplacer <TEST_USER>, <SUBJECT_A>, <SUBJECT_B> par les ids affichés ci-dessus.
--
-- SESSION A — exécuter ce bloc en premier :
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claim.sub = '<TEST_USER>';
--   select public.start_quiz('<SUBJECT_A>'::uuid, 10);   -- lance la 30e série
--   select pg_sleep(4);                                  -- garde le verrou
--   commit;
--
-- SESSION B — lancer dans les 4 secondes qui suivent :
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claim.sub = '<TEST_USER>';
--   select public.start_quiz('<SUBJECT_B>'::uuid, 10);
--   commit;
--
-- RÉSULTAT ATTENDU
--   - Session A : réussite, une 30e tentative in_progress est créée.
--   - Session B : ERREUR « SERIES_LIMIT_REACHED » après la fin de A.
--   - Le compteur reste à 30, jamais 31 (voir vérification ci-dessous).
--
--   Sans le verrou de start_quiz, A et B liraient tous deux 29 et inséreraient
--   chacun une tentative : on finirait à 31 et le test échouerait.
--
-- NOTE
--   auth.uid() lit le claim JWT « sub ». Selon la version de Supabase, il peut
--   être nécessaire de poser aussi :
--     set local request.jwt.claims = '{"sub":"<TEST_USER>","role":"authenticated"}';
--   Si la session B renvoie ACCESS_EXPIRED au lieu d'attendre, c'est que le
--   claim n'est pas reconnu : ajouter cette ligne dans les deux sessions.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 3. Vérification (à exécuter après A et B)
-- ---------------------------------------------------------------------------
-- Doit renvoyer 30. Si c'est 31, le durcissement n'a pas fonctionné.
select count(*) as series_after_concurrency
from public.attempts a
where a.user_id = (
  select id from public.profiles where email = 'quota_concurrency_test@medqcm.local'
);

-- Le quota doit être atteint sans dépassement.
select public.series_quota_used(
  (select id from public.profiles where email = 'quota_concurrency_test@medqcm.local')
) as quota_after_concurrency;
-- Attendu : 30

-- ---------------------------------------------------------------------------
-- 4. Nettoyage (à exécuter enfin)
-- ---------------------------------------------------------------------------
-- La suppression du profil entraîne en cascade celle des attempts et de
-- l'assignment (foreign keys on delete cascade). Les thèmes et leurs questions
-- sont supprimés explicitement ensuite.
do $$
declare
  v_user uuid;
begin
  select id into v_user
  from public.profiles where email = 'quota_concurrency_test@medqcm.local';

  delete from public.subjects where title in ('Test concurrence A', 'Test concurrence B');
  delete from public.profiles where id = v_user;

  raise notice 'Nettoyage effectué.';
end $$;

-- Vérification finale : aucune donnée de test ne subsiste.
select count(*) as residual_test_profiles
from public.profiles where email = 'quota_concurrency_test@medqcm.local';
-- Attendu : 0
