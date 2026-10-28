import type {
  AccessRequest,
  Attempt,
  Database,
  Question,
  Receipt,
  Subject,
  SubjectAssignment,
  User,
} from '@/types'
import { createSeedDatabase, PROFESSOR_FIRST_NAME, PROFESSOR_LAST_NAME } from '@/lib/seed'
import { addDays, isExpired, uid } from '@/lib/utils'

const DB_KEY = 'medqcm.db.v2'
const SESSION_KEY = 'medqcm.session.v1'
const CHANGE_EVENT = 'medqcm:change'

let cache: Database | null = null
const listeners = new Set<() => void>()

function cloneSeed(): Database {
  return createSeedDatabase()
}

function migrateDatabase(database: Database): Database {
  let changed = false
  const users = database.users.map((user) => {
    const isProfessor =
      user.id === 'u_prof' ||
      (user.role === 'professor' && user.email.toLowerCase() === 'prof@medqcm.fr')
    if (
      !isProfessor ||
      (user.firstName === PROFESSOR_FIRST_NAME && user.lastName === PROFESSOR_LAST_NAME)
    ) {
      return user
    }
    changed = true
    return {
      ...user,
      firstName: PROFESSOR_FIRST_NAME,
      lastName: PROFESSOR_LAST_NAME,
    }
  })
  return changed ? { ...database, users } : database
}

function loadFromStorage(): Database {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (!raw) {
      const seeded = cloneSeed()
      localStorage.setItem(DB_KEY, JSON.stringify(seeded))
      return seeded
    }
    const parsed = JSON.parse(raw) as Database
    if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid database')
    }
    const migrated = migrateDatabase(parsed)
    if (migrated !== parsed) localStorage.setItem(DB_KEY, JSON.stringify(migrated))
    return migrated
  } catch {
    const seeded = cloneSeed()
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(seeded))
    } catch {
      // Storage unavailable (private mode): the app still works in memory.
    }
    return seeded
  }
}

export function getDB(): Database {
  if (!cache) cache = loadFromStorage()
  return cache
}

function commit(next: Database) {
  cache = next
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(next))
  } catch {
    // Quota exceeded: keep the in-memory state and warn in the UI on upload.
    throw new Error(
      "L'espace de stockage local est saturé. Supprimez d'anciennes demandes ou utilisez un reçu plus léger.",
    )
  }
  emit()
}

function emit() {
  listeners.forEach((listener) => listener())
}

/**
 * Replace the local snapshot with data received from the shared server.
 * The session is deliberately untouched: sessions belong to each portal origin.
 */
export function replaceDatabase(next: Database) {
  if (
    !next ||
    !Array.isArray(next.users) ||
    !Array.isArray(next.requests) ||
    !Array.isArray(next.subjects) ||
    !Array.isArray(next.assignments) ||
    !Array.isArray(next.questions) ||
    !Array.isArray(next.attempts)
  ) {
    throw new Error('La base partagée est invalide.')
  }
  cache = migrateDatabase(next)
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(cache))
  } catch {
    // The shared snapshot still lives in memory; local storage is only a cache.
  }
  emit()
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === DB_KEY) {
      cache = loadFromStorage()
      emit()
    }
    if (event.key === SESSION_KEY) emit()
  })
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

export function getSessionUserId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function setSession(userId: string) {
  try {
    localStorage.setItem(SESSION_KEY, userId)
  } catch {
    /* in-memory only */
  }
  emit()
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* noop */
  }
  emit()
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export type LoginResult = { ok: true; user: User } | { ok: false; error: string }

export function login(email: string, password: string): LoginResult {
  const cleanEmail = email.trim().toLowerCase()
  const user = getDB().users.find((candidate) => candidate.email.toLowerCase() === cleanEmail)
  if (!user || user.password !== password) {
    return { ok: false, error: 'Email ou mot de passe incorrect.' }
  }
  setSession(user.id)
  return { ok: true, user }
}

export function logout() {
  clearSession()
}

export interface RegistrationInput {
  firstName: string
  lastName: string
  email: string
  password: string
  receipt: Receipt
}

export function registerStudent(input: RegistrationInput): User {
  const db = getDB()
  const email = input.email.trim().toLowerCase()
  if (db.users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error('Un compte existe déjà avec cet email. Connectez-vous pour renouveler.')
  }
  if (!input.receipt?.dataUrl) {
    throw new Error('Le reçu de paiement est obligatoire pour créer votre demande.')
  }
  const now = new Date().toISOString()
  const user: User = {
    id: uid('u'),
    role: 'student',
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email,
    password: input.password,
    status: 'pending',
    createdAt: now,
  }
  const request: AccessRequest = {
    id: uid('req'),
    userId: user.id,
    userName: `${user.firstName} ${user.lastName}`,
    userEmail: user.email,
    type: 'initial',
    receipt: input.receipt,
    status: 'pending',
    createdAt: now,
  }
  commit({ ...db, users: [...db.users, user], requests: [request, ...db.requests] })
  setSession(user.id)
  return user
}

export function submitRenewal(userId: string, receipt: Receipt): AccessRequest {
  const db = getDB()
  const user = db.users.find((candidate) => candidate.id === userId)
  if (!user) throw new Error('Compte introuvable.')
  if (!receipt?.dataUrl) throw new Error('Le nouveau reçu de paiement est obligatoire.')
  const awaitingChoice = db.requests.some(
    (request) =>
      request.userId === userId &&
      request.type === 'renewal' &&
      request.status === 'approved' &&
      Boolean(request.currentSubjectId) &&
      !request.chosenSubjectId,
  )
  if (awaitingChoice) {
    throw new Error('Choisissez d’abord votre sujet pour ouvrir votre nouveau cycle.')
  }
  const existingPending = db.requests.find((request) => request.userId === userId && request.status === 'pending')
  if (existingPending) throw new Error('Une demande est déjà en attente de validation.')

  const now = new Date().toISOString()
  const request: AccessRequest = {
    id: uid('req'),
    userId: user.id,
    userName: `${user.firstName} ${user.lastName}`,
    userEmail: user.email,
    type: 'renewal',
    receipt,
    status: 'pending',
    createdAt: now,
  }
  const updatedUser: User = {
    ...user,
    status: 'pending',
    rejectionReason: undefined,
  }
  commit({
    ...db,
    users: db.users.map((candidate) => (candidate.id === userId ? updatedUser : candidate)),
    requests: [request, ...db.requests],
  })
  return request
}

/* ------------------------------------------------------------------ */
/* Subject assignments                                                 */
/* ------------------------------------------------------------------ */

export function getActiveAssignment(
  userId: string,
  db: Database = getDB(),
): SubjectAssignment | undefined {
  return db.assignments
    .filter((assignment) => assignment.userId === userId && !isExpired(assignment.expiresAt))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0]
}

export function getLatestAssignment(
  userId: string,
  db: Database = getDB(),
): SubjectAssignment | undefined {
  return db.assignments
    .filter((assignment) => assignment.userId === userId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0]
}

export function getNextSubjectForUser(
  userId: string,
  db: Database = getDB(),
): Subject | undefined {
  const used = new Set(
    db.assignments
      .filter((assignment) => assignment.userId === userId)
      .map((assignment) => assignment.subjectId),
  )
  return db.subjects
    .filter(
      (subject) =>
        !subject.archived && subject.questionCount > 0 && !used.has(subject.id),
    )
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())[0]
}

/** Sujet publié qui suit `subjectId` dans la file (ordre de publication). */
export function getNextSubjectAfter(
  subjectId: string,
  db: Database = getDB(),
): Subject | undefined {
  const queue = db.subjects
    .filter((subject) => !subject.archived && subject.questionCount > 0)
    .sort((a, b) => {
      const byDate = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
      return byDate !== 0 ? byDate : a.id.localeCompare(b.id)
    })
  const index = queue.findIndex((subject) => subject.id === subjectId)
  if (index < 0) return queue[0]
  return queue[index + 1]
}

function createAssignment(
  userId: string,
  subjectId: string,
  requestId: string | undefined,
  now: Date,
): SubjectAssignment {
  return {
    id: uid('assign'),
    userId,
    subjectId,
    requestId,
    startedAt: now.toISOString(),
    expiresAt: addDays(now, 30).toISOString(),
  }
}

/* ------------------------------------------------------------------ */
/* Professor actions                                                   */
/* ------------------------------------------------------------------ */

export function approveRequest(requestId: string): User {
  const db = getDB()
  const request = db.requests.find((item) => item.id === requestId)
  if (!request) throw new Error('Demande introuvable.')
  if (request.status !== 'pending') throw new Error('Cette demande a déjà été traitée.')
  const user = db.users.find((candidate) => candidate.id === request.userId)
  if (!user) throw new Error('Étudiant introuvable.')

  if (getActiveAssignment(user.id, db)) {
    throw new Error('Cet étudiant dispose déjà d’un cycle actif. Attendez son expiration avant de valider un renouvellement.')
  }

  const now = new Date()
  const latestAssignment = getLatestAssignment(user.id, db)

  // Un renouvellement n'attribue plus le sujet suivant : l'étudiant doit
  // choisir entre reprendre son sujet et avancer. Le cycle de 30 jours
  // démarrera seulement au moment de ce choix.
  if (request.type === 'renewal' && latestAssignment) {
    const currentSubject = db.subjects.find(
      (subject) => subject.id === latestAssignment.subjectId,
    )
    if (!currentSubject || currentSubject.archived || currentSubject.questionCount === 0) {
      throw new Error(
        'Le sujet précédent n’est plus disponible. Attribuez un sujet manuellement à cet étudiant.',
      )
    }
    const nextSubject = getNextSubjectAfter(currentSubject.id, db)
    const waitingUser: User = {
      ...user,
      status: 'pending',
      rejectionReason: undefined,
    }
    const requests = db.requests.map((item) => {
      if (item.id === requestId) {
        return {
          ...item,
          status: 'approved' as const,
          reviewedAt: now.toISOString(),
          currentSubjectId: currentSubject.id,
          nextSubjectId: nextSubject?.id,
        }
      }
      if (item.userId === user.id && item.status === 'pending') {
        return {
          ...item,
          status: 'rejected' as const,
          reviewedAt: now.toISOString(),
          note: 'Demande remplacée par une validation plus récente.',
        }
      }
      return item
    })

    commit({
      ...db,
      users: db.users.map((candidate) =>
        candidate.id === user.id ? waitingUser : candidate,
      ),
      requests,
    })
    return waitingUser
  }

  const subject = getNextSubjectForUser(user.id, db)
  if (!subject) {
    throw new Error(
      'Aucun sujet disponible dans la file. Ajoutez d’abord un sujet avant d’accepter cette demande.',
    )
  }

  const assignment = createAssignment(user.id, subject.id, request.id, now)
  const activatedUser: User = {
    ...user,
    status: 'active',
    activatedAt: assignment.startedAt,
    expiresAt: assignment.expiresAt,
    rejectionReason: undefined,
  }

  const requests = db.requests.map((item) => {
    if (item.id === requestId) {
      return { ...item, status: 'approved' as const, reviewedAt: now.toISOString() }
    }
    if (item.userId === user.id && item.status === 'pending') {
      return {
        ...item,
        status: 'rejected' as const,
        reviewedAt: now.toISOString(),
        note: 'Demande remplacée par une validation plus récente.',
      }
    }
    return item
  })

  commit({
    ...db,
    users: db.users.map((candidate) => (candidate.id === user.id ? activatedUser : candidate)),
    requests,
    assignments: [assignment, ...db.assignments],
  })
  return activatedUser
}

/**
 * Enregistre le choix obligatoire de l'étudiant après validation d'un
 * renouvellement, puis ouvre le nouveau cycle de 30 jours.
 */
export function chooseRenewalSubject(
  userId: string,
  requestId: string,
  subjectId: string,
): SubjectAssignment {
  const db = getDB()
  const request = db.requests.find((item) => item.id === requestId)
  if (!request || request.userId !== userId || request.type !== 'renewal') {
    throw new Error('Renouvellement introuvable.')
  }
  if (
    request.status !== 'approved' ||
    !request.currentSubjectId ||
    request.chosenSubjectId ||
    db.assignments.some((assignment) => assignment.requestId === requestId)
  ) {
    throw new Error('Ce choix n’est plus disponible. Reconnectez-vous pour actualiser.')
  }
  if (getActiveAssignment(userId, db)) {
    throw new Error('Un cycle est déjà actif. Attendez son expiration avant de choisir.')
  }

  const allowed = new Set(
    [request.currentSubjectId, request.nextSubjectId].filter(Boolean) as string[],
  )
  if (!allowed.has(subjectId)) {
    throw new Error('Ce sujet ne fait pas partie des choix proposés.')
  }
  const subject = db.subjects.find((candidate) => candidate.id === subjectId)
  if (!subject || subject.archived || subject.questionCount === 0) {
    throw new Error('Ce sujet n’est plus disponible.')
  }

  const user = db.users.find((candidate) => candidate.id === userId)
  if (!user) throw new Error('Étudiant introuvable.')

  const now = new Date()
  const assignment = createAssignment(userId, subject.id, request.id, now)
  const activatedUser: User = {
    ...user,
    status: 'active',
    activatedAt: assignment.startedAt,
    expiresAt: assignment.expiresAt,
    rejectionReason: undefined,
  }

  commit({
    ...db,
    users: db.users.map((candidate) =>
      candidate.id === userId ? activatedUser : candidate,
    ),
    requests: db.requests.map((item) =>
      item.id === requestId
        ? {
            ...item,
            chosenSubjectId: subject.id,
            chosenAt: now.toISOString(),
          }
        : item,
    ),
    assignments: [assignment, ...db.assignments],
  })
  return assignment
}

export function assignSubjectToStudent(subjectId: string, userId: string): SubjectAssignment {
  const db = getDB()
  const subject = db.subjects.find((candidate) => candidate.id === subjectId)
  if (!subject || subject.archived) throw new Error('Sujet introuvable dans la file.')
  if (subject.questionCount === 0) throw new Error('Ce sujet ne contient aucune question.')

  const student = db.users.find((candidate) => candidate.id === userId)
  if (!student || student.role !== 'student') throw new Error('Étudiant introuvable.')
  if (db.assignments.some((assignment) => assignment.userId === userId && assignment.subjectId === subjectId)) {
    throw new Error('Cet étudiant a déjà reçu ce sujet.')
  }

  const active = getActiveAssignment(userId, db)
  if (active) {
    const activeSubject = db.subjects.find((candidate) => candidate.id === active.subjectId)
    throw new Error(
      `Cet étudiant a déjà un cycle actif${activeSubject ? ` sur « ${activeSubject.title} »` : ''}. Attendez son expiration avant de lui attribuer un autre sujet.`,
    )
  }

  const pending = db.requests
    .filter((request) => request.userId === userId && request.status === 'pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const now = new Date()
  const assignment = createAssignment(userId, subjectId, pending?.id, now)
  const activatedUser: User = {
    ...student,
    status: 'active',
    activatedAt: assignment.startedAt,
    expiresAt: assignment.expiresAt,
    rejectionReason: undefined,
  }
  const requests = db.requests.map((request) => {
    if (pending && request.id === pending.id) {
      return { ...request, status: 'approved' as const, reviewedAt: now.toISOString() }
    }
    if (pending && request.userId === userId && request.status === 'pending') {
      return {
        ...request,
        status: 'rejected' as const,
        reviewedAt: now.toISOString(),
        note: 'Demande remplacée par une attribution manuelle du docteur.',
      }
    }
    return request
  })

  commit({
    ...db,
    users: db.users.map((candidate) => (candidate.id === userId ? activatedUser : candidate)),
    requests,
    assignments: [assignment, ...db.assignments],
  })
  return assignment
}

export function rejectRequest(requestId: string, note?: string) {
  const db = getDB()
  const request = db.requests.find((item) => item.id === requestId)
  if (!request) throw new Error('Demande introuvable.')
  if (request.status !== 'pending') throw new Error('Cette demande a déjà été traitée.')
  const reason = note?.trim() || 'Justificatif non conforme. Merci de transmettre un reçu lisible.'
  const now = new Date().toISOString()

  commit({
    ...db,
    requests: db.requests.map((item) =>
      item.id === requestId ? { ...item, status: 'rejected', reviewedAt: now, note: reason } : item,
    ),
    users: db.users.map((user) =>
      user.id === request.userId ? { ...user, status: 'rejected', rejectionReason: reason } : user,
    ),
  })
}

export function extendAccess(userId: string, days = 30) {
  const db = getDB()
  const user = db.users.find((candidate) => candidate.id === userId)
  if (!user) throw new Error('Étudiant introuvable.')
  if (
    db.requests.some(
      (request) =>
        request.userId === userId &&
        request.type === 'renewal' &&
        request.status === 'approved' &&
        Boolean(request.currentSubjectId) &&
        !request.chosenSubjectId,
    )
  ) {
    throw new Error('Cet étudiant doit d’abord choisir son sujet de renouvellement.')
  }

  const active = getActiveAssignment(userId, db)
  if (active) {
    const base = !isExpired(active.expiresAt) ? new Date(active.expiresAt) : new Date()
    const expiresAt = addDays(base, days).toISOString()
    commit({
      ...db,
      users: db.users.map((candidate) =>
        candidate.id === userId
          ? {
              ...candidate,
              status: 'active',
              expiresAt,
              activatedAt: candidate.activatedAt ?? active.startedAt,
              rejectionReason: undefined,
            }
          : candidate,
      ),
      assignments: db.assignments.map((assignment) =>
        assignment.id === active.id ? { ...assignment, expiresAt } : assignment,
      ),
    })
    return
  }

  const latest = getLatestAssignment(userId, db)
  const previous = latest
    ? db.subjects.find(
        (candidate) =>
          candidate.id === latest.subjectId &&
          !candidate.archived &&
          candidate.questionCount > 0,
      )
    : undefined
  const subject = previous ?? getNextSubjectForUser(userId, db)
  if (!subject) {
    throw new Error('Aucun sujet disponible dans la file pour prolonger cet accès.')
  }
  const now = new Date()
  const assignment = createAssignment(userId, subject.id, undefined, now)
  commit({
    ...db,
    users: db.users.map((candidate) =>
      candidate.id === userId
        ? {
            ...candidate,
            status: 'active',
            activatedAt: assignment.startedAt,
            expiresAt: assignment.expiresAt,
            rejectionReason: undefined,
          }
        : candidate,
    ),
    assignments: [assignment, ...db.assignments],
  })
}

export function revokeAccess(userId: string, note = 'Accès suspendu par le docteur.') {
  const db = getDB()
  const now = new Date().toISOString()
  commit({
    ...db,
    users: db.users.map((user) =>
      user.id === userId
        ? { ...user, status: 'rejected', expiresAt: now, rejectionReason: note }
        : user,
    ),
    requests: db.requests.map((request) =>
      request.userId === userId &&
      (request.status === 'pending' ||
        (request.status === 'approved' &&
          Boolean(request.currentSubjectId) &&
          !request.chosenSubjectId))
        ? { ...request, status: 'rejected', reviewedAt: now, note }
        : request,
    ),
  })
}

/* ------------------------------------------------------------------ */
/* Subjects & questions                                                */
/* ------------------------------------------------------------------ */

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

export function publishSubject(input: PublishSubjectInput): Subject {
  const db = getDB()
  if (!input.questions.length) throw new Error('Aucune question à ajouter à la file.')

  const seenNumbers = new Set<number>()
  for (const [index, question] of input.questions.entries()) {
    const label = `Question ${question.number || index + 1}`
    if (!Number.isInteger(question.number) || question.number < 1) {
      throw new Error(`${label} : le numéro de question est invalide.`)
    }
    if (seenNumbers.has(question.number)) {
      throw new Error(`${label} : ce numéro de question apparaît plusieurs fois.`)
    }
    seenNumbers.add(question.number)
    if (!question.statement?.trim()) {
      throw new Error(`${label} : l’énoncé est vide.`)
    }
    for (const letter of ['A', 'B', 'C', 'D'] as const) {
      if (!question.options?.[letter]?.trim()) {
        throw new Error(`${label} : l’option ${letter} est vide.`)
      }
    }
    if (!Array.isArray(question.correctAnswers) || question.correctAnswers.length === 0) {
      throw new Error(
        `${label} : ajoutez au moins une bonne réponse (A, B, C ou D) avant d’enregistrer le sujet.`,
      )
    }
    if (
      question.correctAnswers.some(
        (letter) => !['A', 'B', 'C', 'D'].includes(letter),
      )
    ) {
      throw new Error(`${label} : la bonne réponse doit être une lettre entre A et D.`)
    }
    if (!question.explanation?.trim()) {
      throw new Error(
        `${label} : ajoutez l’explication médicale qui sert de référence à la correction.`,
      )
    }
  }

  const now = new Date()
  const subject: Subject = {
    id: uid('subject'),
    title: input.title.trim(),
    description: input.description.trim(),
    monthLabel: input.monthLabel,
    publishedAt: now.toISOString(),
    archived: false,
    questionCount: input.questions.length,
  }
  const questions: Question[] = input.questions.map((question) => ({
    ...question,
    id: uid('q'),
    subjectId: subject.id,
  }))
  commit({
    ...db,
    subjects: [subject, ...db.subjects],
    questions: [...db.questions, ...questions],
  })
  return subject
}

export function removeSubject(subjectId: string) {
  const db = getDB()
  const subject = db.subjects.find((item) => item.id === subjectId)
  if (!subject) throw new Error('Sujet introuvable.')
  if (db.assignments.some((assignment) => assignment.subjectId === subjectId)) {
    throw new Error(
      'Ce sujet a déjà été attribué à un étudiant. Il ne peut plus être supprimé de la file.',
    )
  }
  if (db.attempts.some((attempt) => attempt.subjectId === subjectId)) {
    throw new Error('Ce sujet possède déjà un historique de résultats et ne peut pas être supprimé.')
  }
  commit({
    ...db,
    subjects: db.subjects.filter((item) => item.id !== subjectId),
    questions: db.questions.filter((question) => question.subjectId !== subjectId),
  })
}

export function getPublishedSubjects(db: Database = getDB()): Subject[] {
  return db.subjects
    .filter((subject) => !subject.archived)
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
}

export function getSubjectQuestions(subjectId: string, db: Database = getDB()): Question[] {
  return db.questions
    .filter((question) => question.subjectId === subjectId)
    .sort((a, b) => a.number - b.number)
}

/* ------------------------------------------------------------------ */
/* Attempts                                                            */
/* ------------------------------------------------------------------ */

export function saveAttempt(input: {
  userId: string
  subjectId: string
  questionIds: string[]
  answers: Record<string, string[]>
  score: number
}): Attempt {
  const db = getDB()
  const questionSnapshot = input.questionIds.map((id) =>
    db.questions.find((question) => question.id === id),
  )
  if (questionSnapshot.some((question) => !question)) {
    throw new Error('Une question de la série est introuvable dans le sujet.')
  }
  const attempt: Attempt = {
    ...input,
    id: uid('attempt'),
    total: input.questionIds.length,
    createdAt: new Date().toISOString(),
    questionSnapshot: questionSnapshot
      .filter((question): question is Question => Boolean(question))
      .map((question) => ({
        ...question,
        options: { ...question.options },
        correctAnswers: [...question.correctAnswers],
      })),
  }
  commit({ ...db, attempts: [attempt, ...db.attempts] })
  return attempt
}

export function getAttempt(attemptId: string, db: Database = getDB()) {
  return db.attempts.find((attempt) => attempt.id === attemptId)
}

/* ------------------------------------------------------------------ */
/* Demo utilities                                                      */
/* ------------------------------------------------------------------ */

export function resetDemo() {
  try {
    localStorage.removeItem(DB_KEY)
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* noop */
  }
  cache = cloneSeed()
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(cache))
  } catch {
    /* noop */
  }
  emit()
}

export function seedAccounts() {
  const db = getDB()
  const jean = db.users.find((user) => user.id === 'u_jean')
  const amina = db.users.find((user) => user.id === 'u_amina')
  return {
    professor: { email: 'prof@medqcm.fr', password: 'prof1234' },
    studentActive: { email: jean?.email ?? 'jean.dupont@email.com', password: 'etudiant1234' },
    studentPending: { email: amina?.email ?? 'amina.benali@email.com', password: 'etudiant1234' },
    studentExpired: { email: 'lucas.martin@email.com', password: 'etudiant1234' },
    studentMember: { email: 'sarah.lemoine@email.com', password: 'etudiant1234' },
  }
}
