import type {
  AccessRequest,
  Attempt,
  Database,
  Question,
  Receipt,
  RequestStatus,
  RequestType,
  Role,
  Subject,
  SubjectAssignment,
  User,
  UserStatus,
} from '@/types'
import { requireSupabase } from '@/lib/supabase'
import { AppError, SERIES_LIMIT_MESSAGE, SERIES_SIZE } from '@/lib/utils'
import type { SaveSubjectInput, ThemePackInput } from '@/lib/themes'

/* ------------------------------------------------------------------ */
/* Lignes Supabase                                                     */
/* ------------------------------------------------------------------ */

interface ProfileRow {
  id: string
  role: Role
  first_name: string
  last_name: string
  email: string
  status: UserStatus
  created_at: string
  activated_at: string | null
  expires_at: string | null
  rejection_reason: string | null
}

interface AccessRequestRow {
  id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  type: RequestType
  receipt_path: string
  receipt_name: string
  receipt_mime: string
  receipt_size: number | null
  status: RequestStatus
  created_at: string
  reviewed_at: string | null
  note: string | null
  current_subject_id: string | null
  next_subject_id: string | null
  chosen_subject_id: string | null
  chosen_at: string | null
}

interface SubjectRow {
  id: string
  title: string
  description: string
  month_label: string
  published_at: string
  archived: boolean
  question_count: number
  question_file_name?: string | null
  answer_file_name?: string | null
}

interface AssignmentRow {
  id: string
  user_id: string
  subject_id: string | null
  request_id: string | null
  started_at: string
  expires_at: string
}

interface AttemptRow {
  id: string
  user_id: string
  subject_id: string
  question_ids: string[]
  answers: Record<string, string[]>
  score: number
  total: number
  created_at: string
}

interface QuestionPayload {
  id: string
  number: number
  matiere: string
  statement: string
  options: { A: string; B: string; C: string; D: string }
  correctAnswers?: string[]
  explanation?: string
  selected?: string[]
}

/* ------------------------------------------------------------------ */
/* Mappers                                                             */
/* ------------------------------------------------------------------ */

function optional(value: string | null | undefined) {
  return value ?? undefined
}

export function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    password: '',
    status: row.status,
    createdAt: row.created_at,
    activatedAt: optional(row.activated_at),
    expiresAt: optional(row.expires_at),
    rejectionReason: optional(row.rejection_reason),
  }
}

function mapSubject(row: SubjectRow): Subject {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    monthLabel: row.month_label,
    publishedAt: row.published_at,
    archived: row.archived,
    questionCount: row.question_count,
    questionFileName: row.question_file_name ?? '',
    answerFileName: row.answer_file_name ?? '',
  }
}

function mapAssignment(row: AssignmentRow): SubjectAssignment {
  return {
    id: row.id,
    userId: row.user_id,
    subjectId: row.subject_id,
    requestId: optional(row.request_id),
    startedAt: row.started_at,
    expiresAt: row.expires_at,
  }
}

function mapAttempt(row: AttemptRow): Attempt {
  return {
    id: row.id,
    userId: row.user_id,
    subjectId: row.subject_id,
    questionIds: row.question_ids ?? [],
    answers: row.answers ?? {},
    score: row.score,
    total: row.total,
    createdAt: row.created_at,
  }
}

function mapRequest(
  row: AccessRequestRow,
  profiles: Map<string, ProfileRow>,
  signedUrls: Map<string, string>,
): AccessRequest {
  const profile = profiles.get(row.user_id)
  const placeholderReceipt = row.receipt_path === 'renewal'
  return {
    id: row.id,
    userId: row.user_id,
    userName:
      row.user_name?.trim() ||
      (profile ? `${profile.first_name} ${profile.last_name}` : 'Étudiant'),
    userEmail: row.user_email?.trim() || profile?.email || '',
    type: row.type,
    receipt: {
      dataUrl: placeholderReceipt ? '' : signedUrls.get(row.receipt_path) ?? '',
      name: row.receipt_name,
      mime: row.receipt_mime,
      size: row.receipt_size ?? 0,
      path: row.receipt_path,
    },
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: optional(row.reviewed_at),
    note: optional(row.note),
    currentSubjectId: optional(row.current_subject_id),
    nextSubjectId: optional(row.next_subject_id),
    chosenSubjectId: optional(row.chosen_subject_id),
    chosenAt: optional(row.chosen_at),
  }
}

/* ------------------------------------------------------------------ */
/* Erreurs lisibles                                                    */
/* ------------------------------------------------------------------ */

const errorMessages: Record<string, string> = {
  ACCESS_EXPIRED: 'Votre accès a expiré. Renouvelez votre cycle pour continuer.',
  SERIES_LIMIT_REACHED: SERIES_LIMIT_MESSAGE,
  THEME_NOT_FOUND: 'Ce thème est introuvable dans le catalogue.',
  THEME_UNAVAILABLE:
    'Ce thème sera bientôt disponible : le docteur prépare encore ses questions.',
  INVALID_THEME_PACK: 'Le pack des neuf thèmes est incomplet ou invalide.',
  INVALID_THEME: 'Ce sujet ne correspond à aucun des neuf thèmes PACES.',
  INVALID_SUBJECT: 'Le sujet est incomplet : vérifiez le thème et le mois de publication.',
  INVALID_QUESTION_SET: 'La série envoyée ne correspond pas au thème sélectionné.',
  INVALID_ANSWERS: 'Les réponses envoyées sont invalides.',
  DUPLICATE_QUESTIONS: 'La série contient des questions en double.',
  FORBIDDEN: 'Cette action est réservée au docteur.',
  REQUEST_NOT_FOUND: 'Cette demande est introuvable ou a déjà été traitée.',
  ACTIVE_ASSIGNMENT_EXISTS: 'Cet étudiant dispose déjà d’un cycle actif.',
  SUBJECT_ALREADY_ASSIGNED:
    'Ce thème est lié à un historique : il ne peut plus être retiré du catalogue.',
  SUBJECT_NOT_FOUND: 'Ce thème est introuvable.',
  EMPTY_SUBJECT: 'Aucune question à ajouter au catalogue.',
  INVALID_CORRECTION:
    'Chaque question doit avoir une seule bonne réponse (A, B, C ou D) et une explication avant l’enregistrement.',
  ATTEMPT_NOT_FOUND: 'Ce résultat est introuvable.',
  ATTEMPT_OUT_OF_CYCLE:
    'Ce résultat appartient à un cycle précédent et n’est plus accessible.',
  STUDENT_NOT_FOUND: 'Étudiant introuvable.',
  INVALID_DURATION: 'La durée demandée est invalide.',
  SERIES_NOT_COMPLETE:
    'Vos 30 séries ne sont pas encore terminées. Le renouvellement sera disponible à la fin du cycle.',
  REQUEST_PENDING: 'Votre demande est en attente de validation.',
  INVALID_FULL_NAME: 'Indiquez votre nom et prénom.',
  INVALID_EMAIL: 'Saisissez une adresse email valide.',
}

function rawError(error: unknown): { message?: string; code?: string; details?: string } {
  return (error ?? {}) as { message?: string; code?: string; details?: string }
}

function messageFrom(error: unknown): string {
  const value = rawError(error)
  const raw = value.message?.trim() || value.details?.trim() || 'Une erreur est survenue.'
  if (errorMessages[raw]) return errorMessages[raw]
  if (errorMessages[value.code ?? '']) return errorMessages[value.code!]
  if (value.code === '23505') {
    return 'Cette opération existe déjà. Vérifiez la demande ou l’attribution en cours.'
  }
  if (/invalid login credentials/i.test(raw)) return 'Email ou mot de passe incorrect.'
  if (/email not confirmed/i.test(raw)) {
    return 'Confirmez votre adresse email avant de vous connecter.'
  }
  if (/user already registered/i.test(raw)) {
    return 'Un compte existe déjà avec cet email. Connectez-vous pour renouveler.'
  }
  if (/password should be at least/i.test(raw)) {
    return 'Le mot de passe doit contenir au moins 8 caractères.'
  }
  return raw
}

export function asFrenchError(error: unknown): Error {
  const value = rawError(error)
  const raw = value.message?.trim() ?? ''
  const knownCode =
    (errorMessages[raw] && raw) ||
    (value.code && errorMessages[value.code] ? value.code : undefined)
  return new AppError(knownCode ?? value.code ?? 'UNEXPECTED_ERROR', messageFrom(error))
}

/* ------------------------------------------------------------------ */
/* Profil & snapshot                                                   */
/* ------------------------------------------------------------------ */

export async function fetchProfile(userId: string, attempts = 4): Promise<User> {
  const client = requireSupabase()
  let lastError: unknown = null
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) lastError = error
    if (data) return mapProfile(data as ProfileRow)
    if (attempt < attempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 350))
    }
  }
  throw asFrenchError(
    lastError ?? new Error('Votre profil est en cours de création. Réessayez dans un instant.'),
  )
}

async function signReceiptUrls(paths: string[]): Promise<Map<string, string>> {
  const client = requireSupabase()
  const unique = [...new Set(paths.filter(Boolean))]
  const signed = new Map<string, string>()
  for (let offset = 0; offset < unique.length; offset += 50) {
    const batch = unique.slice(offset, offset + 50)
    const { data, error } = await client.storage.from('receipts').createSignedUrls(batch, 3600)
    if (error) continue
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl)
    }
  }
  return signed
}

export function emptyDatabase(): Database {
  return {
    version: 3,
    users: [],
    requests: [],
    subjects: [],
    assignments: [],
    questions: [],
    attempts: [],
  }
}

/**
 * Charge le snapshot visible par l'utilisateur connecté. Les questions ne
 * sont jamais incluses : les corrigés passent uniquement par les RPC.
 */
export async function fetchDatabase(currentProfile?: User): Promise<Database> {
  const client = requireSupabase()
  let profile = currentProfile
  if (!profile) {
    const { data, error } = await client.auth.getUser()
    if (error || !data.user) return emptyDatabase()
    profile = await fetchProfile(data.user.id)
  }

  const professor = profile.role === 'professor'

  const profilesQuery = professor
    ? client.from('profiles').select('*').order('created_at', { ascending: false })
    : client.from('profiles').select('*').eq('id', profile.id)
  const requestsQuery = professor
    ? client.from('access_requests').select('*').order('created_at', { ascending: false })
    : client
        .from('access_requests')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
  const subjectsQuery = client
    .from('subjects')
    .select('*')
    .order('published_at', { ascending: true })
  const assignmentsQuery = professor
    ? client.from('subject_assignments').select('*').order('started_at', { ascending: false })
    : client
        .from('subject_assignments')
        .select('*')
        .eq('user_id', profile.id)
        .order('started_at', { ascending: false })
  const attemptsQuery = professor
    ? client.from('attempts').select('*').order('created_at', { ascending: false })
    : client
        .from('attempts')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

  const [profilesResult, requestsResult, subjectsResult, assignmentsResult, attemptsResult] =
    await Promise.all([
      profilesQuery,
      requestsQuery,
      subjectsQuery,
      assignmentsQuery,
      attemptsQuery,
    ])

  for (const result of [
    profilesResult,
    requestsResult,
    subjectsResult,
    assignmentsResult,
    attemptsResult,
  ]) {
    if (result.error) throw asFrenchError(result.error)
  }

  const profiles = (profilesResult.data ?? []) as ProfileRow[]
  const profileMap = new Map(profiles.map((row) => [row.id, row]))
  const requestRows = (requestsResult.data ?? []) as AccessRequestRow[]

  // Le docteur ne signe que les reçus à traiter ; les anciens sont résolus à
  // la demande depuis l'interface. L'étudiant voit tous ses propres reçus.
  const paths = requestRows
    .filter(
      (row) =>
        (professor === false || row.status === 'pending') && row.receipt_path !== 'renewal',
    )
    .map((row) => row.receipt_path)
  const signedUrls = await signReceiptUrls(paths)

  const assignments = ((assignmentsResult.data ?? []) as AssignmentRow[]).map(mapAssignment)
  const allAttempts = ((attemptsResult.data ?? []) as AttemptRow[]).map(mapAttempt)
  // L'étudiant ne voit que les séries de son cycle courant. Les lignes restent
  // en base pour l'audit et le docteur, mais l'historique est remis à zéro à
  // chaque renouvellement.
  const currentAssignment = assignments
    .slice()
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0]
  let attempts: Attempt[] = []
  if (professor) {
    attempts = allAttempts
  } else if (currentAssignment) {
    attempts = allAttempts.filter(
      (attempt) =>
        new Date(attempt.createdAt).getTime() >=
        new Date(currentAssignment.startedAt).getTime(),
    )
  }

  return {
    version: 3,
    users: profiles.map(mapProfile),
    requests: requestRows.map((row) => mapRequest(row, profileMap, signedUrls)),
    subjects: ((subjectsResult.data ?? []) as SubjectRow[]).map(mapSubject),
    assignments,
    attempts,
    questions: [],
  }
}

/* ------------------------------------------------------------------ */
/* Authentification                                                    */
/* ------------------------------------------------------------------ */

export async function signIn(email: string, password: string): Promise<User> {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) throw asFrenchError(error)
  if (!data.user) throw new Error('Connexion impossible. Réessayez.')
  return fetchProfile(data.user.id)
}

export async function signOut() {
  const client = requireSupabase()
  await client.auth.signOut()
}

export interface StudentRegistration {
  firstName: string
  lastName: string
  email: string
  password: string
  receipt: Receipt
}

async function uploadReceipt(userId: string, receipt: Receipt): Promise<string> {
  const client = requireSupabase()
  const response = await fetch(receipt.dataUrl)
  const blob = await response.blob()
  const safeName =
    receipt.name
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(-90) || 'recu'
  const path = `${userId}/${Date.now()}-${safeName}`
  const { error } = await client.storage.from('receipts').upload(path, blob, {
    contentType: receipt.mime,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw asFrenchError(error)
  return path
}

async function insertRequest(
  userId: string,
  type: RequestType,
  receipt: Receipt,
): Promise<void> {
  const client = requireSupabase()
  const path = await uploadReceipt(userId, receipt)
  const { error } = await client.from('access_requests').insert({
    user_id: userId,
    type,
    receipt_path: path,
    receipt_name: receipt.name,
    receipt_mime: receipt.mime,
    receipt_size: receipt.size,
    status: 'pending',
  })
  if (error) throw asFrenchError(error)
}

export async function registerStudent(input: StudentRegistration): Promise<User> {
  const client = requireSupabase()
  const { data, error } = await client.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
      },
    },
  })
  if (error) throw asFrenchError(error)
  if (!data.user) throw new Error('La création du compte a échoué. Réessayez.')
  if (!data.session) {
    throw new Error(
      'La confirmation d’email est encore activée dans Supabase. Désactivez-la (Authentication → Providers → Email) pour que l’inscription puisse déposer le reçu.',
    )
  }
  const profile = await fetchProfile(data.user.id)
  await insertRequest(profile.id, 'initial', input.receipt)
  return profile
}

export async function submitRenewal(receipt: Receipt): Promise<void> {
  const client = requireSupabase()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Votre session a expiré. Reconnectez-vous.')
  await insertRequest(data.user.id, 'renewal', receipt)
}

export async function renewNow(fullName: string, email: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('renew_now', {
    p_full_name: fullName.trim(),
    p_email: email.trim(),
  })
  if (error) throw asFrenchError(error)
}

/* ------------------------------------------------------------------ */
/* Actions docteur                                                     */
/* ------------------------------------------------------------------ */

export async function approveRequest(requestId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('approve_access_request', {
    p_request_id: requestId,
  })
  if (error) throw asFrenchError(error)
}

export async function rejectRequest(requestId: string, note?: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('reject_access_request', {
    p_request_id: requestId,
    p_note: note?.trim() || null,
  })
  if (error) throw asFrenchError(error)
}

export async function deleteRenewal(requestId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('delete_renewal', {
    p_request_id: requestId,
  })
  if (error) throw asFrenchError(error)
}

export async function assignSubjectToStudent(
  subjectId: string,
  userId: string,
): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('assign_subject_to_student', {
    p_user_id: userId,
    p_subject_id: subjectId,
  })
  if (error) throw asFrenchError(error)
}

export async function revokeAccess(userId: string, note?: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('revoke_access', {
    p_user_id: userId,
    p_note: note?.trim() || null,
  })
  if (error) throw asFrenchError(error)
}

export async function extendAccess(userId: string, days = 30): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('extend_access', {
    p_user_id: userId,
    p_days: days,
  })
  if (error) throw asFrenchError(error)
}

export interface SubjectQuestionInput {
  number: number
  matiere: string
  statement: string
  options: { A: string; B: string; C: string; D: string }
  correctAnswers: string[]
  explanation: string
}

export interface PublishSubjectInput {
  title: string
  description: string
  monthLabel: string
  questions: SubjectQuestionInput[]
}

export async function publishThemePack(input: ThemePackInput): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('publish_theme_pack', { p_pack: input })
  if (error) throw asFrenchError(error)
}

/**
 * Enregistre un sujet unique par thème. La fonction SQL met à jour le sujet
 * existant (même titre officiel) et remplace ses questions dans la même
 * transaction ; les tentatives conservent leur copie figée du corrigé.
 */
export async function saveSubject(input: SaveSubjectInput): Promise<Subject> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('save_subject', {
    p_title: input.title.trim(),
    p_description: input.description.trim(),
    p_month_label: input.monthLabel.trim(),
    p_questions: input.questions ?? null,
    p_question_file_name: input.questionFileName?.trim() || null,
    p_answer_file_name: input.answerFileName?.trim() || null,
  })
  if (error) throw asFrenchError(error)
  const payload = data as {
    id: string
    title?: string
    description?: string
    monthLabel?: string
    publishedAt?: string
    archived?: boolean
    questionCount?: number
    questionFileName?: string | null
    answerFileName?: string | null
  }
  return {
    id: String(payload.id),
    title: payload.title ?? input.title.trim(),
    description: payload.description ?? input.description.trim(),
    monthLabel: payload.monthLabel ?? input.monthLabel.trim(),
    publishedAt: payload.publishedAt ?? new Date().toISOString(),
    archived: payload.archived ?? false,
    questionCount: payload.questionCount ?? input.questions?.length ?? 0,
    questionFileName:
      payload.questionFileName ?? input.questionFileName?.trim() ?? '',
    answerFileName:
      payload.answerFileName ?? input.answerFileName?.trim() ?? '',
  }
}

export async function publishSubject(input: PublishSubjectInput): Promise<Subject> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('publish_subject', {
    p_title: input.title.trim(),
    p_description: input.description.trim(),
    p_month_label: input.monthLabel.trim(),
    p_questions: input.questions,
  })
  if (error) throw asFrenchError(error)
  return {
    id: String(data),
    title: input.title.trim(),
    description: input.description.trim(),
    monthLabel: input.monthLabel.trim(),
    publishedAt: new Date().toISOString(),
    archived: false,
    questionCount: input.questions.length,
  }
}

export async function removeSubject(subjectId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('remove_subject', { p_subject_id: subjectId })
  if (error) throw asFrenchError(error)
}

/* ------------------------------------------------------------------ */
/* Quiz                                                                */
/* ------------------------------------------------------------------ */

export interface QuizPayload {
  assignmentId: string
  assignmentExpiresAt: string
  subject: Subject
  questions: Question[]
}

export async function startQuiz(
  subjectId: string,
  count = SERIES_SIZE,
): Promise<QuizPayload> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('start_quiz', {
    p_subject_id: subjectId,
    p_count: count,
  })
  if (error) throw asFrenchError(error)
  const payload = data as {
    assignmentId: string
    assignmentExpiresAt: string
    subject: {
      id: string
      title: string
      description: string
      monthLabel: string
      publishedAt: string
      questionCount: number
    }
    questions: QuestionPayload[]
  }
  return {
    assignmentId: payload.assignmentId,
    assignmentExpiresAt: payload.assignmentExpiresAt,
    subject: {
      id: payload.subject.id,
      title: payload.subject.title,
      description: payload.subject.description,
      monthLabel: payload.subject.monthLabel,
      publishedAt: payload.subject.publishedAt,
      archived: false,
      questionCount: payload.subject.questionCount,
    },
    questions: (payload.questions ?? []).map((question) => ({
      id: question.id,
      subjectId: payload.subject.id,
      number: question.number,
      matiere: question.matiere,
      statement: question.statement,
      options: question.options,
      correctAnswers: [],
      explanation: '',
    })),
  }
}

export interface SubmitAttemptResult {
  attemptId: string
  score: number
  total: number
  subjectId: string
  assignmentExpiresAt: string
}

export async function saveAttempt(input: {
  subjectId: string
  questionIds: string[]
  answers: Record<string, string[]>
}): Promise<SubmitAttemptResult> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('submit_attempt', {
    p_subject_id: input.subjectId,
    p_question_ids: input.questionIds,
    p_answers: input.answers,
  })
  if (error) throw asFrenchError(error)
  const payload = data as SubmitAttemptResult
  return {
    attemptId: payload.attemptId,
    score: payload.score,
    total: payload.total,
    subjectId: payload.subjectId,
    assignmentExpiresAt: payload.assignmentExpiresAt,
  }
}

export interface AttemptReview {
  attempt: Attempt
  questions: Question[]
}

export async function getAttemptReview(attemptId: string): Promise<AttemptReview> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('get_attempt_review', {
    p_attempt_id: attemptId,
  })
  if (error) throw asFrenchError(error)
  const payload = data as {
    attempt: {
      id: string
      userId: string
      subjectId: string
      score: number
      total: number
      createdAt: string
    }
    questions: QuestionPayload[]
  }
  const questions: Question[] = (payload.questions ?? []).map((question) => ({
    id: question.id,
    subjectId: payload.attempt.subjectId,
    number: question.number,
    matiere: question.matiere,
    statement: question.statement,
    options: question.options,
    correctAnswers: question.correctAnswers ?? [],
    explanation: question.explanation ?? '',
  }))
  const answers: Record<string, string[]> = {}
  for (const question of payload.questions ?? []) {
    answers[question.id] = question.selected ?? []
  }
  return {
    attempt: {
      id: payload.attempt.id,
      userId: payload.attempt.userId,
      subjectId: payload.attempt.subjectId,
      questionIds: questions.map((question) => question.id),
      answers,
      score: payload.attempt.score,
      total: payload.attempt.total,
      createdAt: payload.attempt.createdAt,
    },
    questions,
  }
}

/* ------------------------------------------------------------------ */
/* Justificatifs                                                       */
/* ------------------------------------------------------------------ */

export async function resolveReceiptUrl(path: string): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.storage.from('receipts').createSignedUrl(path, 3600)
  if (error) throw asFrenchError(error)
  return data.signedUrl
}
