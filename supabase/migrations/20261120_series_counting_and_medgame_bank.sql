-- ---------------------------------------------------------------------------
-- 1. Taille de la banque MEDGAME d'une sélection de chapitres
-- ---------------------------------------------------------------------------
-- L'étudiant ne peut pas lire la table `questions` (RLS réservée au
-- docteur) : le client ne connaît donc pas la banque réellement
-- disponible. Cette fonction renvoie le nombre exact de questions
-- utilisables, avec la même règle que `medgame_create_progress` :
-- une seule bonne réponse par question, et un énoncé compté une seule
-- fois même s'il est repris dans plusieurs chapitres.

create or replace function public.medgame_bank_size(p_chapter_ids text[])
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_chapter_ids is null or cardinality(p_chapter_ids) = 0 then
    return 0;
  end if;

  select count(*)
  into v_count
  from (
    select distinct on (lower(btrim(q.statement))) q.id
    from public.questions q
    join public.subjects s on s.id = q.subject_id
    where s.archived = false
      and s.chapter_id = any (p_chapter_ids)
      and cardinality(q.correct_answers) = 1
    order by lower(btrim(q.statement))
  ) bank;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.medgame_bank_size(text[]) from public, anon;
grant execute on function public.medgame_bank_size(text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. La série Pres Concours est comptée dès son lancement
-- ---------------------------------------------------------------------------
-- Avant, la ligne `attempts` n'était créée qu'à la soumission : une série
-- lancée puis abandonnée n'était jamais comptée. `start_quiz` crée
-- désormais la tentative au lancement, comme le fait déjà
-- `start_chapter_quiz`, ce qui rend l'abandon comptable et immédiat.

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

  select count(*)
  into v_used
  from public.attempts
  where user_id = auth.uid()
    and created_at >= v_assignment_started_at;

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
-- 3. La soumission met à jour la tentative lancée
-- ---------------------------------------------------------------------------
-- La tentative créée au lancement est complétée au lieu d'être
-- dupliquée : une série compte une seule fois, et la 30e série peut
-- être soumise sans dépasser le quota.

create or replace function public.submit_attempt(p_subject_id uuid, p_question_ids uuid[], p_answers jsonb)
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
  v_assignment_started_at timestamptz;
  v_assignment_expires_at timestamptz;
  v_used integer;
  v_question_snapshot jsonb;
begin
  if not public.has_active_access() then
    raise exception 'ACCESS_EXPIRED' using errcode = 'P0001';
  end if;

  -- Sérialise les envois concurrents pour ne jamais dépasser 30 séries.
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

  -- La tentative déjà ouverte est exclue du décompte : elle compte
  -- déjà dans le quota, elle ne doit pas le bloquer une seconde fois.
  select count(*)
  into v_used
  from public.attempts
  where user_id = auth.uid()
    and created_at >= v_assignment_started_at
    and id is distinct from (
      select a.id
      from public.attempts a
      where a.user_id = auth.uid()
        and a.subject_id = p_subject_id
        and a.status = 'in_progress'
        and a.ue_id is null
      order by a.created_at desc
      limit 1
    );

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
  where id = (
    select a.id
    from public.attempts a
    where a.user_id = auth.uid()
      and a.subject_id = p_subject_id
      and a.status = 'in_progress'
      and a.ue_id is null
    order by a.created_at desc
    limit 1
  )
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
