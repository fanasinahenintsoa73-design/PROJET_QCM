import type {
  MedgameAnswerInput,
  MedgameAnswerResult,
  MedgameLevel,
  MedgameOverview,
  MedgameProgress,
  MedgameResult,
  MedgameRun,
  MedgameRunState,
  Question,
  SeriesQuota,
} from '@/types'
import { getDB, getSeriesUsage, getUsableQuestions } from '@/lib/db'
import {
  getActiveProgress,
  getActiveRun,
  getLatestRunForProgress,
  getProgressById,
  getRunById,
  getRunAnswers,
  hasRunConsumption,
  recordMedgameConsumption,
  saveProgress,
  saveRun,
  saveRunAnswers,
  sweepExpiredRuns,
  archiveOtherProgresses,
} from '@/lib/medgameStore'
import { findChapterSelectionSubjects } from '@/lib/subjects'
import { PACE_THEMES } from '@/lib/themes'
import {
  AppError,
  SERIES_LIMIT_MESSAGE,
  sameAnswer,
  shuffle,
  uid,
} from '@/lib/utils'

const LEVEL_SIZE = 5

function toQuota(userId: string): SeriesQuota {
  const usage = getSeriesUsage(userId)
  return {
    used: usage.used,
    limit: usage.limit,
    remaining: usage.remaining,
    reached: usage.reached,
  }
}

function assertAccess(studentId: string): void {
  const usage = getSeriesUsage(studentId)
  if (!usage.assignment) {
    throw new AppError(
      'ACCESS_EXPIRED',
      'Votre accès n’est plus actif. Contactez le docteur pour un nouveau ticket.',
    )
  }
}

function normalizeStatement(statement: string): string {
  return statement
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function buildQuestionBank(chapterIds: readonly string[]): Question[] {
  const db = getDB()
  const subjects = findChapterSelectionSubjects(chapterIds, db.subjects)
  const seen = new Set<string>()
  const bank: Question[] = []

  for (const subject of subjects) {
    for (const question of getUsableQuestions(subject.id, db)) {
      const key = normalizeStatement(question.statement)
      if (seen.has(key)) continue
      seen.add(key)
      bank.push(question)
    }
  }

  return shuffle(bank)
}

function levelQuestions(progress: MedgameProgress, level: number): Question[] {
  const start = Math.max(0, (level - 1) * LEVEL_SIZE)
  const ids = progress.questionIds.slice(start, start + LEVEL_SIZE)
  const snapshots = progress.questionSnapshots ?? []
  const byId = new Map(snapshots.map((question) => [question.id, question]))
  const db = getDB()

  return ids
    .map((id) => byId.get(id) ?? db.questions.find((question) => question.id === id))
    .filter((question): question is Question => Boolean(question))
}

function levelsFor(progress: MedgameProgress | null): MedgameLevel[] {
  if (!progress) return []
  return Array.from({ length: progress.levelCount }, (_, index) => {
    const level = index + 1
    const status: MedgameLevel['status'] =
      progress.status === 'completed' || level < progress.currentLevel
        ? 'passed'
        : level === progress.currentLevel
          ? 'unlocked'
          : 'locked'
    const remaining = progress.questionIds.length - index * LEVEL_SIZE
    return {
      level,
      totalLevels: progress.levelCount,
      questionCount: Math.max(0, Math.min(LEVEL_SIZE, remaining)),
      status,
      bestStars: bestStarsFor(progress, level),
    }
  })
}

/** Meilleure tentative connue pour un niveau (0 à 5 étoiles). */
function bestStarsFor(progress: MedgameProgress, level: number): number {
  const stars = progress.levelStars?.[String(level)]
  return Number.isFinite(stars) ? Math.max(0, Math.min(LEVEL_SIZE, stars as number)) : 0
}

/**
 * Mémorise les étoiles d'un niveau réussi. Seul le meilleur score est
 * conservé : un échec plus tard ne doit jamais effacer les étoiles déjà
 * gagnées sur ce niveau.
 */
function recordLevelStars(
  progress: MedgameProgress,
  level: number,
  stars: number,
): void {
  const key = String(level)
  const previous = progress.levelStars?.[key] ?? 0
  progress.levelStars = {
    ...(progress.levelStars ?? {}),
    [key]: Math.max(previous, stars),
  }
}

function progressForRun(run: MedgameRun): MedgameProgress {
  const progress = getProgressById(run.progressId)
  if (!progress) {
    throw new AppError('MEDGAME_NOT_FOUND', 'Ce parcours MEDGAME est introuvable.')
  }
  return progress
}

function runState(run: MedgameRun): MedgameRunState {
  const progress = progressForRun(run)
  return {
    run,
    progress,
    questions: levelQuestions(progress, run.currentLevel),
    levels: levelsFor(progress),
    quota: toQuota(run.studentId),
  }
}

export function getMedgameOverview(studentId: string): MedgameOverview {
  sweepExpiredRuns(studentId)
  const run = getActiveRun(studentId)
  const progress = run ? progressForRun(run) : getActiveProgress(studentId)
  return {
    progress,
    run,
    levels: levelsFor(progress),
    quota: toQuota(studentId),
  }
}

export function createMedgameProgress(input: {
  studentId: string
  ueId: string
  chapterIds: string[]
}): MedgameOverview {
  assertAccess(input.studentId)

  if (getActiveRun(input.studentId)) {
    throw new AppError(
      'MEDGAME_RUN_ACTIVE',
      'Une partie MEDGAME est déjà en cours. Reprenez-la avant de changer de parcours.',
    )
  }

  const theme = PACE_THEMES.find((candidate) => candidate.id === input.ueId)
  if (!theme) {
    throw new AppError('THEME_NOT_FOUND', 'Cette UE est introuvable.')
  }

  const chapterIds = [...new Set(input.chapterIds)].filter(Boolean)
  if (!chapterIds.length) {
    throw new AppError('NO_CHAPTER', 'Veuillez sélectionner au moins un chapitre.')
  }
  if (
    chapterIds.some(
      (chapterId) => !theme.chapters.some((chapter) => chapter.id === chapterId),
    )
  ) {
    throw new AppError(
      'INVALID_CHAPTER',
      'Un chapitre sélectionné n’appartient pas à cette UE.',
    )
  }

  const bank = buildQuestionBank(chapterIds)
  if (!bank.length) {
    throw new AppError(
      'MEDGAME_EMPTY_BANK',
      'Cette sélection ne contient encore aucune question. Choisissez un autre chapitre.',
    )
  }

  const now = new Date().toISOString()
  const progress: MedgameProgress = {
    id: uid('medprogress'),
    studentId: input.studentId,
    ueId: input.ueId,
    chapterIds,
    questionIds: bank.map((question) => question.id),
    questionSnapshots: bank.map((question) => ({
      ...question,
      options: { ...question.options },
      correctAnswers: [...question.correctAnswers],
    })),
    levelStars: {},
    levelCount: Math.ceil(bank.length / LEVEL_SIZE),
    currentLevel: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }

  archiveOtherProgresses(input.studentId, progress.id)
  saveProgress(progress)

  return getMedgameOverview(input.studentId)
}

/**
 * Démarre une run sur le parcours actif, ou reprend la run active si elle
 * existe encore. Une run reprise après un abandon consomme immédiatement une
 * nouvelle série ; une run neuve ne consomme qu'à sa fin.
 */
export function startMedgameRun(studentId: string): MedgameRunState {
  assertAccess(studentId)
  sweepExpiredRuns(studentId)

  const active = getActiveRun(studentId)
  if (active) return runState(active)

  const progress = getActiveProgress(studentId)
  if (!progress) {
    throw new AppError(
      'MEDGAME_NO_PROGRESS',
      'Choisissez d’abord une UE et au moins un chapitre.',
    )
  }

  const quota = getSeriesUsage(studentId)
  if (quota.reached) {
    throw new AppError('SERIES_LIMIT_REACHED', SERIES_LIMIT_MESSAGE)
  }

  const latest = getLatestRunForProgress(progress.id)
  const now = new Date().toISOString()
  const run: MedgameRun = {
    id: uid('medrun'),
    progressId: progress.id,
    studentId,
    status: 'in_progress',
    currentLevel: progress.currentLevel,
    startedAt: now,
    lastActivityAt: now,
    resumedFromRunId:
      latest && latest.status === 'abandoned' ? latest.id : undefined,
  }

  if (run.resumedFromRunId) {
    const consumed = recordMedgameConsumption(
      studentId,
      run.id,
      'resume_after_abandonment',
    )
    if (consumed) {
      run.consumedAt = now
      run.consumedReason = 'resume_after_abandonment'
    }
  }

  saveRun(run)
  return runState(run)
}

export function getMedgameRun(runId: string): MedgameRunState {
  const run = getRunById(runId)
  if (!run) {
    throw new AppError('MEDGAME_NOT_FOUND', 'Cette partie MEDGAME est introuvable.')
  }
  return runState(run)
}

export function heartbeatMedgameRun(runId: string): void {
  const run = getRunById(runId)
  if (!run || run.status !== 'in_progress') return
  run.lastActivityAt = new Date().toISOString()
  saveRun(run)
}

export function abandonMedgameRun(runId: string): boolean {
  const run = getRunById(runId)
  if (!run || run.status !== 'in_progress') return false
  const now = new Date().toISOString()
  run.status = 'abandoned'
  run.endedAt = now
  const consumed = recordMedgameConsumption(run.studentId, run.id, 'abandonment')
  if (consumed) {
    run.consumedAt = now
    run.consumedReason = 'abandonment'
  }
  saveRun(run)
  return true
}

export function submitMedgameLevel(
  runId: string,
  answers: MedgameAnswerInput[],
): MedgameResult {
  const run = getRunById(runId)
  if (!run) {
    throw new AppError('MEDGAME_NOT_FOUND', 'Cette partie MEDGAME est introuvable.')
  }
  if (run.status !== 'in_progress') {
    throw new AppError('MEDGAME_CLOSED', 'Cette partie MEDGAME est déjà terminée.')
  }

  const progress = progressForRun(run)
  const level = run.currentLevel
  const questions = levelQuestions(progress, level)
  if (!questions.length) {
    throw new AppError('MEDGAME_EMPTY_LEVEL', 'Ce niveau ne contient aucune question.')
  }

  const givenByQuestion = new Map(
    answers.map((answer) => [answer.questionId, [...answer.given]]),
  )
  const results: MedgameAnswerResult[] = questions.map((question) => {
    const given = givenByQuestion.get(question.id) ?? []
    return {
      questionId: question.id,
      given,
      correctAnswers: [...question.correctAnswers],
      explanation: question.explanation,
      correct: sameAnswer(given, question.correctAnswers),
    }
  })

  const correct = results.filter((result) => result.correct).length
  const total = results.length
  const passed = correct === total
  const now = new Date().toISOString()
  const previousAnswers = getRunAnswers(run.id).filter(
    (answer) => !results.some((result) => result.questionId === answer.questionId),
  )
  saveRunAnswers(run.id, [...previousAnswers, ...results])

  let completed = false
  let failed = false
  let consumed = false

  if (passed) {
    // Les étoiles du niveau réussi sont conservées dans la progression :
    // le meilleur score est gardé, même après un échec plus tard.
    recordLevelStars(progress, level, correct)

    if (level >= progress.levelCount) {
      completed = true
      run.status = 'completed'
      run.endedAt = now
      progress.status = 'completed'
      progress.currentLevel = progress.levelCount + 1
      progress.updatedAt = now
      saveProgress(progress)
      saveRun(run)
      // La série n'est consommée qu'à la fin du parcours.
      consumed = recordMedgameConsumption(run.studentId, run.id, 'completion')
    } else {
      run.currentLevel = level + 1
      progress.currentLevel = level + 1
      progress.updatedAt = now
      saveProgress(progress)
      saveRun(run)
    }
  } else {
    failed = true
    run.status = 'failed'
    run.endedAt = now
    progress.currentLevel = level
    progress.updatedAt = now
    saveProgress(progress)
    saveRun(run)
    consumed = recordMedgameConsumption(run.studentId, run.id, 'failure')
  }

  return {
    runId: run.id,
    level,
    correct,
    total,
    stars: correct,
    passed,
    completed,
    failed,
    nextLevel: completed ? null : run.currentLevel,
    answers: results,
    consumed,
    quota: toQuota(run.studentId),
  }
}

export function getMedgameRunAnswers(runId: string): MedgameAnswerResult[] {
  return getRunAnswers(runId)
}

/** Vrai si la run a déjà consommé une série (reprise après abandon). */
export function medgameRunWasConsumed(runId: string): boolean {
  return hasRunConsumption(runId)
}
