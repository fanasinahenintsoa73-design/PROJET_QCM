-- ===========================================================================
-- 20261117_quota_hardening.sql
-- Passe 1 du durcissement de sécurité : quota de 30 séries non contournable.
--
-- Objectif : empêcher qu'un lancement concurrent (deux onglets, deux appareils,
-- deux requêtes parallèles) fasse dépasser la limite de 30 séries partagées.
--
-- Aucun changement visible pour l'étudiant : aucun texte, bouton, écran, délai
-- ou déconnexion ne change. Seul le cas d'attaque voit une différence : au lieu
-- de passer à 31 séries, il reçoit le message SERIES_LIMIT_REACHED existant.
--
-- Cette migration ne modifie le schéma d'aucune table : elle ne touche que des
-- fonctions. Aucune donnée existante n'est altérée.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Fonction de comptage centralisée
-- ---------------------------------------------------------------------------
-- Une seule définition de « série utilisée » pour toute l'application :
--   attempts du cycle courant + consommations MEDGAME non archivées.
-- p_skip_attempt_id exclut une tentative en cours du décompte (utilisé par
-- submit_attempt pour ne pas bloquer la soumission de la 30e série).

create or replace function public.series_quota_used(
  p_user_id uuid,
  p_skip_attempt_id uuid default null
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_attempts integer;
  v_medgame integer;
begin
  v_start := public.current_cycle_start(p_user_id);

  select count(*)
  into v_attempts
  from public.attempts a
  where a.user_id = p_user_id
    and (v_start is null or a.created_at >= v_start)
    and (p_skip_attempt_id is null or a.id <> p_skip_attempt_id);

  select count(*)
  into v_medgame
  from public.series_consumptions s
  where s.user_id = p_user_id
    and s.archived_at is null;

  return v_attempts + v_medgame;
end;
$$;

revoke all on function public.series_quota_used(uuid, uuid) from public, anon;
grant execute on function public.series_quota_used(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. medgame_quota_json : utiliser la fonction centralisée
-- ---------------------------------------------------------------------------

create or replace function public.medgame_quota_json()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  v_used := public.series_quota_used(auth.uid());

  return jsonb_build_object(
    'used', v_used,
    'limit', 30,
    'remaining', greatest(0, 30 - v_used),
    'reached', v_used >= 30
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Trigger de quota : utiliser la fonction centralisée
-- ---------------------------------------------------------------------------
-- Dernière ligne de défense pour toute insertion d'attempts qui ne passerait
-- pas par start_quiz. Le verrou est porté par les RPC (start_quiz ci-dessous,
-- submit_attempt déjà existant) ; ce trigger reste sans verrou propre, comme
-- aujourd'hui, mais le contrôle applicatif sérialisé l'enveloppe.

create or replace function public.enforce_shared_series_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  if public.current_cycle_start(new.user_id) is null then
    return new;
  end if;

  v_used := public.series_quota_used(new.user_id);

  if v_used >= 30 then
    raise exception 'SERIES_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. start_quiz : verrou + fonction centralisée
-- ---------------------------------------------------------------------------
-- Deux ajouts par rapport à la version 20261120 :
--   a) perform ... for update sur la ligne profil AVANT le comptage, pour
--      sérialiser les lancements concurrents (submit_attempt a déjà ce verrou).
--   b) le comptage passe par series_quota_used, ce qui inclut désormais les
--      séries MEDGAME comme le fait le quota réel (divergence corrigée).
--
-- Le reste du corps est identique à la version 20261120.

create or replace function public.start_quiz(p_subject_id uuid, p_count integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series_limit constant integer := 30;
  v_series_size constant integer := 10;
  v_subject public.subjects%rowtype;
  v_assignment_id uuid;
  v_assignment_started_at timestamptz;
  v_assignment_expires_at timestamptz;
  v_used integer;
  v_available integer;
  v_questions jsonb;
  v_snapshot jsonb;
  v_question_ids uuid[];
  v_attempt_id uuid;
  v_count integer := greatest(1, least(coalesce(p_count, 10), v_series_size));
begin
  if not public.has_active_access() then
    raise exception 'ACCESS_EXPIRED' using errcode = 'P0001';
  end if;

  select a.id, a.started_at, a.expires_at
  into v_assignment_id, v_assignment_started_at, v_assignment_expires_at
  from public.subject_assignments a
  where a.user_id = auth.uid()
    and a.started_at <= now()
    and a.expires_at > now()
  order by a.started_at desc
  limit 1;

  if not found then
    raise exception 'ACCESS_EXPIRED' using errcode = 'P0001';
  end if;

  -- Verrou de sérialisation : un seul lancement à la fois par étudiant.
  perform 1 from public.profiles where id = auth.uid() for update;

  select s.* into v_subject
  from public.subjects s
  where s.id = p_subject_id
    and not s.archived;

  if not found then
    raise exception 'THEME_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Reprise après rafraîchissement : la série déjà ouverte est renvoyée
  -- telle quelle, sans consommer une nouvelle série.
  select a.id
  into v_attempt_id
  from public.attempts a
  where a.user_id = auth.uid()
    and a.subject_id = p_subject_id
    and a.status = 'in_progress'
    and a.ue_id is null
  order by a.created_at desc
  limit 1;

  if v_attempt_id is not null then
    select jsonb_agg(elem - 'correctAnswers' - 'explanation' order by ordinality)
    into v_questions
    from jsonb_array_elements(
      (select a.question_snapshot from public.attempts a where a.id = v_attempt_id)
    ) with ordinality as t(elem, ordinality);

    return jsonb_build_object(
      'attemptId', v_attempt_id,
      'assignmentId', v_assignment_id,
      'assignmentExpiresAt', v_assignment_expires_at,
      'subject', jsonb_build_object(
        'id', v_subject.id,
        'title', v_subject.title,
        'description', v_subject.description,
        'monthLabel', v_subject.month_label,
        'publishedAt', v_subject.published_at,
        'questionCount', v_subject.question_count
      ),
      'questions', coalesce(v_questions, '[]'::jsonb)
    );
  end if;

  -- Comptage centralisé (inclut MEDGAME, sous le verrou posé plus haut).
  v_used := public.series_quota_used(auth.uid());

  if v_used >= v_series_limit then
    raise exception 'SERIES_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  select count(*)
  into v_available
  from public.questions
  where subject_id = v_subject.id
    and coalesce(array_length(correct_answers, 1), 0) = 1;

  if v_available < v_series_size then
    raise exception 'THEME_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Le corrigé est figé avec la tentative : une modification ultérieure du
  -- thème ne change ni le score ni la correction affichée.
  with selected as (
    select id, number, matiere, statement, options, correct_answers, explanation
    from public.questions
    where subject_id = v_subject.id
      and coalesce(array_length(correct_answers, 1), 0) = 1
    order by random()
    limit v_count
  ),
  frozen as (
    select
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'number', number,
          'matiere', matiere,
          'statement', statement,
          'options', options,
          'correctAnswers', correct_answers,
          'explanation', explanation
        )
        order by number
      ) as snapshot,
      array_agg(id order by number) as question_ids,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'number', number,
          'matiere', matiere,
          'statement', statement,
          'options', options
        )
        order by number
      ) as questions
    from selected
  )
  select snapshot, question_ids, questions
  into v_snapshot, v_question_ids, v_questions
  from frozen;

  insert into public.attempts (
    user_id, subject_id, question_ids, answers, question_snapshot,
    score, total, status
  )
  values (
    auth.uid(), p_subject_id, v_question_ids, '{}'::jsonb,
    coalesce(v_snapshot, '[]'::jsonb), 0, v_count, 'in_progress'
  )
  returning id into v_attempt_id;

  return jsonb_build_object(
    'attemptId', v_attempt_id,
    'assignmentId', v_assignment_id,
    'assignmentExpiresAt', v_assignment_expires_at,
    'subject', jsonb_build_object(
      'id', v_subject.id,
      'title', v_subject.title,
      'description', v_subject.description,
      'monthLabel', v_subject.month_label,
      'publishedAt', v_subject.published_at,
      'questionCount', v_subject.question_count
    ),
    'questions', coalesce(v_questions, '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. submit_attempt : comptage centralisé
-- ---------------------------------------------------------------------------
-- Le verrou existe déjà (perform ... for update, L251 de la version 20261120).
-- Seul le comptage change : il passe par series_quota_used avec la tentative
-- en cours exclue via p_skip_attempt_id. Cela inclut désormais les séries
-- MEDGAME dans le contrôle, comme le quota réel, sans changer le comportement
-- pour un étudiant honnête.
--
-- La récupération de l'id de la tentative ouverte est extraite dans une
-- variable réutilisable, afin de passer p_skip_attempt_id et de garder la
-- mise à jour / l'insertion de la tentative alignés sur le même id.

create or replace function public.submit_attempt(
  p_subject_id uuid,
  p_question_ids uuid[],
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series_limit constant integer := 30;
  v_series_size constant integer := 10;
  v_total integer;
  v_score integer;
  v_attempt_id uuid;
  v_current_attempt_id uuid;
  v_assignment_started_at timestamptz;
  v_assignment_expires_at timestamptz;
  v_used integer;
  v_question_snapshot jsonb;
begin
  if not public.has_active_access() then
    raise exception 'ACCESS_EXPIRED' using errcode = 'P0001';
  end if;

  -- Sérialise les envois concurrents (déjà présent en production).
  perform 1 from public.profiles where id = auth.uid() for update;

  select a.started_at, a.expires_at
  into v_assignment_started_at, v_assignment_expires_at
  from public.subject_assignments a
  where a.user_id = auth.uid()
    and a.started_at <= now()
    and a.expires_at > now()
  order by a.started_at desc
  limit 1;

  if v_assignment_started_at is null then
    raise exception 'ACCESS_EXPIRED' using errcode = 'P0001';
  end if;

  -- Tentative ouverte au lancement, exclue du décompte (elle compte déjà).
  select a.id
  into v_current_attempt_id
  from public.attempts a
  where a.user_id = auth.uid()
    and a.subject_id = p_subject_id
    and a.status = 'in_progress'
    and a.ue_id is null
  order by a.created_at desc
  limit 1;

  -- Comptage centralisé, tentative en cours exclue.
  v_used := public.series_quota_used(auth.uid(), v_current_attempt_id);

  if v_used >= v_series_limit then
    raise exception 'SERIES_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.subjects s
    where s.id = p_subject_id
      and not s.archived
  ) then
    raise exception 'THEME_NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_question_ids is null
     or cardinality(p_question_ids) <> v_series_size then
    raise exception 'INVALID_QUESTION_SET' using errcode = 'P0001';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'INVALID_ANSWERS' using errcode = 'P0001';
  end if;

  if cardinality(p_question_ids) <>
     (select count(distinct x) from unnest(p_question_ids) as t(x)) then
    raise exception 'DUPLICATE_QUESTIONS' using errcode = 'P0001';
  end if;

  select count(*)
  into v_total
  from public.questions
  where subject_id = p_subject_id
    and id = any (p_question_ids);

  if v_total <> cardinality(p_question_ids) then
    raise exception 'INVALID_QUESTION_SET' using errcode = 'P0001';
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'id', q.id,
             'number', q.number,
             'matiere', q.matiere,
             'statement', q.statement,
             'options', q.options,
             'correctAnswers', q.correct_answers,
             'explanation', q.explanation
           )
           order by q.number
         )
  into v_question_snapshot
  from public.questions q
  where q.id = any (p_question_ids);

  -- Comparaison ensembliste : l'ordre des lettres et des réponses n'importe pas,
  -- mais une réponse partielle (A au lieu de A+C) est fausse.
  select count(*)
  into v_score
  from public.questions q
  where q.id = any (p_question_ids)
    and coalesce(
      (
        select array_agg(answer_letter order by answer_letter)
        from jsonb_array_elements_text(
          coalesce(p_answers -> q.id::text, '[]'::jsonb)
        ) as selected(answer_letter)
      ),
      '{}'::text[]
    ) = (
      select coalesce(array_agg(correct_letter order by correct_letter), '{}'::text[])
      from unnest(q.correct_answers) as expected(correct_letter)
    );

  -- La tentative ouverte au lancement est complétée.
  update public.attempts
  set answers = p_answers,
      question_snapshot = coalesce(v_question_snapshot, '[]'::jsonb),
      score = v_score,
      total = v_total,
      status = 'completed',
      completed_at = now()
  where id = v_current_attempt_id
  returning id into v_attempt_id;

  -- Aucune tentative ouverte : on crée la ligne (séries ouvertes avant cette
  -- mise à jour).
  if v_attempt_id is null then
    insert into public.attempts (
      user_id, subject_id, question_ids, answers, question_snapshot, score, total
    )
    values (
      auth.uid(), p_subject_id, p_question_ids, p_answers,
      coalesce(v_question_snapshot, '[]'::jsonb), v_score, v_total
    )
    returning id into v_attempt_id;
  end if;

  return jsonb_build_object(
    'attemptId', v_attempt_id,
    'score', v_score,
    'total', v_total,
    'assignmentExpiresAt', v_assignment_expires_at
  );
end;
$$;

-- Fin de la migration 20261117_quota_hardening.sql
