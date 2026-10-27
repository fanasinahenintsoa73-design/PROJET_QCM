-- ============================================================================
--  MEDQCM L1 — schéma Supabase de production (documentation exécutable)
-- ============================================================================
--  À exécuter dans le SQL Editor d'un projet Supabase neuf, ou avec :
--    psql "$SUPABASE_DB_URL" -f supabase/schema.sql
--
--  Ce schéma prépare le remplacement de la couche localStorage par :
--    • Supabase Auth (mots de passe hachés, session JWT)
--    • PostgreSQL + Row Level Security
--    • un bucket Storage privé pour les justificatifs
--    • des fonctions RPC qui appliquent les règles métier côté serveur
--
--  L'application React fournie reste une démo localStorage : ce fichier est
--  le contrat de migration, il n'est pas encore branché au frontend.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('student', 'professor');
create type public.account_status as enum ('pending', 'active', 'rejected');
create type public.request_type as enum ('initial', 'renewal');
create type public.request_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'student',
  first_name text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 80),
  email text not null,
  status public.account_status not null default 'pending',
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  expires_at timestamptz,
  rejection_reason text,
  constraint profiles_expiry_after_activation
    check (expires_at is null or activated_at is null or expires_at > activated_at)
);

create unique index profiles_email_unique on public.profiles (lower(email));
create index profiles_status_expiry_idx on public.profiles (status, expires_at);
create index profiles_role_idx on public.profiles (role);

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.request_type not null,
  receipt_path text not null check (char_length(receipt_path) > 0),
  receipt_name text not null,
  receipt_mime text not null,
  receipt_size integer not null default 0 check (receipt_size >= 0 and receipt_size <= 3145728),
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  note text,
  constraint access_requests_review_consistency
    check (
      (status = 'pending' and reviewed_at is null and reviewed_by is null)
      or (status <> 'pending' and reviewed_at is not null)
    )
);

-- Un seul dossier en attente par étudiant : un renouvellement ne peut pas
-- être envoyé deux fois, et une validation remplace les demandes précédentes.
create unique index access_requests_one_pending_per_user
  on public.access_requests (user_id)
  where status = 'pending';

create index access_requests_status_created_idx
  on public.access_requests (status, created_at desc);
create index access_requests_user_created_idx
  on public.access_requests (user_id, created_at desc);

-- Les sujets ne portent pas d'échéance : ils forment une file ordonnée.
-- L'échéance de 30 jours appartient à l'affectation de chaque étudiant.
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '',
  month_label text not null,
  published_at timestamptz not null default now(),
  archived boolean not null default false,
  question_count integer not null default 0 check (question_count > 0),
  published_by uuid references public.profiles (id)
);

create index subjects_queue_idx
  on public.subjects (published_at asc)
  where not archived;
create index subjects_month_idx on public.subjects (month_label);

-- Un étudiant reçoit un seul sujet à la fois. Le couple (user, subject) est
-- unique : un sujet déjà consommé ne peut jamais être réattribué au même étudiant.
create table public.subject_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  request_id uuid unique references public.access_requests (id),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint subject_assignments_window check (expires_at > started_at),
  constraint subject_assignments_one_subject_per_cycle unique (user_id, subject_id)
);

create index subject_assignments_user_expiry_idx
  on public.subject_assignments (user_id, expires_at desc);
create index subject_assignments_subject_idx
  on public.subject_assignments (subject_id);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  number integer not null check (number > 0),
  matiere text not null check (char_length(btrim(matiere)) > 0),
  statement text not null check (char_length(btrim(statement)) > 0),
  options jsonb not null,
  correct_answers text[] not null,
  explanation text not null default '',
  created_at timestamptz not null default now(),
  constraint questions_options_shape check (
    jsonb_typeof(options) = 'object'
    and options ? 'A' and options ? 'B' and options ? 'C' and options ? 'D'
    and char_length(btrim(options ->> 'A')) > 0
    and char_length(btrim(options ->> 'B')) > 0
    and char_length(btrim(options ->> 'C')) > 0
    and char_length(btrim(options ->> 'D')) > 0
  ),
  constraint questions_answers_subset check (
    cardinality(correct_answers) between 1 and 4
    and correct_answers <@ array['A', 'B', 'C', 'D']::text[]
  ),
  constraint questions_number_unique_per_subject unique (subject_id, number)
);

create index questions_subject_number_idx on public.questions (subject_id, number);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  question_ids uuid[] not null,
  answers jsonb not null default '{}'::jsonb,
  score integer not null check (score >= 0),
  total integer not null check (total > 0),
  created_at timestamptz not null default now(),
  constraint attempts_score_bounds check (score <= total),
  constraint attempts_question_count_bounds check (cardinality(question_ids) between 1 and 100),
  constraint attempts_answers_object check (jsonb_typeof(answers) = 'object')
);

create index attempts_user_created_idx on public.attempts (user_id, created_at desc);
create index attempts_subject_idx on public.attempts (subject_id);

-- ---------------------------------------------------------------------------
-- 3. Création automatique du profil après inscription Auth
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'first_name'), ''), 'À renseigner'),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'last_name'), ''), 'À renseigner'),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. Helpers de sécurité
-- ---------------------------------------------------------------------------

create or replace function public.is_professor(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role = 'professor'
  );
$$;

create or replace function public.has_active_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.subject_assignments a on a.user_id = p.id
    where p.id = auth.uid()
      and p.role = 'student'
      and p.status = 'active'
      and a.started_at <= now()
      and a.expires_at > now()
  );
$$;

create or replace function public.has_subject_assignment(p_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subject_assignments a
    where a.subject_id = p_subject_id
      and a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_professor(uuid) from public;
revoke all on function public.has_active_access() from public;
revoke all on function public.has_subject_assignment(uuid) from public;
grant execute on function public.is_professor(uuid) to authenticated;
grant execute on function public.has_active_access() to authenticated;
grant execute on function public.has_subject_assignment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.access_requests enable row level security;
alter table public.subjects enable row level security;
alter table public.subject_assignments enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;

-- Profils : chacun lit le sien, le professeur lit tout le monde.
create policy "profiles_select_self_or_professor"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_professor());

-- Aucune écriture directe : les RPC et le trigger gèrent l'état du compte.
-- (Empêche un étudiant de s'auto-activer ou de changer son rôle.)

-- Sujets : l'étudiant ne voit que les sujets qui lui ont été attribués
-- (y compris les anciens, pour son historique) ; le professeur voit tout.
create policy "subjects_assigned_or_professor"
  on public.subjects for select
  to authenticated
  using (
    public.has_subject_assignment(id)
    or public.is_professor()
  );

-- Affectations : l'étudiant lit les siennes, le professeur voit tout.
create policy "subject_assignments_own_or_professor"
  on public.subject_assignments for select
  to authenticated
  using (user_id = auth.uid() or public.is_professor());

-- Questions : jamais de lecture directe côté étudiant (les corrigés seraient
-- exposés). Les étudiants passent par start_quiz() et get_attempt_review().
create policy "questions_professor_read"
  on public.questions for select
  to authenticated
  using (public.is_professor());

-- Demandes : l'étudiant voit les siennes, le professeur voit tout.
create policy "access_requests_select_own_or_professor"
  on public.access_requests for select
  to authenticated
  using (user_id = auth.uid() or public.is_professor());

-- Dépôt d'un justificatif : uniquement pour soi, en attente, dans son dossier.
create policy "access_requests_insert_own"
  on public.access_requests for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and reviewed_at is null
    and split_part(receipt_path, '/', 1) = auth.uid()::text
  );

-- Pas de modification/suppression directe : approve/reject sont des RPC.
-- Les professeurs ne peuvent pas altérer un reçu depuis le client.

-- Tentatives : l'étudiant lit les siennes ; le professeur peut consulter.
create policy "attempts_select_own_or_professor"
  on public.attempts for select
  to authenticated
  using (user_id = auth.uid() or public.is_professor());

-- Aucun INSERT direct : submit_attempt() calcule le score et vérifie l'accès.

-- ---------------------------------------------------------------------------
-- 6. Privilèges API
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.access_requests, public.subjects,
  public.subject_assignments, public.questions, public.attempts
  from anon, authenticated;

grant select on public.profiles, public.subjects, public.subject_assignments,
  public.access_requests, public.attempts to authenticated;
grant insert on public.access_requests to authenticated;
grant select on public.questions to authenticated; -- policy professeur seulement

-- ---------------------------------------------------------------------------
-- 7. RPC étudiant : lancer une série
-- ---------------------------------------------------------------------------

create or replace function public.start_quiz(p_count integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject public.subjects%rowtype;
  v_subject_id uuid;
  v_assignment_id uuid;
  v_assignment_expires_at timestamptz;
  v_questions jsonb;
  v_count integer := greatest(1, least(coalesce(p_count, 20), 100));
begin
  if not public.has_active_access() then
    raise exception 'ACCESS_EXPIRED' using errcode = 'P0001';
  end if;

  select a.id, a.expires_at, a.subject_id
  into v_assignment_id, v_assignment_expires_at, v_subject_id
  from public.subject_assignments a
  join public.subjects s on s.id = a.subject_id
  where a.user_id = auth.uid()
    and a.started_at <= now()
    and a.expires_at > now()
  order by a.started_at desc
  limit 1;

  if not found then
    raise exception 'NO_ACTIVE_SUBJECT' using errcode = 'P0001';
  end if;

  select s.* into v_subject from public.subjects s where s.id = v_subject_id;

  select jsonb_agg(
           jsonb_build_object(
             'id', q.id,
             'number', q.number,
             'matiere', q.matiere,
             'statement', q.statement,
             'options', q.options
           )
           order by random()
         )
  into v_questions
  from (
    select id, number, matiere, statement, options
    from public.questions
    where subject_id = v_subject.id
    order by random()
    limit v_count
  ) q;

  return jsonb_build_object(
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

revoke all on function public.start_quiz(integer) from public, anon;
grant execute on function public.start_quiz(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. RPC étudiant : corriger et enregistrer une série
-- ---------------------------------------------------------------------------

create or replace function public.submit_attempt(
  p_question_ids uuid[],
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject_id uuid;
  v_total integer;
  v_score integer;
  v_attempt_id uuid;
  v_assignment_expires_at timestamptz;
begin
  if not public.has_active_access() then
    raise exception 'ACCESS_EXPIRED' using errcode = 'P0001';
  end if;

  if p_question_ids is null
     or cardinality(p_question_ids) < 1
     or cardinality(p_question_ids) > 100 then
    raise exception 'INVALID_QUESTION_SET' using errcode = 'P0001';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'INVALID_ANSWERS' using errcode = 'P0001';
  end if;

  if cardinality(p_question_ids) <>
     (select count(distinct x) from unnest(p_question_ids) as t(x)) then
    raise exception 'DUPLICATE_QUESTIONS' using errcode = 'P0001';
  end if;

  select a.subject_id, a.expires_at
  into v_subject_id, v_assignment_expires_at
  from public.subject_assignments a
  where a.user_id = auth.uid()
    and a.started_at <= now()
    and a.expires_at > now()
  order by a.started_at desc
  limit 1;

  if v_subject_id is null then
    raise exception 'NO_ACTIVE_SUBJECT' using errcode = 'P0001';
  end if;

  select count(*)
  into v_total
  from public.questions
  where subject_id = v_subject_id
    and id = any (p_question_ids);

  if v_total <> cardinality(p_question_ids) then
    raise exception 'INVALID_QUESTION_SET' using errcode = 'P0001';
  end if;

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

  insert into public.attempts (user_id, subject_id, question_ids, answers, score, total)
  values (auth.uid(), v_subject_id, p_question_ids, p_answers, v_score, v_total)
  returning id into v_attempt_id;

  return jsonb_build_object(
    'attemptId', v_attempt_id,
    'score', v_score,
    'total', v_total,
    'subjectId', v_subject_id,
    'assignmentExpiresAt', v_assignment_expires_at
  );
end;
$$;

revoke all on function public.submit_attempt(uuid[], jsonb) from public, anon;
grant execute on function public.submit_attempt(uuid[], jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. RPC étudiant : lire le corrigé d'une tentative
-- ---------------------------------------------------------------------------

create or replace function public.get_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
           'attempt', jsonb_build_object(
             'id', a.id,
             'userId', a.user_id,
             'subjectId', a.subject_id,
             'score', a.score,
             'total', a.total,
             'createdAt', a.created_at
           ),
           'questions', jsonb_agg(
             jsonb_build_object(
               'id', q.id,
               'number', q.number,
               'matiere', q.matiere,
               'statement', q.statement,
               'options', q.options,
               'correctAnswers', q.correct_answers,
               'explanation', q.explanation,
               'selected', coalesce(a.answers -> q.id::text, '[]'::jsonb)
             )
             order by q.number
           )
         )
  into v_result
  from public.attempts a
  join public.questions q on q.id = any (a.question_ids)
  where a.id = p_attempt_id
    and (a.user_id = auth.uid() or public.is_professor())
  group by a.id, a.user_id, a.subject_id, a.score, a.total, a.created_at;

  if v_result is null then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
  end if;

  return v_result;
end;
$$;

revoke all on function public.get_attempt_review(uuid) from public, anon;
grant execute on function public.get_attempt_review(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. RPC professeur : valider / refuser un dossier
-- ---------------------------------------------------------------------------

create or replace function public.approve_access_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.access_requests%rowtype;
  v_started_at timestamptz := now();
  v_expires_at timestamptz := now() + interval '30 days';
  v_subject_id uuid;
  v_assignment_id uuid;
begin
  if not public.is_professor() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select *
  into v_request
  from public.access_requests
  where id = p_request_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform 1
  from public.profiles
  where id = v_request.user_id
  for update;

  if exists (
    select 1
    from public.subject_assignments
    where user_id = v_request.user_id
      and expires_at > now()
  ) then
    raise exception 'ACTIVE_ASSIGNMENT_EXISTS' using errcode = 'P0001';
  end if;

  -- Premier sujet de la file que cet étudiant n'a jamais consommé.
  select s.id
  into v_subject_id
  from public.subjects s
  where not s.archived
    and s.question_count > 0
    and not exists (
      select 1
      from public.subject_assignments a
      where a.user_id = v_request.user_id
        and a.subject_id = s.id
    )
  order by s.published_at asc, s.id asc
  limit 1;

  if v_subject_id is null then
    raise exception 'NO_SUBJECT_AVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.subject_assignments (
    user_id,
    subject_id,
    request_id,
    started_at,
    expires_at
  )
  values (
    v_request.user_id,
    v_subject_id,
    v_request.id,
    v_started_at,
    v_expires_at
  )
  returning id into v_assignment_id;

  update public.profiles
  set status = 'active',
      activated_at = v_started_at,
      expires_at = v_expires_at,
      rejection_reason = null
  where id = v_request.user_id;

  -- Un seul dossier vivant : les autres demandes en attente sont remplacées.
  update public.access_requests
  set status = 'rejected',
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      note = coalesce(note, 'Remplacée par une demande approuvée.')
  where user_id = v_request.user_id
    and status = 'pending'
    and id <> v_request.id;

  update public.access_requests
  set status = 'approved',
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = v_request.id;

  return jsonb_build_object(
    'requestId', v_request.id,
    'userId', v_request.user_id,
    'subjectId', v_subject_id,
    'assignmentId', v_assignment_id,
    'startedAt', v_started_at,
    'expiresAt', v_expires_at
  );
end;
$$;

revoke all on function public.approve_access_request(uuid) from public, anon;
grant execute on function public.approve_access_request(uuid) to authenticated;

create or replace function public.reject_access_request(
  p_request_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.access_requests%rowtype;
begin
  if not public.is_professor() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select *
  into v_request
  from public.access_requests
  where id = p_request_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.access_requests
  set status = 'rejected',
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      note = nullif(btrim(coalesce(p_note, '')), '')
  where id = v_request.id;

  update public.profiles
  set status = 'rejected',
      expires_at = now(),
      rejection_reason = nullif(btrim(coalesce(p_note, '')), '')
  where id = v_request.user_id;

  return jsonb_build_object(
    'requestId', v_request.id,
    'userId', v_request.user_id,
    'status', 'rejected'
  );
end;
$$;

revoke all on function public.reject_access_request(uuid, text) from public, anon;
grant execute on function public.reject_access_request(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. RPC professeur : ajouter un sujet à la file
-- ---------------------------------------------------------------------------

create or replace function public.publish_subject(
  p_title text,
  p_description text,
  p_month_label text,
  p_questions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject_id uuid;
  v_count integer;
begin
  if not public.is_professor() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_questions is null
     or jsonb_typeof(p_questions) <> 'array'
     or jsonb_array_length(p_questions) = 0 then
    raise exception 'EMPTY_SUBJECT' using errcode = 'P0001';
  end if;

  v_count := jsonb_array_length(p_questions);

  insert into public.subjects (
    title,
    description,
    month_label,
    published_at,
    archived,
    question_count,
    published_by
  )
  values (
    btrim(p_title),
    coalesce(p_description, ''),
    p_month_label,
    now(),
    false,
    v_count,
    auth.uid()
  )
  returning id into v_subject_id;

  insert into public.questions (
    subject_id,
    number,
    matiere,
    statement,
    options,
    correct_answers,
    explanation
  )
  select
    v_subject_id,
    (item ->> 'number')::integer,
    item ->> 'matiere',
    item ->> 'statement',
    item -> 'options',
    array(
      select jsonb_array_elements_text(item -> 'correctAnswers')
    ),
    coalesce(item ->> 'explanation', '')
  from jsonb_array_elements(p_questions) as item;

  return v_subject_id;
end;
$$;

revoke all on function public.publish_subject(text, text, text, jsonb) from public, anon;
grant execute on function public.publish_subject(text, text, text, jsonb) to authenticated;

-- Retrait d'un sujet non attribué. Un sujet déjà attribué (ou avec des
-- tentatives) ne peut pas être supprimé : il reste dans l'historique.
create or replace function public.remove_subject(p_subject_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_professor() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.subject_assignments where subject_id = p_subject_id
  ) or exists (
    select 1 from public.attempts where subject_id = p_subject_id
  ) then
    raise exception 'SUBJECT_ALREADY_ASSIGNED' using errcode = 'P0001';
  end if;

  delete from public.subjects where id = p_subject_id;

  if not found then
    raise exception 'SUBJECT_NOT_FOUND' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.remove_subject(uuid) from public, anon;
grant execute on function public.remove_subject(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 11 bis. RPC professeur : attribution manuelle, suspension, prolongation
-- ---------------------------------------------------------------------------

-- Attribue un sujet précis à un étudiant. Utilisé depuis la file de sujets.
create or replace function public.assign_subject_to_student(
  p_user_id uuid,
  p_subject_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := now();
  v_expires_at timestamptz := now() + interval '30 days';
  v_assignment_id uuid;
  v_request_id uuid;
  v_question_count integer;
  v_archived boolean;
begin
  if not public.is_professor() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  perform 1 from public.profiles where id = p_user_id and role = 'student' for update;
  if not found then
    raise exception 'STUDENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  select question_count, archived
  into v_question_count, v_archived
  from public.subjects
  where id = p_subject_id;

  if not found or v_archived then
    raise exception 'SUBJECT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_question_count = 0 then
    raise exception 'EMPTY_SUBJECT' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.subject_assignments
    where user_id = p_user_id and subject_id = p_subject_id
  ) then
    raise exception 'SUBJECT_ALREADY_ASSIGNED' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.subject_assignments
    where user_id = p_user_id and expires_at > now()
  ) then
    raise exception 'ACTIVE_ASSIGNMENT_EXISTS' using errcode = 'P0001';
  end if;

  select id into v_request_id
  from public.access_requests
  where user_id = p_user_id and status = 'pending'
  order by created_at desc
  limit 1;

  insert into public.subject_assignments (
    user_id, subject_id, request_id, started_at, expires_at
  )
  values (p_user_id, p_subject_id, v_request_id, v_started_at, v_expires_at)
  returning id into v_assignment_id;

  update public.profiles
  set status = 'active',
      activated_at = v_started_at,
      expires_at = v_expires_at,
      rejection_reason = null
  where id = p_user_id;

  if v_request_id is not null then
    update public.access_requests
    set status = 'approved',
        reviewed_at = now(),
        reviewed_by = auth.uid()
    where id = v_request_id;
  end if;

  update public.access_requests
  set status = 'rejected',
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      note = coalesce(note, 'Remplacée par une attribution manuelle.')
  where user_id = p_user_id
    and status = 'pending'
    and (v_request_id is null or id <> v_request_id);

  return jsonb_build_object(
    'assignmentId', v_assignment_id,
    'userId', p_user_id,
    'subjectId', p_subject_id,
    'startedAt', v_started_at,
    'expiresAt', v_expires_at
  );
end;
$$;

revoke all on function public.assign_subject_to_student(uuid, uuid) from public, anon;
grant execute on function public.assign_subject_to_student(uuid, uuid) to authenticated;

-- Suspend un accès immédiatement. Le cycle en cours est clos et les demandes
-- en attente sont refusées ; l'étudiant peut déposer un nouveau justificatif.
create or replace function public.revoke_access(
  p_user_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := coalesce(
    nullif(btrim(coalesce(p_note, '')), ''),
    'Accès suspendu par le docteur.'
  );
begin
  if not public.is_professor() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  perform 1 from public.profiles where id = p_user_id and role = 'student' for update;
  if not found then
    raise exception 'STUDENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.subject_assignments
  set expires_at = now()
  where user_id = p_user_id and expires_at > now();

  update public.access_requests
  set status = 'rejected',
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      note = coalesce(note, v_note)
  where user_id = p_user_id and status = 'pending';

  update public.profiles
  set status = 'rejected',
      expires_at = now(),
      rejection_reason = v_note
  where id = p_user_id;

  return jsonb_build_object('userId', p_user_id, 'status', 'rejected');
end;
$$;

revoke all on function public.revoke_access(uuid, text) from public, anon;
grant execute on function public.revoke_access(uuid, text) to authenticated;

-- Prolonge un cycle actif, ou ouvre le prochain sujet si le cycle est fini.
create or replace function public.extend_access(
  p_user_id uuid,
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.subject_assignments%rowtype;
  v_subject_id uuid;
  v_started_at timestamptz := now();
  v_expires_at timestamptz;
  v_request_id uuid;
begin
  if not public.is_professor() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'INVALID_DURATION' using errcode = 'P0001';
  end if;

  perform 1 from public.profiles where id = p_user_id and role = 'student' for update;
  if not found then
    raise exception 'STUDENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_assignment
  from public.subject_assignments
  where user_id = p_user_id and expires_at > now()
  order by expires_at desc
  limit 1
  for update;

  if found then
    v_expires_at := v_assignment.expires_at + make_interval(days => p_days);
    update public.subject_assignments
    set expires_at = v_expires_at
    where id = v_assignment.id;
  else
    select s.id into v_subject_id
    from public.subjects s
    where not s.archived
      and s.question_count > 0
      and not exists (
        select 1 from public.subject_assignments a
        where a.user_id = p_user_id and a.subject_id = s.id
      )
    order by s.published_at asc, s.id asc
    limit 1;

    if v_subject_id is null then
      raise exception 'NO_SUBJECT_AVAILABLE' using errcode = 'P0001';
    end if;

    select id into v_request_id
    from public.access_requests
    where user_id = p_user_id and status = 'pending'
    order by created_at desc
    limit 1;

    v_expires_at := v_started_at + make_interval(days => p_days);

    insert into public.subject_assignments (
      user_id, subject_id, request_id, started_at, expires_at
    )
    values (p_user_id, v_subject_id, v_request_id, v_started_at, v_expires_at)
    returning * into v_assignment;

    if v_request_id is not null then
      update public.access_requests
      set status = 'approved',
          reviewed_at = now(),
          reviewed_by = auth.uid()
      where id = v_request_id;
    end if;
  end if;

  update public.profiles
  set status = 'active',
      activated_at = coalesce(activated_at, v_started_at),
      expires_at = v_expires_at,
      rejection_reason = null
  where id = p_user_id;

  return jsonb_build_object(
    'assignmentId', v_assignment.id,
    'userId', p_user_id,
    'subjectId', v_assignment.subject_id,
    'expiresAt', v_expires_at
  );
end;
$$;

revoke all on function public.extend_access(uuid, integer) from public, anon;
grant execute on function public.extend_access(uuid, integer) to authenticated;

-- Migration idempotente pour un projet Supabase déjà initialisé.
alter table public.access_requests
  add column if not exists receipt_size integer not null default 0;

-- ---------------------------------------------------------------------------
-- 12. Stockage privé des justificatifs
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do nothing;

-- L'étudiant dépose dans son propre dossier : receipts/{userId}/fichier
create policy "receipts_student_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lecture : propriétaire ou professeur (via URL signée côté client).
create policy "receipts_read_owner_or_professor"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_professor()
    )
  );

-- Pas de policy UPDATE / DELETE : un reçu accepté est immuable.
-- La purge RGPD se fait avec la clé service_role côté serveur.

-- ---------------------------------------------------------------------------
-- 13. Exemple d'initialisation du professeur
-- ---------------------------------------------------------------------------
-- 1. Créer le compte dans Authentication > Users (email + mot de passe).
-- 2. Exécuter :
--
--    update public.profiles
--    set role = 'professor',
--        status = 'active',
--        activated_at = now(),
--        expires_at = now() + interval '100 years'
--    where email = 'professeur@exemple.fr';
--
-- 3. Le bucket est privé ; le frontend doit appeler createSignedUrl() pour
--    afficher un reçu. Ne jamais exposer la clé service_role.
-- ============================================================================
