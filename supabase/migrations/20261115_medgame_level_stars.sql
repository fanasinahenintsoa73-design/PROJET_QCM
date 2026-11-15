-- ============================================================================
-- MEDGAME — étoiles par niveau
-- 15 novembre 2026
-- ============================================================================
-- Chaque niveau réussi mémorise son nombre de bonnes réponses (étoiles).
-- Seul le meilleur score est conservé : un échec ultérieur sur le même
-- niveau n'efface jamais les étoiles déjà gagnées.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Colonne des étoiles sur le parcours
-- ---------------------------------------------------------------------------

alter table public.medgame_progress
  add column if not exists level_stars jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- 2. Sérialisation JSON (mêmes clés que les types TypeScript)
-- ---------------------------------------------------------------------------

create or replace function public.medgame_progress_json(p public.medgame_progress)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'studentId', p.user_id,
    'ticketId', p.ticket_code,
    'ueId', p.ue_id,
    'chapterIds', to_jsonb(p.chapter_ids),
    'questionIds', to_jsonb(p.question_ids),
    'levelCount', p.level_count,
    'currentLevel', p.current_level,
    'status', p.status,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at,
    'levelStars', coalesce(p.level_stars, '{}'::jsonb)
  );
$$;

create or replace function public.medgame_levels_json(p public.medgame_progress)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'level', l,
        'totalLevels', p.level_count,
        'questionCount', greatest(
          0,
          least(5, cardinality(p.question_ids) - (l - 1) * 5)
        ),
        'status',
          case
            when p.status = 'completed' or l < p.current_level then 'passed'
            when l = p.current_level then 'unlocked'
            else 'locked'
          end,
        'bestStars', coalesce(
          (coalesce(p.level_stars, '{}'::jsonb) ->> l::text)::int,
          0
        )
      )
      order by l
    ),
    '[]'::jsonb
  )
  from generate_series(1, p.level_count) as l;
$$;

-- ---------------------------------------------------------------------------
-- 3. Enregistrement des étoiles au niveau réussi
-- ---------------------------------------------------------------------------

create or replace function public.medgame_submit_level(
  p_run_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.medgame_runs%rowtype;
  v_progress public.medgame_progress%rowtype;
  v_level integer;
  v_answer jsonb;
  v_answers jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_correct integer := 0;
  v_passed boolean := false;
  v_completed boolean := false;
  v_failed boolean := false;
  v_consumed boolean := false;
  v_next integer;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select *
  into v_run
  from public.medgame_runs
  where id = p_run_id and user_id = auth.uid();

  if not found then
    raise exception 'MEDGAME_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_run.status <> 'in_progress' then
    raise exception 'MEDGAME_CLOSED' using errcode = 'P0001';
  end if;

  select *
  into v_progress
  from public.medgame_progress
  where id = v_run.progress_id;

  if not found then
    raise exception 'MEDGAME_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_level := v_run.current_level;

  for v_answer in
    select jsonb_build_object(
      'questionId', q.id,
      'given', coalesce(g.given, '{}'::text[]),
      'correctAnswers', to_jsonb(q.correct_answers),
      'explanation', coalesce(q.explanation, ''),
      'correct', coalesce(g.given, '{}'::text[]) = q.correct_answers
    )
    from (
      select qid, ordinality
      from unnest(
        v_progress.question_ids[((v_level - 1) * 5 + 1):(v_level * 5)]
      ) with ordinality as t(qid, ordinality)
    ) qids
    join public.questions q on q.id = qids.qid
    left join (
      select (elem ->> 'questionId')::uuid as qid,
             array(
               select jsonb_array_elements_text(elem -> 'given')
             ) as given
      from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) elem
    ) g on g.qid = q.id
    order by qids.ordinality
  loop
    v_answers := v_answers || jsonb_build_array(v_answer);
    v_total := v_total + 1;
    if (v_answer ->> 'correct')::boolean then
      v_correct := v_correct + 1;
    end if;

    insert into public.medgame_run_answers (
      run_id, question_id, given, is_correct
    ) values (
      p_run_id,
      (v_answer ->> 'questionId')::uuid,
      array(
        select jsonb_array_elements_text(v_answer -> 'given')
      ),
      (v_answer ->> 'correct')::boolean
    )
    on conflict (run_id, question_id) do update
      set given = excluded.given,
          is_correct = excluded.is_correct,
          answered_at = now();
  end loop;

  if v_total = 0 then
    raise exception 'MEDGAME_EMPTY_LEVEL' using errcode = 'P0001';
  end if;

  v_passed := v_correct = v_total;

  if v_passed then
    -- Les étoiles du niveau sont conservées au mieux : un échec plus tard ne
    -- doit pas effacer le score déjà obtenu sur ce niveau.
    update public.medgame_progress
    set level_stars = jsonb_set(
          coalesce(level_stars, '{}'::jsonb),
          ARRAY[v_level::text],
          to_jsonb(
            greatest(
              coalesce((level_stars ->> v_level::text)::int, 0),
              v_correct
            )
          ),
          true
        )
    where id = v_progress.id;

    if v_level >= v_progress.level_count then
      v_completed := true;
      v_next := null;

      update public.medgame_runs
      set status = 'completed', ended_at = now(), last_activity_at = now()
      where id = p_run_id;

      update public.medgame_progress
      set status = 'completed',
          current_level = v_progress.level_count + 1,
          updated_at = now()
      where id = v_progress.id;

      v_consumed := public.medgame_consume(p_run_id, 'completion');
    else
      v_next := v_level + 1;

      update public.medgame_runs
      set current_level = v_next, last_activity_at = now()
      where id = p_run_id;

      update public.medgame_progress
      set current_level = v_next, updated_at = now()
      where id = v_progress.id;
    end if;
  else
    v_failed := true;
    v_next := v_level;

    update public.medgame_runs
    set status = 'failed', ended_at = now(), last_activity_at = now()
    where id = p_run_id;

    update public.medgame_progress
    set current_level = v_level, updated_at = now()
    where id = v_progress.id;

    v_consumed := public.medgame_consume(p_run_id, 'failure');
  end if;

  return jsonb_build_object(
    'runId', p_run_id,
    'level', v_level,
    'correct', v_correct,
    'total', v_total,
    'stars', v_correct,
    'passed', v_passed,
    'completed', v_completed,
    'failed', v_failed,
    'nextLevel', v_next,
    'answers', v_answers,
    'consumed', v_consumed,
    'quota', public.medgame_quota_json()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Droits RPC
-- ---------------------------------------------------------------------------

revoke all on function public.medgame_progress_json(public.medgame_progress) from public, anon;
revoke all on function public.medgame_levels_json(public.medgame_progress) from public, anon;
revoke all on function public.medgame_submit_level(uuid, jsonb) from public, anon;

grant execute on function public.medgame_submit_level(uuid, jsonb) to authenticated;
