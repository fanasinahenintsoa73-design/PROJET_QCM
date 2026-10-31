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
--  Modèle PACES :
--    • neuf thèmes fixes, publiés ensemble par le docteur ;
--    • un cycle de 30 séries par étudiant, sans thème imposé ;
--    • 30 séries soumises maximum par cycle, 10 questions par série ;
--    • l'historique étudiant est limité au cycle courant ; les lignes restent
--      en base pour l'audit et la consultation par le docteur.
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
  user_name text,
  user_email text,
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
  -- Colonnes historiques conservées pour les projets existants. Le choix du
  -- sujet au renouvellement n'est plus utilisé : un cycle ouvre les 9 thèmes.
  current_subject_id uuid references public.subjects (id),
  next_subject_id uuid references public.subjects (id),
  chosen_subject_id uuid references public.subjects (id),
  chosen_at timestamptz,
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

-- Les neuf thèmes PACES. Ils ne portent pas d'échéance : le cycle de 30 séries
-- appartient à l'affectation de chaque étudiant. Le docteur publie le pack
-- complet en une seule transaction via publish_theme_pack().
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '',
  month_label text not null,
  published_at timestamptz not null default now(),
  archived boolean not null default false,
  question_count integer not null default 0 check (question_count >= 0),
  -- Noms des fichiers d'origine, affichés au docteur lors d'une modification.
  -- Le contenu exploitable reste stocké dans public.questions.
  question_file_name text not null default '',
  answer_file_name text not null default '',
  published_by uuid references public.profiles (id)
);

create index subjects_published_idx
  on public.subjects (published_at asc)
  where not archived;
create index subjects_month_idx on public.subjects (month_label);

-- Un cycle n'est plus lié à un thème : subject_id reste nul pour les nouveaux
-- cycles. La colonne est conservée pour lire les affectations historiques.
create table public.subject_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete restrict,
  request_id uuid unique references public.access_requests (id),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint subject_assignments_window check (expires_at > started_at)
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
    and correct_answers <@ array['A', 'B', 'C', 'D', 'E']::text[]
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
  -- Copie figée des questions et du corrigé au moment de la série.
  question_snapshot jsonb,
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
-- 3. Migration idempotente
-- ---------------------------------------------------------------------------

-- Les anciens cycles portaient un sujet ; les nouveaux cycles sont ouverts
-- sans thème et laissent l'étudiant choisir librement parmi les neuf.
alter table public.subject_assignments
  alter column subject_id drop not null;

alter table public.access_requests
  add column if not exists user_name text,
  add column if not exists user_email text,
  add column if not exists receipt_size integer not null default 0,
  add column if not exists current_subject_id uuid references public.subjects (id),
  add column if not exists next_subject_id uuid references public.subjects (id),
  add column if not exists chosen_subject_id uuid references public.subjects (id),
  add column if not exists chosen_at timestamptz;

alter table public.attempts
  add column if not exists question_snapshot jsonb;

-- Noms des fichiers déposés par le docteur pour chaque sujet. Les anciens
-- sujets restent lisibles : les colonnes sont vides jusqu'au prochain
-- enregistrement depuis la page Sujets.
alter table public.subjects
  add column if not exists question_file_name text not null default '',
  add column if not exists answer_file_name text not null default '';

-- Ancien flux de choix du sujet : suppression des objets devenus inutiles.
drop index if exists public.access_requests_pending_choice_idx;
drop policy if exists "subjects_offered_for_choice" on public.subjects;
drop function if exists public.has_subject_offer(uuid);
drop function if exists public.choose_renewal_subject(uuid, uuid);

-- Anciennes signatures RPC remplacées par les versions avec thème et quota.
drop function if exists public.start_quiz(integer);
drop function if exists public.submit_attempt(uuid[], jsonb);

-- L'ancienne policy reposait sur l'affectation d'un sujet unique.
drop policy if exists "subjects_assigned_or_professor" on public.subjects;
drop function if exists public.has_subject_assignment(uuid);

-- ---------------------------------------------------------------------------
-- 4. Création automatique du profil après inscription Auth
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
-- 5. Helpers de sécurité
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

revoke all on function public.is_professor(uuid) from public;
revoke all on function public.has_active_access() from public;
grant execute on function public.is_professor(uuid) to authenticated;
grant execute on function public.has_active_access() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.access_requests enable row level security;
alter table public.subjects enable row level security;
alter table public.subject_assignments enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;

-- Profils : chacun lit le sien, le professeur lit tout le monde.
drop policy if exists "profiles_select_self_or_professor" on public.profiles;
create policy "profiles_select_self_or_professor"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_professor());

-- Aucune écriture directe : les RPC et le trigger gèrent l'état du compte.

-- Sujets : pendant un cycle actif, l'étudiant voit les neuf thèmes publiés.
-- Le professeur voit tout le catalogue.
drop policy if exists "subjects_active_or_professor" on public.subjects;
create policy "subjects_active_or_professor"
  on public.subjects for select
  to authenticated
  using (public.has_active_access() or public.is_professor());

-- Affectations : l'étudiant lit les siennes, le professeur voit tout.
drop policy if exists "subject_assignments_own_or_professor" on public.subject_assignments;
create policy "subject_assignments_own_or_professor"
  on public.subject_assignments for select
  to authenticated
  using (user_id = auth.uid() or public.is_professor());

-- Questions : jamais de lecture directe côté étudiant (les corrigés seraient
-- exposés). Les étudiants passent par start_quiz() et get_attempt_review().
drop policy if exists "questions_professor_read" on public.questions;
create policy "questions_professor_read"
  on public.questions for select
  to authenticated
  using (public.is_professor());

-- Demandes : l'étudiant voit les siennes, le professeur voit tout.
drop policy if exists "access_requests_select_own_or_professor" on public.access_requests;
create policy "access_requests_select_own_or_professor"
  on public.access_requests for select
  to authenticated
  using (user_id = auth.uid() or public.is_professor());

-- Dépôt d'un justificatif : uniquement pour soi, en attente, dans son dossier.
drop policy if exists "access_requests_insert_own" on public.access_requests;
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

-- Tentatives : l'étudiant ne lit que les séries de son cycle actif. Les lignes
-- des cycles précédents restent en base pour l'audit et le docteur.
drop policy if exists "attempts_select_own_or_professor" on public.attempts;
create policy "attempts_select_own_current_cycle_or_professor"
  on public.attempts for select
  to authenticated
  using (
    public.is_professor()
    or (
      user_id = auth.uid()
      and exists (
        select 1
        from public.subject_assignments a
        where a.user_id = auth.uid()
          and a.started_at <= now()
          and a.expires_at > now()
          and public.attempts.created_at >= a.started_at
      )
    )
  );

-- Aucun INSERT direct : submit_attempt() calcule le score et vérifie l'accès.

-- ---------------------------------------------------------------------------
-- 7. Privilèges API
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.access_requests, public.subjects,
  public.subject_assignments, public.questions, public.attempts
  from anon, authenticated;

grant select on public.profiles, public.subjects, public.subject_assignments,
  public.access_requests, public.attempts to authenticated;
grant insert on public.access_requests to authenticated;
grant select on public.questions to authenticated; -- policy professeur seulement

-- ---------------------------------------------------------------------------
-- 8. RPC étudiant : lancer une série d'un thème
-- ---------------------------------------------------------------------------

create or replace function public.start_quiz(
  p_subject_id uuid,
  p_count integer default 10
)
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

  select count(*)
  into v_used
  from public.attempts
  where user_id = auth.uid()
    and created_at >= v_assignment_started_at;

  if v_used >= v_series_limit then
    raise exception 'SERIES_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  select s.* into v_subject
  from public.subjects s
  where s.id = p_subject_id
    and not s.archived;

  if not found then
    raise exception 'THEME_NOT_FOUND' using errcode = 'P0001';
  end if;

  select count(*)
  into v_available
  from public.questions
  where subject_id = v_subject.id
    and coalesce(array_length(correct_answers, 1), 0) = 1;

  if v_available < v_series_size then
    raise exception 'THEME_UNAVAILABLE' using errcode = 'P0001';
  end if;

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
      and coalesce(array_length(correct_answers, 1), 0) = 1
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

revoke all on function public.start_quiz(uuid, integer) from public, anon;
grant execute on function public.start_quiz(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. RPC étudiant : corriger et enregistrer une série
-- ---------------------------------------------------------------------------

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

  select count(*)
  into v_used
  from public.attempts
  where user_id = auth.uid()
    and created_at >= v_assignment_started_at;

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

  -- Le corrigé est figé avec la tentative : une modification ultérieure du
  -- thème ne change ni le score ni la correction déjà affichée.
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

  insert into public.attempts (
    user_id, subject_id, question_ids, answers, question_snapshot, score, total
  )
  values (
    auth.uid(), p_subject_id, p_question_ids, p_answers,
    coalesce(v_question_snapshot, '[]'::jsonb), v_score, v_total
  )
  returning id into v_attempt_id;

  return jsonb_build_object(
    'attemptId', v_attempt_id,
    'score', v_score,
    'total', v_total,
    'subjectId', p_subject_id,
    'assignmentExpiresAt', v_assignment_expires_at
  );
end;
$$;

revoke all on function public.submit_attempt(uuid, uuid[], jsonb) from public, anon;
grant execute on function public.submit_attempt(uuid, uuid[], jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. RPC étudiant : lire le corrigé d'une tentative
-- ---------------------------------------------------------------------------

create or replace function public.get_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts%rowtype;
  v_active_started_at timestamptz;
  v_result jsonb;
begin
  select * into v_attempt
  from public.attempts
  where id = p_attempt_id;

  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not public.is_professor() then
    if v_attempt.user_id <> auth.uid() then
      raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
    end if;

    select a.started_at
    into v_active_started_at
    from public.subject_assignments a
    where a.user_id = auth.uid()
      and a.started_at <= now()
      and a.expires_at > now()
    order by a.started_at desc
    limit 1;

    if v_active_started_at is null
       or v_attempt.created_at < v_active_started_at then
      raise exception 'ATTEMPT_OUT_OF_CYCLE' using errcode = 'P0001';
    end if;
  end if;

  select jsonb_build_object(
           'attempt', jsonb_build_object(
             'id', a.id,
             'userId', a.user_id,
             'subjectId', a.subject_id,
             'score', a.score,
             'total', a.total,
             'createdAt', a.created_at
           ),
           'questions', case
             -- Les tentatives récentes utilisent la copie du corrigé faite
             -- au moment du passage. Les anciennes retombent sur le thème
             -- actuel, faute de copie disponible.
             when jsonb_typeof(a.question_snapshot) = 'array'
                  and jsonb_array_length(a.question_snapshot) > 0 then (
               select jsonb_agg(
                        elem || jsonb_build_object(
                          'selected',
                          coalesce(a.answers -> (elem ->> 'id'), '[]'::jsonb)
                        )
                        order by array_position(a.question_ids, (elem ->> 'id')::uuid)
                      )
               from jsonb_array_elements(a.question_snapshot) as snapshot(elem)
             )
             else (
               select jsonb_agg(
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
                        order by array_position(a.question_ids, q.id)
                      )
               from public.questions q
               where q.id = any (a.question_ids)
             )
           end
         )
  into v_result
  from public.attempts a
  where a.id = v_attempt.id;

  return v_result;
end;
$$;

revoke all on function public.get_attempt_review(uuid) from public, anon;
grant execute on function public.get_attempt_review(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. RPC professeur : valider / refuser un dossier
-- ---------------------------------------------------------------------------

create or replace function public.approve_access_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series_limit constant integer := 30;
  v_request public.access_requests%rowtype;
  v_active public.subject_assignments%rowtype;
  v_used integer;
  v_started_at timestamptz := now();
  v_expires_at timestamptz := now() + interval '100 years';
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

  select *
  into v_active
  from public.subject_assignments
  where user_id = v_request.user_id
    and started_at <= now()
    and expires_at > now()
  order by started_at desc
  limit 1
  for update;

  if found then
    -- Un renouvellement ne peut clore un cycle actif que si le quota de 30
    -- séries est atteint. L'échéance reste une contrainte indépendante.
    if v_request.type <> 'renewal' then
      raise exception 'ACTIVE_ASSIGNMENT_EXISTS' using errcode = 'P0001';
    end if;

    select count(*)
    into v_used
    from public.attempts
    where user_id = v_request.user_id
      and created_at >= v_active.started_at;

    if v_used < v_series_limit then
      raise exception 'ACTIVE_ASSIGNMENT_EXISTS' using errcode = 'P0001';
    end if;

    update public.subject_assignments
    set expires_at = v_started_at
    where id = v_active.id;
  end if;

  -- Nouveau cycle sans thème imposé : les neuf thèmes sont immédiatement
  -- accessibles et le compteur de séries repart de zéro.
  insert into public.subject_assignments (
    user_id,
    subject_id,
    request_id,
    started_at,
    expires_at
  )
  values (
    v_request.user_id,
    null,
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
    'assignmentId', v_assignment_id,
    'subjectId', null,
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
-- 12. RPC : renouvellement direct après paiement
-- ---------------------------------------------------------------------------

-- Le paiement est simulé : l'étudiant clôt lui-même son cycle terminé et
-- ouvre immédiatement le suivant. Un historique approuvé est conservé pour le
-- docteur, avec un reçu technique sans fichier.
create or replace function public.renew_now(
  p_full_name text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series_limit constant integer := 30;
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_email text := btrim(coalesce(p_email, ''));
  v_status public.account_status;
  v_assignment public.subject_assignments%rowtype;
  v_used integer;
  v_started_at timestamptz := now();
  v_expires_at timestamptz := now() + interval '100 years';
  v_assignment_id uuid;
  v_first_name text;
  v_last_name text;
begin
  select status
  into v_status
  from public.profiles
  where id = auth.uid()
    and role = 'student'
  for update;

  if not found then
    raise exception 'STUDENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Une première inscription en attente doit rester validée par le docteur.
  if v_status = 'pending' then
    raise exception 'REQUEST_PENDING' using errcode = 'P0001';
  end if;

  if v_full_name = '' then
    raise exception 'INVALID_FULL_NAME' using errcode = 'P0001';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL' using errcode = 'P0001';
  end if;

  select *
  into v_assignment
  from public.subject_assignments
  where user_id = auth.uid()
  order by started_at desc
  limit 1
  for update;

  if found then
    select count(*)
    into v_used
    from public.attempts
    where user_id = auth.uid()
      and created_at >= v_assignment.started_at;

    -- Un renouvellement direct ne peut clore qu'un cycle complet, sauf pour
    -- un dossier refusé : le paiement rouvre alors immédiatement l'accès.
    if v_used < v_series_limit and v_status <> 'rejected' then
      raise exception 'SERIES_NOT_COMPLETE' using errcode = 'P0001';
    end if;

    update public.subject_assignments
    set expires_at = v_started_at
    where id = v_assignment.id;
  end if;

  insert into public.subject_assignments (
    user_id,
    subject_id,
    request_id,
    started_at,
    expires_at
  )
  values (
    auth.uid(),
    null,
    null,
    v_started_at,
    v_expires_at
  )
  returning id into v_assignment_id;

  -- Le nom complet est réparti sur les deux colonnes du profil lorsque les
  -- deux parties sont présentes. L'email d'authentification reste inchangé.
  v_first_name := split_part(v_full_name, ' ', 1);
  v_last_name := btrim(substr(v_full_name, char_length(v_first_name) + 1));

  update public.profiles
  set status = 'active',
      activated_at = v_started_at,
      expires_at = v_expires_at,
      rejection_reason = null,
      first_name = case
        when v_last_name <> '' then left(v_first_name, 80)
        else first_name
      end,
      last_name = case
        when v_last_name <> '' then left(v_last_name, 80)
        else last_name
      end
  where id = auth.uid();

  insert into public.access_requests (
    user_id,
    user_name,
    user_email,
    type,
    receipt_path,
    receipt_name,
    receipt_mime,
    receipt_size,
    status,
    created_at,
    reviewed_at,
    note
  )
  values (
    auth.uid(),
    v_full_name,
    v_email,
    'renewal',
    'renewal',
    'Paiement en ligne',
    'text/plain',
    0,
    'approved',
    v_started_at,
    v_started_at,
    'Renouvellement direct après paiement.'
  );

  return jsonb_build_object(
    'assignment_id', v_assignment_id,
    'started_at', v_started_at,
    'expires_at', v_expires_at
  );
end;
$$;

revoke all on function public.renew_now(text, text) from public, anon;
grant execute on function public.renew_now(text, text) to authenticated;

create or replace function public.delete_renewal(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_professor() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- La ligne d'historique peut référencer un ancien cycle : on détache le
  -- cycle avant de supprimer la demande, sans jamais fermer l'accès.
  update public.subject_assignments
  set request_id = null
  where request_id = p_request_id
    and exists (
      select 1
      from public.access_requests r
      where r.id = p_request_id
        and r.type = 'renewal'
        and r.status = 'approved'
    );

  delete from public.access_requests
  where id = p_request_id
    and type = 'renewal'
    and status = 'approved';

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.delete_renewal(uuid) from public, anon;
grant execute on function public.delete_renewal(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 13. RPC professeur : publier les neuf thèmes en une transaction
-- ---------------------------------------------------------------------------

create or replace function public.publish_theme_pack(p_pack jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titles constant text[] := array[
    'Biologie cellulaire S1 et S2',
    'Étude des tissus S1 et S2',
    'Structure et fonction des biomolécules',
    'Physiologie S1 et S2',
    'Anatomie viscérale',
    'Biomathématiques, Biophysique, Statistiques',
    'Initiation à la connaissance des médicaments',
    'Français médical',
    'Unités d’enseignements spécifiques'
  ];
  v_theme jsonb;
  v_subject_id uuid;
  v_published_ids uuid[] := '{}';
  v_count integer;
begin
  if not public.is_professor() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_pack is null
     or jsonb_typeof(p_pack) <> 'array'
     or jsonb_array_length(p_pack) <> 9 then
    raise exception 'INVALID_THEME_PACK' using errcode = 'P0001';
  end if;

  -- Les neuf titres officiels, chacun exactement une fois.
  if (select count(distinct item ->> 'title')
      from jsonb_array_elements(p_pack) as t(item)) <> 9
     or exists (
       select 1
       from jsonb_array_elements(p_pack) as t(item)
       where coalesce(item ->> 'title', '') <> all (v_titles)
     ) then
    raise exception 'INVALID_THEME_PACK' using errcode = 'P0001';
  end if;

  -- Chaque thème porte un libellé de mois et au moins 10 questions.
  if exists (
    select 1
    from jsonb_array_elements(p_pack) as t(theme)
    where btrim(coalesce(theme.item ->> 'monthLabel', '')) = ''
       or case
            when jsonb_typeof(theme.item -> 'questions') = 'array'
              then jsonb_array_length(theme.item -> 'questions') < 10
            else true
          end
  ) then
    raise exception 'INVALID_THEME_PACK' using errcode = 'P0001';
  end if;

  -- Validation de chaque question : énoncé, quatre options, une seule
  -- réponse exacte, explication médicale non vide.
  if exists (
    select 1
    from jsonb_array_elements(p_pack) as t(theme)
    cross join lateral jsonb_array_elements(theme.item -> 'questions') as q(item)
    where btrim(coalesce(q.item ->> 'statement', '')) = ''
       or case
            when coalesce(q.item ->> 'number', '') ~ '^[0-9]+$'
              then (q.item ->> 'number')::integer < 1
            else true
          end
       or jsonb_typeof(q.item -> 'options') is distinct from 'object'
       or btrim(coalesce(q.item -> 'options' ->> 'A', '')) = ''
       or btrim(coalesce(q.item -> 'options' ->> 'B', '')) = ''
       or btrim(coalesce(q.item -> 'options' ->> 'C', '')) = ''
       or btrim(coalesce(q.item -> 'options' ->> 'D', '')) = ''
       or jsonb_typeof(q.item -> 'correctAnswers') is distinct from 'array'
       or case
            when jsonb_typeof(q.item -> 'correctAnswers') = 'array'
              then jsonb_array_length(q.item -> 'correctAnswers') <> 1
            else true
          end
       or coalesce(q.item -> 'correctAnswers' ->> 0, '') not in ('A', 'B', 'C', 'D')
       or btrim(coalesce(q.item ->> 'explanation', '')) = ''
  ) then
    raise exception 'INVALID_THEME_PACK' using errcode = 'P0001';
  end if;

  -- Numéros de question uniques à l'intérieur de chaque thème.
  if exists (
    select 1
    from jsonb_array_elements(p_pack) as t(theme)
    cross join lateral jsonb_array_elements(theme.item -> 'questions') as q(item)
    group by theme.item ->> 'title', q.item ->> 'number'
    having count(*) > 1
  ) then
    raise exception 'INVALID_THEME_PACK' using errcode = 'P0001';
  end if;

  for v_theme in
    select value from jsonb_array_elements(p_pack) as t(value)
  loop
    v_count := jsonb_array_length(v_theme -> 'questions');

    select s.id
    into v_subject_id
    from public.subjects s
    where s.title = v_theme ->> 'title'
    order by s.published_at asc
    limit 1;

    if v_subject_id is null then
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
        v_theme ->> 'title',
        coalesce(v_theme ->> 'description', ''),
        v_theme ->> 'monthLabel',
        now(),
        false,
        v_count,
        auth.uid()
      )
      returning id into v_subject_id;
    else
      update public.subjects
      set description = coalesce(nullif(btrim(v_theme ->> 'description'), ''), description),
          month_label = v_theme ->> 'monthLabel',
          published_at = now(),
          archived = false,
          question_count = v_count,
          published_by = auth.uid()
      where id = v_subject_id;

      delete from public.questions where subject_id = v_subject_id;
    end if;

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
      (q.item ->> 'number')::integer,
      coalesce(nullif(btrim(q.item ->> 'matiere'), ''), v_theme ->> 'title'),
      q.item ->> 'statement',
      q.item -> 'options',
      array(
        select jsonb_array_elements_text(q.item -> 'correctAnswers')
      ),
      q.item ->> 'explanation'
    from jsonb_array_elements(v_theme -> 'questions') as q(item);

    v_published_ids := array_append(v_published_ids, v_subject_id);
  end loop;

  -- Le catalogue actif contient exactement les neuf thèmes du pack. Les
  -- anciens sujets sont archivés, jamais supprimés, pour préserver l'audit.
  update public.subjects
  set archived = true
  where not (id = any (v_published_ids))
    and not archived;

  return jsonb_build_object(
    'subjectIds', to_jsonb(v_published_ids),
    'publishedAt', now()
  );
end;
$$;

revoke all on function public.publish_theme_pack(jsonb) from public, anon;
grant execute on function public.publish_theme_pack(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 14. RPC professeur : enregistrer ou modifier un sujet d'un thème PACES
-- ---------------------------------------------------------------------------

-- Un seul sujet actif par thème. Si le titre officiel existe déjà, la fonction
-- met à jour ce sujet au lieu d'en créer un second. Les questions sont
-- remplacées dans la même transaction ; les tentatives déjà enregistrées
-- gardent leur copie figée (question_snapshot). Les questions de même numéro
-- conservent leur identifiant pour les anciennes tentatives sans copie.
create or replace function public.save_subject(
  p_title text,
  p_description text default '',
  p_month_label text default '',
  p_questions jsonb default null,
  p_question_file_name text default null,
  p_answer_file_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series_size constant integer := 10;
  v_titles constant text[] := array[
    'Biologie cellulaire S1 et S2',
    'Étude des tissus S1 et S2',
    'Structure et fonction des biomolécules',
    'Physiologie S1 et S2',
    'Anatomie viscérale',
    'Biomathématiques, Biophysique, Statistiques',
    'Initiation à la connaissance des médicaments',
    'Français médical',
    'Unités d’enseignements spécifiques'
  ];
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := coalesce(p_description, '');
  v_month_label text := btrim(coalesce(p_month_label, ''));
  v_subject_id uuid;
  v_result jsonb;
begin
  if not public.is_professor() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_title = '' or not (v_title = any (v_titles)) then
    raise exception 'INVALID_THEME' using errcode = 'P0001';
  end if;

  -- Sérialise deux enregistrements simultanés du même thème : le second
  -- mettra à jour le sujet créé par le premier au lieu de le dupliquer.
  perform pg_advisory_xact_lock(hashtext('save_subject:' || lower(v_title))::bigint);

  select s.id
  into v_subject_id
  from public.subjects s
  where not s.archived
    and lower(btrim(s.title)) = lower(v_title)
  order by s.published_at asc
  limit 1
  for update;

  if p_questions is not null then
    if jsonb_typeof(p_questions) <> 'array'
       or jsonb_array_length(p_questions) < v_series_size then
      raise exception 'INVALID_CORRECTION' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_questions) as q(item)
      where case
              when coalesce(q.item ->> 'number', '') ~ '^[0-9]+$'
                then (q.item ->> 'number')::integer < 1
              else true
            end
         or btrim(coalesce(q.item ->> 'statement', '')) = ''
         or jsonb_typeof(q.item -> 'options') is distinct from 'object'
         or btrim(coalesce(q.item -> 'options' ->> 'A', '')) = ''
         or btrim(coalesce(q.item -> 'options' ->> 'B', '')) = ''
         or btrim(coalesce(q.item -> 'options' ->> 'C', '')) = ''
         or btrim(coalesce(q.item -> 'options' ->> 'D', '')) = ''
         or jsonb_typeof(q.item -> 'correctAnswers') is distinct from 'array'
         or case
              when jsonb_typeof(q.item -> 'correctAnswers') = 'array'
                then jsonb_array_length(q.item -> 'correctAnswers') <> 1
              else true
            end
         or coalesce(q.item -> 'correctAnswers' ->> 0, '') not in ('A', 'B', 'C', 'D', 'E')
         or (
              coalesce(q.item -> 'correctAnswers' ->> 0, '') = 'E'
              and btrim(coalesce(q.item -> 'options' ->> 'E', '')) = ''
            )
         or btrim(coalesce(q.item ->> 'explanation', '')) = ''
    ) then
      raise exception 'INVALID_CORRECTION' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_questions) as q(item)
      group by q.item ->> 'number'
      having count(*) > 1
    ) then
      raise exception 'INVALID_CORRECTION' using errcode = 'P0001';
    end if;
  end if;

  if v_subject_id is null then
    if p_questions is null then
      raise exception 'EMPTY_SUBJECT' using errcode = 'P0001';
    end if;
    if v_month_label = '' then
      raise exception 'INVALID_SUBJECT' using errcode = 'P0001';
    end if;

    insert into public.subjects (
      title,
      description,
      month_label,
      published_at,
      archived,
      question_count,
      question_file_name,
      answer_file_name,
      published_by
    )
    values (
      v_title,
      v_description,
      v_month_label,
      now(),
      false,
      jsonb_array_length(p_questions),
      coalesce(nullif(btrim(p_question_file_name), ''), ''),
      coalesce(nullif(btrim(p_answer_file_name), ''), ''),
      auth.uid()
    )
    returning id into v_subject_id;
  else
    update public.subjects
    set description = v_description,
        month_label = case
          when v_month_label <> '' then v_month_label
          else month_label
        end,
        published_at = now(),
        archived = false,
        question_count = case
          when p_questions is null then question_count
          else jsonb_array_length(p_questions)
        end,
        question_file_name = coalesce(
          nullif(btrim(p_question_file_name), ''),
          question_file_name
        ),
        answer_file_name = coalesce(
          nullif(btrim(p_answer_file_name), ''),
          answer_file_name
        ),
        published_by = auth.uid()
    where id = v_subject_id;
  end if;

  if p_questions is not null then
    -- Mise à jour par numéro : l'identifiant d'une question inchangée reste
    -- stable, ce qui préserve la consultation des anciennes tentatives.
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
      (q.item ->> 'number')::integer,
      coalesce(nullif(btrim(q.item ->> 'matiere'), ''), v_title),
      q.item ->> 'statement',
      q.item -> 'options',
      array(select jsonb_array_elements_text(q.item -> 'correctAnswers')),
      q.item ->> 'explanation'
    from jsonb_array_elements(p_questions) as q(item)
    on conflict (subject_id, number) do update
    set matiere = excluded.matiere,
        statement = excluded.statement,
        options = excluded.options,
        correct_answers = excluded.correct_answers,
        explanation = excluded.explanation;

    delete from public.questions
    where subject_id = v_subject_id
      and number not in (
        select (q.item ->> 'number')::integer
        from jsonb_array_elements(p_questions) as q(item)
      );
  end if;

  -- Nettoie d'éventuels doublons historiques du même thème, sans supprimer
  -- leur historique : ils sont seulement retirés du catalogue actif.
  update public.subjects
  set archived = true
  where not archived
    and lower(btrim(title)) = lower(v_title)
    and id <> v_subject_id;

  select jsonb_build_object(
           'id', s.id,
           'title', s.title,
           'description', s.description,
           'monthLabel', s.month_label,
           'publishedAt', s.published_at,
           'archived', s.archived,
           'questionCount', s.question_count,
           'questionFileName', s.question_file_name,
           'answerFileName', s.answer_file_name
         )
  into v_result
  from public.subjects s
  where s.id = v_subject_id;

  return v_result;
end;
$$;

revoke all on function public.save_subject(text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.save_subject(text, text, text, jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 15. RPC professeur historiques (compatibilité, hors interface docteur)
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

  if exists (
    select 1
    from jsonb_array_elements(p_questions) as question(item)
    where case
      when coalesce(jsonb_typeof(question.item -> 'correctAnswers'), '') <> 'array' then true
      when jsonb_array_length(question.item -> 'correctAnswers') = 0 then true
      when btrim(coalesce(question.item ->> 'explanation', '')) = '' then true
      else exists (
        select 1
        from jsonb_array_elements_text(question.item -> 'correctAnswers') as answer(letter)
        where answer.letter not in ('A', 'B', 'C', 'D')
      )
    end
  ) then
    raise exception 'INVALID_CORRECTION' using errcode = 'P0001';
  end if;

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

-- Retrait d'un thème non attribué. Un thème déjà attribué (ou avec des
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

-- Attribution manuelle historique : le thème transmis sert uniquement de
-- contrôle de disponibilité. Le cycle ouvert n'impose aucun thème.
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
  v_expires_at timestamptz := now() + interval '100 years';
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
    raise exception 'THEME_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_question_count = 0 then
    raise exception 'EMPTY_SUBJECT' using errcode = 'P0001';
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
  values (p_user_id, null, v_request_id, v_started_at, v_expires_at)
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
    'subjectId', null,
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
  where user_id = p_user_id
    and status = 'pending';

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

-- Prolonge un cycle actif sans remettre le compteur de séries à zéro. Sans
-- cycle actif, ouvre un nouveau cycle complet sans thème imposé.
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
    v_expires_at := v_started_at + make_interval(days => p_days);

    select id into v_request_id
    from public.access_requests
    where user_id = p_user_id and status = 'pending'
    order by created_at desc
    limit 1;

    insert into public.subject_assignments (
      user_id, subject_id, request_id, started_at, expires_at
    )
    values (p_user_id, null, v_request_id, v_started_at, v_expires_at)
    returning * into v_assignment;

    if v_request_id is not null then
      update public.access_requests
      set status = 'approved',
          reviewed_at = now(),
          reviewed_by = auth.uid()
      where id = v_request_id;

      update public.access_requests
      set status = 'rejected',
          reviewed_at = now(),
          reviewed_by = auth.uid(),
          note = coalesce(note, 'Remplacée par une prolongation manuelle.')
      where user_id = p_user_id
        and status = 'pending'
        and id <> v_request_id;
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

-- ---------------------------------------------------------------------------
-- 16. Stockage privé des justificatifs
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
drop policy if exists "receipts_student_insert_own_folder" on storage.objects;
create policy "receipts_student_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lecture : propriétaire ou professeur (via URL signée côté client).
drop policy if exists "receipts_read_owner_or_professor" on storage.objects;
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
-- 17. Exemple d'initialisation du professeur
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

-- ---------------------------------------------------------------------------
-- 18. Migration : UE, chapitres et séries multi-chapitres
-- ---------------------------------------------------------------------------

alter table public.subjects
  add column if not exists chapter_id text;

create index if not exists subjects_chapter_idx
  on public.subjects (chapter_id)
  where chapter_id is not null;

alter table public.attempts
  add column if not exists ue_id text,
  add column if not exists chapter_ids text[] not null default '{}',
  add column if not exists status text not null default 'completed',
  add column if not exists completed_at timestamptz;

create index if not exists attempts_ue_status_idx
  on public.attempts (ue_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- 18.1 Démarrer une série sur une sélection de chapitres
-- ---------------------------------------------------------------------------
create or replace function public.start_chapter_quiz(
  p_ue_id text,
  p_chapter_ids text[],
  p_count integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.subject_assignments%rowtype;
  v_attempt public.attempts%rowtype;
  v_used integer;
  v_snapshot jsonb;
  v_questions jsonb;
  v_subject_id uuid;
  v_attempt_id uuid;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_ue_id is null or btrim(p_ue_id) = ''
     or p_chapter_ids is null or cardinality(p_chapter_ids) = 0 then
    raise exception 'INVALID_CHAPTER' using errcode = 'P0001';
  end if;

  if p_count is null or p_count < 1 or p_count > 100 then
    raise exception 'INVALID_COUNT' using errcode = 'P0001';
  end if;

  if not public.has_active_access() then
    raise exception 'ACCESS_EXPIRED' using errcode = 'P0001';
  end if;

  select a.*
  into v_assignment
  from public.subject_assignments a
  where a.user_id = auth.uid()
    and a.started_at <= now()
    and a.expires_at > now()
  order by a.started_at desc
  limit 1;

  if not found then
    raise exception 'ACCESS_EXPIRED' using errcode = 'P0001';
  end if;

  -- Reprise après rafraîchissement : le brouillon existant est renvoyé avant
  -- le contrôle du quota, pour ne pas bloquer la 30e série déjà ouverte.
  select a.*
  into v_attempt
  from public.attempts a
  where a.user_id = auth.uid()
    and a.ue_id = p_ue_id
    and a.status = 'in_progress'
    and a.chapter_ids = p_chapter_ids
  order by a.created_at desc
  limit 1;

  if found then
    select jsonb_agg(
             elem - 'correctAnswers' - 'explanation'
             order by ordinality
           )
    into v_questions
    from jsonb_array_elements(v_attempt.question_snapshot)
         with ordinality as t(elem, ordinality);

    return jsonb_build_object(
      'attemptId', v_attempt.id,
      'assignmentId', v_assignment.id,
      'assignmentExpiresAt', v_assignment.expires_at,
      'ueId', v_attempt.ue_id,
      'chapterIds', to_jsonb(v_attempt.chapter_ids),
      'questions', coalesce(v_questions, '[]'::jsonb)
    );
  end if;

  select count(*)
  into v_used
  from public.attempts a
  where a.user_id = auth.uid()
    and a.created_at >= v_assignment.started_at;

  if v_used >= 30 then
    raise exception 'SERIES_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  with available as (
    select q.id,
           q.subject_id,
           q.number,
           q.matiere,
           q.statement,
           q.options,
           q.correct_answers,
           q.explanation
    from public.questions q
    join public.subjects s on s.id = q.subject_id
    where s.archived = false
      and s.chapter_id = any (p_chapter_ids)
      and cardinality(q.correct_answers) = 1
  ),
  selected as (
    select *
    from available
    order by random()
    limit p_count
  )
  select jsonb_agg(
           jsonb_build_object(
             'id', selected.id,
             'subjectId', selected.subject_id,
             'number', selected.number,
             'matiere', selected.matiere,
             'statement', selected.statement,
             'options', selected.options,
             'correctAnswers', to_jsonb(selected.correct_answers),
             'explanation', selected.explanation
           )
           order by selected.number
         ),
         (array_agg(selected.subject_id))[1]
  into v_snapshot, v_subject_id
  from selected;

  if v_snapshot is null or jsonb_array_length(v_snapshot) < p_count then
    raise exception 'CHAPTER_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select jsonb_agg(
           elem - 'correctAnswers' - 'explanation'
           order by ordinality
         )
  into v_questions
  from jsonb_array_elements(v_snapshot)
       with ordinality as t(elem, ordinality);

  insert into public.attempts (
    user_id,
    subject_id,
    question_ids,
    answers,
    question_snapshot,
    score,
    total,
    ue_id,
    chapter_ids,
    status
  )
  values (
    auth.uid(),
    v_subject_id,
    array(
      select (elem ->> 'id')::uuid
      from jsonb_array_elements(v_snapshot) as snapshot(elem)
    ),
    '{}'::jsonb,
    v_snapshot,
    0,
    p_count,
    p_ue_id,
    p_chapter_ids,
    'in_progress'
  )
  returning id into v_attempt_id;

  return jsonb_build_object(
    'attemptId', v_attempt_id,
    'assignmentId', v_assignment.id,
    'assignmentExpiresAt', v_assignment.expires_at,
    'ueId', p_ue_id,
    'chapterIds', to_jsonb(p_chapter_ids),
    'questions', v_questions
  );
end;
$$;

revoke all on function public.start_chapter_quiz(text, text[], integer) from public, anon;
grant execute on function public.start_chapter_quiz(text, text[], integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 18.2 Terminer une série multi-chapitres
-- ---------------------------------------------------------------------------
create or replace function public.submit_chapter_attempt(
  p_attempt_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts%rowtype;
  v_assignment public.subject_assignments%rowtype;
  v_score integer := 0;
  v_total integer;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'INVALID_ANSWERS' using errcode = 'P0001';
  end if;

  select a.*
  into v_attempt
  from public.attempts a
  where a.id = p_attempt_id
  for update;

  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_attempt.user_id <> auth.uid() then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_attempt.status <> 'in_progress' then
    raise exception 'ATTEMPT_CLOSED' using errcode = 'P0001';
  end if;

  if jsonb_typeof(v_attempt.question_snapshot) <> 'array'
     or jsonb_array_length(v_attempt.question_snapshot) = 0 then
    raise exception 'ATTEMPT_INVALID' using errcode = 'P0001';
  end if;

  v_total := jsonb_array_length(v_attempt.question_snapshot);

  select count(*)
  into v_score
  from jsonb_array_elements(v_attempt.question_snapshot) as snapshot(item)
  where (
    select coalesce(array_agg(upper(value) order by upper(value)), array[]::text[])
    from jsonb_array_elements_text(
      coalesce(p_answers -> (snapshot.item ->> 'id'), '[]'::jsonb)
    ) as answer(value)
  ) = (
    select coalesce(array_agg(upper(value) order by upper(value)), array[]::text[])
    from jsonb_array_elements_text(
      coalesce(snapshot.item -> 'correctAnswers', '[]'::jsonb)
    ) as correct(value)
  );

  select a.*
  into v_assignment
  from public.subject_assignments a
  where a.user_id = auth.uid()
    and a.started_at <= now()
    and a.expires_at > now()
  order by a.started_at desc
  limit 1;

  update public.attempts
  set answers = p_answers,
      score = v_score,
      status = 'completed',
      completed_at = now()
  where id = v_attempt.id;

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'score', v_score,
    'total', v_total,
    'subjectId', v_attempt.subject_id,
    'assignmentExpiresAt', v_assignment.expires_at,
    'ueId', v_attempt.ue_id,
    'chapterIds', to_jsonb(v_attempt.chapter_ids)
  );
end;
$$;

revoke all on function public.submit_chapter_attempt(uuid, jsonb) from public, anon;
grant execute on function public.submit_chapter_attempt(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 18.3 Abandonner une série (elle reste comptée dans le quota)
-- ---------------------------------------------------------------------------
create or replace function public.abandon_series(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.attempts
  set status = 'abandoned',
      completed_at = coalesce(completed_at, now())
  where id = p_attempt_id
    and user_id = auth.uid()
    and status = 'in_progress';
end;
$$;

revoke all on function public.abandon_series(uuid) from public, anon;
grant execute on function public.abandon_series(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 18.4 Enregistrer un sujet rattaché à un chapitre
-- ---------------------------------------------------------------------------
create or replace function public.save_chapter_subject(
  p_subject_id uuid default null,
  p_ue_id text default '',
  p_chapter_id text default '',
  p_title text default '',
  p_description text default '',
  p_month_label text default '',
  p_questions jsonb default null,
  p_question_file_name text default null,
  p_answer_file_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series_size constant integer := 10;
  v_subject_id uuid := p_subject_id;
  v_ue_id text := btrim(coalesce(p_ue_id, ''));
  v_chapter_id text := btrim(coalesce(p_chapter_id, ''));
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := coalesce(p_description, '');
  v_month_label text := coalesce(nullif(btrim(p_month_label), ''), to_char(now(), 'YYYY-MM'));
  v_result jsonb;
begin
  if not public.is_professor() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_ue_id = '' or v_chapter_id = '' then
    raise exception 'INVALID_CHAPTER' using errcode = 'P0001';
  end if;

  if v_title = '' then
    raise exception 'INVALID_SUBJECT' using errcode = 'P0001';
  end if;

  if p_questions is not null then
    if jsonb_typeof(p_questions) <> 'array'
       or jsonb_array_length(p_questions) < v_series_size then
      raise exception 'INVALID_CORRECTION' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_questions) as q(item)
      where case
              when coalesce(q.item ->> 'number', '') ~ '^[0-9]+$'
                then (q.item ->> 'number')::integer < 1
              else true
            end
         or btrim(coalesce(q.item ->> 'statement', '')) = ''
         or jsonb_typeof(q.item -> 'options') is distinct from 'object'
         or btrim(coalesce(q.item -> 'options' ->> 'A', '')) = ''
         or btrim(coalesce(q.item -> 'options' ->> 'B', '')) = ''
         or btrim(coalesce(q.item -> 'options' ->> 'C', '')) = ''
         or btrim(coalesce(q.item -> 'options' ->> 'D', '')) = ''
         or jsonb_typeof(q.item -> 'correctAnswers') is distinct from 'array'
         or case
              when jsonb_typeof(q.item -> 'correctAnswers') = 'array'
                then jsonb_array_length(q.item -> 'correctAnswers') <> 1
              else true
            end
         or coalesce(q.item -> 'correctAnswers' ->> 0, '') not in ('A', 'B', 'C', 'D', 'E')
         or (
              coalesce(q.item -> 'correctAnswers' ->> 0, '') = 'E'
              and btrim(coalesce(q.item -> 'options' ->> 'E', '')) = ''
            )
         or btrim(coalesce(q.item ->> 'explanation', '')) = ''
    ) then
      raise exception 'INVALID_CORRECTION' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_questions) as q(item)
      group by q.item ->> 'number'
      having count(*) > 1
    ) then
      raise exception 'INVALID_CORRECTION' using errcode = 'P0001';
    end if;
  elsif p_subject_id is null then
    raise exception 'EMPTY_SUBJECT' using errcode = 'P0001';
  end if;

  if v_subject_id is not null then
    select s.id
    into v_subject_id
    from public.subjects s
    where s.id = p_subject_id
    for update;

    if not found then
      raise exception 'SUBJECT_NOT_FOUND' using errcode = 'P0001';
    end if;

    update public.subjects
    set title = v_title,
        description = v_description,
        month_label = v_month_label,
        chapter_id = v_chapter_id,
        published_at = now(),
        archived = false,
        question_count = case
          when p_questions is null then question_count
          else jsonb_array_length(p_questions)
        end,
        question_file_name = coalesce(
          nullif(btrim(p_question_file_name), ''),
          question_file_name
        ),
        answer_file_name = coalesce(
          nullif(btrim(p_answer_file_name), ''),
          answer_file_name
        ),
        published_by = auth.uid()
    where id = v_subject_id;
  else
    insert into public.subjects (
      title,
      description,
      month_label,
      chapter_id,
      published_at,
      archived,
      question_count,
      question_file_name,
      answer_file_name,
      published_by
    )
    values (
      v_title,
      v_description,
      v_month_label,
      v_chapter_id,
      now(),
      false,
      jsonb_array_length(p_questions),
      coalesce(nullif(btrim(p_question_file_name), ''), ''),
      coalesce(nullif(btrim(p_answer_file_name), ''), ''),
      auth.uid()
    )
    returning id into v_subject_id;
  end if;

  if p_questions is not null then
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
      (q.item ->> 'number')::integer,
      coalesce(nullif(btrim(q.item ->> 'matiere'), ''), v_title),
      q.item ->> 'statement',
      q.item -> 'options',
      array(select jsonb_array_elements_text(q.item -> 'correctAnswers')),
      q.item ->> 'explanation'
    from jsonb_array_elements(p_questions) as q(item)
    on conflict (subject_id, number) do update
    set matiere = excluded.matiere,
        statement = excluded.statement,
        options = excluded.options,
        correct_answers = excluded.correct_answers,
        explanation = excluded.explanation;

    delete from public.questions
    where subject_id = v_subject_id
      and number not in (
        select (q.item ->> 'number')::integer
        from jsonb_array_elements(p_questions) as q(item)
      );
  end if;

  select jsonb_build_object(
           'id', s.id,
           'title', s.title,
           'description', s.description,
           'monthLabel', s.month_label,
           'publishedAt', s.published_at,
           'archived', s.archived,
           'questionCount', s.question_count,
           'chapterId', s.chapter_id,
           'questionFileName', s.question_file_name,
           'answerFileName', s.answer_file_name
         )
  into v_result
  from public.subjects s
  where s.id = v_subject_id;

  return v_result;
end;
$$;

revoke all on function public.save_chapter_subject(
  uuid, text, text, text, text, text, jsonb, text, text
) from public, anon;
grant execute on function public.save_chapter_subject(
  uuid, text, text, text, text, text, jsonb, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- 18.5 Corrigé : refuser les brouillons et exposer UE/chapitres
-- ---------------------------------------------------------------------------
create or replace function public.get_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts%rowtype;
  v_active_started_at timestamptz;
  v_result jsonb;
begin
  select * into v_attempt
  from public.attempts
  where id = p_attempt_id;

  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not public.is_professor() then
    if v_attempt.user_id <> auth.uid() then
      raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
    end if;

    select a.started_at
    into v_active_started_at
    from public.subject_assignments a
    where a.user_id = auth.uid()
      and a.started_at <= now()
      and a.expires_at > now()
    order by a.started_at desc
    limit 1;

    if v_active_started_at is null
       or v_attempt.created_at < v_active_started_at then
      raise exception 'ATTEMPT_OUT_OF_CYCLE' using errcode = 'P0001';
    end if;
  end if;

  if coalesce(v_attempt.status, 'completed') <> 'completed' then
    raise exception 'ATTEMPT_NOT_COMPLETED' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
           'attempt', jsonb_build_object(
             'id', a.id,
             'userId', a.user_id,
             'subjectId', a.subject_id,
             'score', a.score,
             'total', a.total,
             'createdAt', a.created_at,
             'ueId', a.ue_id,
             'chapterIds', to_jsonb(coalesce(a.chapter_ids, '{}'::text[])),
             'status', a.status,
             'completedAt', a.completed_at
           ),
           'questions', case
             when jsonb_typeof(a.question_snapshot) = 'array'
                  and jsonb_array_length(a.question_snapshot) > 0 then (
               select jsonb_agg(
                        elem || jsonb_build_object(
                          'selected',
                          coalesce(a.answers -> (elem ->> 'id'), '[]'::jsonb)
                        )
                        order by array_position(a.question_ids, (elem ->> 'id')::uuid)
                      )
               from jsonb_array_elements(a.question_snapshot) as snapshot(elem)
             )
             else (
               select jsonb_agg(
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
                        order by array_position(a.question_ids, q.id)
                      )
               from public.questions q
               where q.id = any (a.question_ids)
             )
           end
         )
  into v_result
  from public.attempts a
  where a.id = v_attempt.id;

  return v_result;
end;
$$;

revoke all on function public.get_attempt_review(uuid) from public, anon;
grant execute on function public.get_attempt_review(uuid) to authenticated;
