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
import { createSeedDatabase, PROFESSOR_FIRST_NAME, PROFESSOR_LAST_NAME, randomQuestionIds } from '@/lib/seed'
import {
  PACE_THEMES,
  canonicalizeThemePack,
  findPaceTheme,
  sortThemes,
  validateThemePackInput,
  type SaveSubjectInput,
  type ThemePackInput,
} from '@/lib/themes'
import {
  addDays,
  AppError,
  isExpired,
  monthLabel,
  SERIES_LIMIT,
  SERIES_LIMIT_MESSAGE,
  SERIES_SIZE,
  sameAnswer,
  uid,
} from '@/lib/utils'

const DB_KEY = 'medqcm.db.v3'
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

  const existingPending = db.requests.find(
    (request) => request.userId === userId && request.status === 'pending',
  )
  if (existingPending) throw new Error('Une demande est déjà en attente de validation.')

  const current = getCurrentAssignment(userId, db)
  if (current && !getSeriesUsage(userId, db).reached) {
    throw new Error(
      'Votre cycle est encore actif. Vous pourrez renouveler dès que vos 30 séries seront terminées.',
    )
  }

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

export function renewNow(userId: string, fullName: string, email: string): SubjectAssignment {
  const db = getDB()
  const user = db.users.find((candidate) => candidate.id === userId)
  if (!user || user.role !== 'student') throw new Error('Compte étudiant introuvable.')

  if (user.status === 'pending') {
    throw new Error('Votre demande est en attente de validation.')
  }

  const cleanName = fullName.trim()
  const cleanEmail = email.trim()
  if (!cleanName) throw new Error('Indiquez votre nom et prénom.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Saisissez une adresse email valide.')
  }

  const current = getCurrentAssignment(userId, db)
  if (current && user.status !== 'rejected' && !getSeriesUsage(userId, db).reached) {
    throw new Error(
      'Vos 30 séries ne sont pas encore terminées. Le renouvellement sera disponible à la fin du cycle.',
    )
  }

  const now = new Date()
  const expiredAssignments = current
    ? db.assignments.map((assignment) =>
        assignment.id === current.id ? { ...assignment, expiresAt: now.toISOString() } : assignment,
      )
    : db.assignments
  const assignment = createAssignment(user.id, undefined, now)

  const [firstName, ...lastNameParts] = cleanName.split(/\s+/)
  const lastName = lastNameParts.join(' ')
  const updatedUser: User = {
    ...user,
    ...(lastName ? { firstName, lastName } : {}),
    status: 'active',
    activatedAt: assignment.startedAt,
    expiresAt: assignment.expiresAt,
    rejectionReason: undefined,
  }

  const request: AccessRequest = {
    id: uid('req'),
    userId: user.id,
    userName: cleanName,
    userEmail: cleanEmail,
    type: 'renewal',
    receipt: {
      dataUrl: '',
      name: 'Paiement en ligne',
      mime: 'text/plain',
      size: 0,
      path: 'renewal',
    },
    status: 'approved',
    createdAt: now.toISOString(),
    reviewedAt: now.toISOString(),
    note: 'Renouvellement direct après paiement.',
  }

  commit({
    ...db,
    users: db.users.map((candidate) => (candidate.id === userId ? updatedUser : candidate)),
    requests: [request, ...db.requests],
    assignments: [assignment, ...expiredAssignments],
  })
  return assignment
}

export function deleteRenewal(requestId: string) {
  const db = getDB()
  const request = db.requests.find((item) => item.id === requestId)
  if (!request || request.type !== 'renewal' || request.status !== 'approved') {
    throw new Error('Ce renouvellement est introuvable.')
  }
  commit({
    ...db,
    requests: db.requests.filter((item) => item.id !== requestId),
    assignments: db.assignments.map((assignment) =>
      assignment.requestId === requestId ? { ...assignment, requestId: undefined } : assignment,
    ),
  })
}

/* ------------------------------------------------------------------ */
/* Cycles & quota                                                      */
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

/**
 * Cycle de référence pour l'affichage : le cycle actif s'il existe, sinon le
 * dernier cycle connu (étudiant expiré). Les tentatives antérieures à son
 * ouverture ne sont jamais visibles.
 */
export function getCurrentAssignment(
  userId: string,
  db: Database = getDB(),
): SubjectAssignment | undefined {
  return getActiveAssignment(userId, db) ?? getLatestAssignment(userId, db)
}

export function getCurrentCycleAttempts(
  userId: string,
  db: Database = getDB(),
  assignment: SubjectAssignment | undefined = getCurrentAssignment(userId, db),
): Attempt[] {
  if (!assignment) return []
  const startedAt = new Date(assignment.startedAt).getTime()
  return db.attempts
    .filter(
      (attempt) =>
        attempt.userId === userId && new Date(attempt.createdAt).getTime() >= startedAt,
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export interface SeriesUsage {
  assignment?: SubjectAssignment
  used: number
  limit: number
  remaining: number
  reached: boolean
}

/** Nombre de séries soumises dans le cycle courant, au regard de la limite. */
export function getSeriesUsage(userId: string, db: Database = getDB()): SeriesUsage {
  const assignment = getCurrentAssignment(userId, db)
  const used = getCurrentCycleAttempts(userId, db, assignment).length
  return {
    assignment,
    used,
    limit: SERIES_LIMIT,
    remaining: Math.max(0, SERIES_LIMIT - used),
    reached: used >= SERIES_LIMIT,
  }
}

function createAssignment(
  userId: string,
  requestId: string | undefined,
  now: Date,
): SubjectAssignment {
  return {
    id: uid('assign'),
    userId,
    subjectId: null,
    requestId,
    startedAt: now.toISOString(),
    expiresAt: addDays(now, 36500).toISOString(),
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

  const now = new Date()
  const active = getCurrentAssignment(user.id, db)
  let assignments = db.assignments

  if (active) {
    const usage = getSeriesUsage(user.id, db)
    if (request.type !== 'renewal' || !usage.reached) {
      throw new Error(
        'Cet étudiant dispose déjà d’un cycle actif. Attendez la fin de ses 30 séries avant de valider un renouvellement.',
      )
    }
    // Le renouvellement est autorisé dès que le quota de séries est atteint :
    // l'ancien cycle est clos à cet instant.
    assignments = db.assignments.map((assignment) =>
      assignment.id === active.id
        ? { ...assignment, expiresAt: now.toISOString() }
        : assignment,
    )
  }

  const assignment = createAssignment(user.id, request.id, now)
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
    assignments: [assignment, ...assignments],
  })
  return activatedUser
}

/**
 * Attribution manuelle historique. Le cycle reste indépendant d'un thème :
 * le sujet transmis sert uniquement de contrôle de disponibilité.
 */
export function assignSubjectToStudent(subjectId: string, userId: string): SubjectAssignment {
  const db = getDB()
  const subject = db.subjects.find((candidate) => candidate.id === subjectId)
  if (!subject || subject.archived) throw new Error('Thème introuvable dans le catalogue.')
  if (subject.questionCount === 0) throw new Error('Ce thème ne contient aucune question.')

  const student = db.users.find((candidate) => candidate.id === userId)
  if (!student || student.role !== 'student') throw new Error('Étudiant introuvable.')

  const active = getActiveAssignment(userId, db)
  if (active) {
    throw new Error(
      'Cet étudiant a déjà un cycle actif. Attendez son expiration avant de lui attribuer un nouveau cycle.',
    )
  }

  const pending = db.requests
    .filter((request) => request.userId === userId && request.status === 'pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const now = new Date()
  const assignment = createAssignment(userId, pending?.id, now)
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

  const now = new Date()
  const assignment = createAssignment(userId, undefined, now)
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
    assignments: db.assignments.map((assignment) =>
      assignment.userId === userId && !isExpired(assignment.expiresAt)
        ? { ...assignment, expiresAt: now }
        : assignment,
    ),
    requests: db.requests.map((request) =>
      request.userId === userId && request.status === 'pending'
        ? { ...request, status: 'rejected', reviewedAt: now, note }
        : request,
    ),
  })
}

/* ------------------------------------------------------------------ */
/* Themes & questions                                                  */
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

function validateQuestion(
  question: SubjectQuestionInput,
  label: string,
  singleAnswer: boolean,
) {
  if (!Number.isInteger(question.number) || question.number < 1) {
    throw new Error(`${label} : le numéro de question est invalide.`)
  }
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
      `${label} : ajoutez au moins une bonne réponse (A, B, C ou D) avant d’enregistrer le thème.`,
    )
  }
  if (singleAnswer && question.correctAnswers.length !== 1) {
    throw new Error(`${label} : une seule bonne réponse (A, B, C ou D) est attendue.`)
  }
  if (question.correctAnswers.some((letter) => !['A', 'B', 'C', 'D'].includes(letter))) {
    throw new Error(`${label} : la bonne réponse doit être une lettre entre A et D.`)
  }
  if (!question.explanation?.trim()) {
    throw new Error(
      `${label} : ajoutez l’explication médicale qui sert de référence à la correction.`,
    )
  }
}

/**
 * Publie les neuf thèmes en une seule écriture. Un seul thème invalide bloque
 * tout le pack : le catalogue ne peut jamais être partiel.
 */
export function publishThemePack(input: ThemePackInput): Subject[] {
  const errors = validateThemePackInput(input.themes)
  if (errors.length) throw new AppError('INVALID_THEME_PACK', errors.join(' '))

  const db = getDB()
  const themes = canonicalizeThemePack(input.themes)
  const now = new Date()
  const nextSubjects = [...db.subjects]
  const nextQuestions = [...db.questions]
  const published: Subject[] = []

  themes.forEach((themeInput, index) => {
    const definition = PACE_THEMES[index]
    const existingIndex = nextSubjects.findIndex(
      (subject) =>
        subject.id === definition.id || findPaceTheme(subject.title)?.id === definition.id,
    )
    const id = existingIndex >= 0 ? nextSubjects[existingIndex].id : definition.id

    themeInput.questions.forEach((question, questionIndex) =>
      validateQuestion(
        question,
        `${definition.title}, question ${question.number || questionIndex + 1}`,
        true,
      ),
    )

    const subject: Subject = {
      id,
      title: definition.title,
      description: themeInput.description.trim() || definition.description,
      monthLabel: themeInput.monthLabel.trim(),
      publishedAt: now.toISOString(),
      archived: false,
      questionCount: themeInput.questions.length,
    }
    if (existingIndex >= 0) nextSubjects[existingIndex] = subject
    else nextSubjects.push(subject)

    for (let i = nextQuestions.length - 1; i >= 0; i -= 1) {
      if (nextQuestions[i].subjectId === id) nextQuestions.splice(i, 1)
    }
    themeInput.questions.forEach((question) => {
      nextQuestions.push({
        ...question,
        id: uid('q'),
        subjectId: id,
        matiere: question.matiere?.trim() || definition.title,
      })
    })
    published.push(subject)
  })

  commit({ ...db, subjects: nextSubjects, questions: nextQuestions })
  return sortThemes(published)
}

/** Ancien point d'entrée conservé pour compatibilité : hors interface docteur. */
export function publishSubject(input: PublishSubjectInput): Subject {
  const db = getDB()
  if (!input.questions.length) throw new Error('Aucune question à ajouter au catalogue.')
  const seenNumbers = new Set<number>()
  input.questions.forEach((question, index) => {
    validateQuestion(question, `Question ${question.number || index + 1}`, false)
    if (seenNumbers.has(question.number)) {
      throw new Error(`Question ${question.number} : ce numéro apparaît plusieurs fois.`)
    }
    seenNumbers.add(question.number)
  })

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

/**
 * Enregistre un sujet rattaché à l'un des neuf thèmes PACES. Un seul sujet
 * actif existe par thème : une nouvelle sauvegarde met à jour le sujet existant
 * au lieu de créer un doublon. Les tentatives déjà enregistrées ne sont jamais
 * supprimées ; leurs questions gardent le même identifiant quand le numéro est
 * conservé.
 */
export function saveSubject(input: SaveSubjectInput): Subject {
  const definition =
    PACE_THEMES.find((theme) => theme.id === input.themeId) ?? findPaceTheme(input.title)
  if (!definition) {
    throw new AppError('INVALID_THEME', 'Ce sujet ne correspond à aucun des neuf thèmes PACES.')
  }

  const db = getDB()
  const existingIndex = db.subjects.findIndex(
    (subject) =>
      subject.id === definition.id || findPaceTheme(subject.title)?.id === definition.id,
  )
  const existing = existingIndex >= 0 ? db.subjects[existingIndex] : undefined
  const hasQuestions = Boolean(input.questions?.length)

  if (!hasQuestions && !existing) {
    throw new AppError(
      'EMPTY_SUBJECT',
      'Ajoutez le fichier des questions et celui de la correction avant d’enregistrer le sujet.',
    )
  }

  if (hasQuestions && input.questions) {
    if (input.questions.length < SERIES_SIZE) {
      throw new AppError(
        'INVALID_CORRECTION',
        `Une série comporte ${SERIES_SIZE} questions : ajoutez au moins ${SERIES_SIZE} questions valides.`,
      )
    }
    const seenNumbers = new Set<number>()
    input.questions.forEach((question, index) => {
      validateQuestion(question, `Question ${question.number || index + 1}`, true)
      if (seenNumbers.has(question.number)) {
        throw new AppError(
          'INVALID_CORRECTION',
          `Question ${question.number} : ce numéro apparaît plusieurs fois.`,
        )
      }
      seenNumbers.add(question.number)
    })
  }

  const now = new Date().toISOString()
  const subject: Subject = {
    id: existing?.id ?? definition.id,
    title: definition.title,
    description: input.description.trim(),
    monthLabel: input.monthLabel.trim() || existing?.monthLabel || monthLabel(),
    publishedAt: now,
    archived: false,
    questionCount: hasQuestions ? input.questions!.length : existing!.questionCount,
    questionFileName:
      input.questionFileName?.trim() || existing?.questionFileName || '',
    answerFileName: input.answerFileName?.trim() || existing?.answerFileName || '',
  }

  const subjects =
    existingIndex >= 0
      ? db.subjects.map((candidate, index) => (index === existingIndex ? subject : candidate))
      : [...db.subjects, subject]

  let questions = db.questions
  if (hasQuestions && input.questions) {
    const previousById = new Map(
      db.questions
        .filter((question) => question.subjectId === subject.id)
        .map((question) => [question.number, question.id]),
    )
    questions = [
      ...db.questions.filter((question) => question.subjectId !== subject.id),
      ...input.questions.map((question) => ({
        ...question,
        // Conserve l'identifiant des questions déjà présentes afin que les
        // anciennes tentatives sans copie figée restent consultables.
        id: previousById.get(question.number) ?? uid('q'),
        subjectId: subject.id,
        matiere: question.matiere?.trim() || definition.title,
      })),
    ]
  }

  // Archive d'éventuels doublons historiques du même thème.
  const nextSubjects = subjects.map((candidate) =>
    candidate.id !== subject.id &&
    !candidate.archived &&
    findPaceTheme(candidate.title)?.id === definition.id
      ? { ...candidate, archived: true }
      : candidate,
  )

  commit({ ...db, subjects: nextSubjects, questions })
  return subject
}

export function removeSubject(subjectId: string) {
  const db = getDB()
  const subject = db.subjects.find((item) => item.id === subjectId)
  if (!subject) throw new Error('Thème introuvable.')
  if (db.assignments.some((assignment) => assignment.subjectId === subjectId)) {
    throw new Error(
      'Ce thème est lié à un ancien cycle. Il ne peut plus être supprimé du catalogue.',
    )
  }
  if (db.attempts.some((attempt) => attempt.subjectId === subjectId)) {
    throw new Error('Ce thème possède déjà un historique de résultats et ne peut pas être supprimé.')
  }
  commit({
    ...db,
    subjects: db.subjects.filter((item) => item.id !== subjectId),
    questions: db.questions.filter((question) => question.subjectId !== subjectId),
  })
}

export function getPublishedSubjects(db: Database = getDB()): Subject[] {
  return sortThemes(db.subjects.filter((subject) => !subject.archived))
}

export function getSubjectQuestions(subjectId: string, db: Database = getDB()): Question[] {
  return db.questions
    .filter((question) => question.subjectId === subjectId)
    .sort((a, b) => a.number - b.number)
}

/** Banque réellement utilisable pour une série : questions à réponse unique. */
export function getUsableQuestions(subjectId: string, db: Database = getDB()): Question[] {
  return getSubjectQuestions(subjectId, db).filter(
    (question) => question.correctAnswers.length === 1,
  )
}

/* ------------------------------------------------------------------ */
/* Attempts                                                            */
/* ------------------------------------------------------------------ */

export interface StartedSeries {
  assignment: SubjectAssignment
  subject: Subject
  questions: Question[]
}

/** Ouvre une série tirée au hasard, sans jamais envoyer le corrigé au client. */
export function startSeries(
  userId: string,
  subjectId: string,
  count = SERIES_SIZE,
): StartedSeries {
  const db = getDB()
  const assignment = getCurrentAssignment(userId, db)
  if (!assignment) {
    throw new AppError('ACCESS_EXPIRED', 'Votre accès n’est plus actif. Renouvelez votre abonnement pour continuer.')
  }
  if (getSeriesUsage(userId, db).reached) {
    throw new AppError('SERIES_LIMIT_REACHED', SERIES_LIMIT_MESSAGE)
  }

  const subject = db.subjects.find((candidate) => candidate.id === subjectId)
  if (!subject || subject.archived) {
    throw new AppError('THEME_NOT_FOUND', 'Ce thème est introuvable dans le catalogue.')
  }

  const bank = getUsableQuestions(subjectId, db)
  if (bank.length < SERIES_SIZE) {
    throw new AppError(
      'THEME_UNAVAILABLE',
      `« ${subject.title} » sera bientôt disponible : le docteur prépare ses questions.`,
    )
  }

  const size = Math.max(1, Math.min(count, SERIES_SIZE))
  const ids = randomQuestionIds(bank, size)
  const questions = ids
    .map((id) => bank.find((question) => question.id === id))
    .filter((question): question is Question => Boolean(question))

  return {
    assignment,
    subject,
    questions: questions.map((question) => ({
      ...question,
      correctAnswers: [],
      explanation: '',
    })),
  }
}

export function saveAttempt(input: {
  userId: string
  subjectId: string
  questionIds: string[]
  answers: Record<string, string[]>
}): Attempt {
  const db = getDB()
  const assignment = getCurrentAssignment(input.userId, db)
  if (!assignment) {
    throw new AppError('ACCESS_EXPIRED', 'Votre accès n’est plus actif. Renouvelez votre abonnement pour continuer.')
  }
  if (getSeriesUsage(input.userId, db).reached) {
    throw new AppError('SERIES_LIMIT_REACHED', SERIES_LIMIT_MESSAGE)
  }

  const subject = db.subjects.find((candidate) => candidate.id === input.subjectId)
  if (!subject || subject.archived) {
    throw new AppError('THEME_NOT_FOUND', 'Ce thème est introuvable dans le catalogue.')
  }
  if (new Set(input.questionIds).size !== input.questionIds.length) {
    throw new AppError('DUPLICATE_QUESTIONS', 'La série contient des questions en double.')
  }
  if (input.questionIds.length !== SERIES_SIZE) {
    throw new AppError(
      'INVALID_QUESTION_SET',
      `Une série doit contenir exactement ${SERIES_SIZE} questions.`,
    )
  }

  const questionSnapshot = input.questionIds.map((id) =>
    db.questions.find((question) => question.id === id && question.subjectId === subject.id),
  )
  if (questionSnapshot.some((question) => !question)) {
    throw new AppError(
      'INVALID_QUESTION_SET',
      'La série envoyée ne correspond pas au thème sélectionné.',
    )
  }

  const questions = questionSnapshot.filter(
    (question): question is Question => Boolean(question),
  )
  const score = questions.reduce(
    (total, question) =>
      total + (sameAnswer(input.answers[question.id] ?? [], question.correctAnswers) ? 1 : 0),
    0,
  )

  const attempt: Attempt = {
    id: uid('attempt'),
    userId: input.userId,
    subjectId: subject.id,
    questionIds: input.questionIds,
    answers: input.answers,
    score,
    total: input.questionIds.length,
    createdAt: new Date().toISOString(),
    questionSnapshot: questions.map((question) => ({
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

/**
 * Corrigé d'une tentative. Un étudiant ne voit que les séries de son cycle
 * courant ; le docteur conserve l'accès à tout l'historique.
 */
export function getAttemptForReview(
  attemptId: string,
  viewerId?: string,
  db: Database = getDB(),
): { attempt: Attempt; questions: Question[] } {
  const attempt = getAttempt(attemptId, db)
  if (!attempt) {
    throw new AppError('ATTEMPT_NOT_FOUND', 'Ce résultat est introuvable.')
  }

  if (viewerId) {
    const viewer = db.users.find((candidate) => candidate.id === viewerId)
    if (!viewer) throw new AppError('ATTEMPT_NOT_FOUND', 'Ce résultat est introuvable.')
    if (viewer.role !== 'professor') {
      if (attempt.userId !== viewer.id) {
        throw new AppError('ATTEMPT_NOT_FOUND', 'Ce résultat est introuvable.')
      }
      const current = getCurrentAssignment(viewer.id, db)
      if (!current || new Date(attempt.createdAt).getTime() < new Date(current.startedAt).getTime()) {
        throw new AppError(
          'ATTEMPT_OUT_OF_CYCLE',
          'Ce résultat appartient à un cycle précédent et n’est plus accessible.',
        )
      }
    }
  }

  const questions = attempt.questionSnapshot?.length
    ? attempt.questionSnapshot
    : attempt.questionIds
        .map((id) => db.questions.find((question) => question.id === id))
        .filter((question): question is Question => Boolean(question))

  return { attempt, questions }
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
    studentQuotaReached: { email: 'clara.fontaine@email.com', password: 'etudiant1234' },
  }
}
