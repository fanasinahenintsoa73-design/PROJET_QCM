import type { MedgameAnswerResult, MedgameProgress, MedgameRun } from '@/types'
import { uid } from '@/lib/utils'

/**
 * Stockage local du moteur MEDGAME (mode démonstration).
 *
 * Ce fichier est volontairement indépendant de `db.ts` : `db.ts` peut ainsi
 * compter les séries MEDGAME sans créer de dépendance circulaire. Le moteur
 * MEDGAME lui-même vit dans `medgame.ts` et utilise ce store.
 */

const MEDGAME_KEY = 'medqcm.medgame.v4'

export type MedgameConsumptionReason =
  | 'failure'
  | 'completion'
  | 'abandonment'
  | 'resume_after_abandonment'

export interface MedgameConsumption {
  id: string
  studentId: string
  runId: string
  reason: MedgameConsumptionReason
  createdAt: string
}

interface MedgameStore {
  progresses: MedgameProgress[]
  runs: MedgameRun[]
  answers: Record<string, MedgameAnswerResult[]>
  consumptions: MedgameConsumption[]
}

function emptyStore(): MedgameStore {
  return { progresses: [], runs: [], answers: {}, consumptions: [] }
}

/**
 * Les étoiles par niveau sont stockées avec la progression. Les progressions
 * enregistrées avant cette feature (ou une entrée corrompue) sont complétées
 * avec un objet vide : le parcours reste jouable.
 */
function normalizeProgress(progress: MedgameProgress): MedgameProgress {
  const stars = progress.levelStars
  if (!stars || typeof stars !== 'object' || Array.isArray(stars)) {
    return { ...progress, levelStars: {} }
  }
  const cleaned: Record<string, number> = {}
  for (const [level, value] of Object.entries(stars)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      cleaned[level] = Math.max(0, Math.round(value))
    }
  }
  return { ...progress, levelStars: cleaned }
}

function readStore(): MedgameStore {
  try {
    if (typeof localStorage === 'undefined') return emptyStore()
    const raw = localStorage.getItem(MEDGAME_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as Partial<MedgameStore>
    return {
      progresses: (Array.isArray(parsed.progresses) ? parsed.progresses : []).map(
        normalizeProgress,
      ),
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      answers:
        parsed.answers && typeof parsed.answers === 'object' && !Array.isArray(parsed.answers)
          ? parsed.answers
          : {},
      consumptions: Array.isArray(parsed.consumptions) ? parsed.consumptions : [],
    }
  } catch {
    return emptyStore()
  }
}

function writeStore(store: MedgameStore): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(MEDGAME_KEY, JSON.stringify(store))
  } catch {
    /* stockage indisponible : on reste en mémoire */
  }
}

export function getMedgameConsumptionCount(studentId: string): number {
  // Le balayage est aussi déclenché à l'affichage du quota : une run laissée
  // sans heartbeat est comptée même si l'étudiant ne rouvre pas MEDGAME.
  sweepExpiredRuns(studentId)
  return readStore().consumptions.filter((item) => item.studentId === studentId).length
}

export function hasRunConsumption(runId: string): boolean {
  return readStore().consumptions.some((item) => item.runId === runId)
}

export function recordMedgameConsumption(
  studentId: string,
  runId: string,
  reason: MedgameConsumptionReason,
): boolean {
  const store = readStore()
  if (store.consumptions.some((item) => item.runId === runId)) return false
  const now = new Date().toISOString()
  store.consumptions.push({
    id: uid('medcons'),
    studentId,
    runId,
    reason,
    createdAt: now,
  })
  const run = store.runs.find((item) => item.id === runId)
  if (run) {
    run.consumedAt = now
    run.consumedReason = reason
  }
  writeStore(store)
  return true
}

/**
 * Rafraîchit l'activité de toutes les parties actives de l'étudiant.
 *
 * Tant que l'étudiant reste dans MEDGAME, aucune partie n'est abandonnée :
 * passer d'une UE à l'autre n'est pas une sortie de MEDGAME.
 */
export function touchMedgameRuns(studentId: string): number {
  const store = readStore()
  const now = new Date().toISOString()
  let touched = 0
  for (const run of store.runs) {
    if (run.studentId !== studentId || run.status !== 'in_progress') continue
    run.lastActivityAt = now
    touched += 1
  }
  if (touched > 0) writeStore(store)
  return touched
}

/**
 * Marque abandonnée toute run active sans activité depuis plus de deux
 * minutes, et enregistre la consommation. Idempotent.
 */
export function sweepExpiredRuns(
  studentId: string,
  now = Date.now(),
  graceMs = 2 * 60 * 1000,
): number {
  const store = readStore()
  let changed = false
  for (const run of store.runs) {
    if (run.studentId !== studentId || run.status !== 'in_progress') continue
    const last = Date.parse(run.lastActivityAt || run.startedAt)
    if (!Number.isFinite(last) || now - last <= graceMs) continue
    run.status = 'abandoned'
    run.endedAt = new Date(now).toISOString()
    if (!store.consumptions.some((item) => item.runId === run.id)) {
      store.consumptions.push({
        id: uid('medcons'),
        studentId,
        runId: run.id,
        reason: 'abandonment',
        createdAt: new Date(now).toISOString(),
      })
      run.consumedAt = new Date(now).toISOString()
      run.consumedReason = 'abandonment'
    }
    changed = true
  }
  if (changed) writeStore(store)
  return changed ? 1 : 0
}

export function getActiveProgress(
  studentId: string,
  ueId?: string,
): MedgameProgress | null {
  const progresses = readStore().progresses.filter(
    (item) =>
      item.studentId === studentId &&
      item.status === 'active' &&
      (ueId === undefined || item.ueId === ueId),
  )
  return (
    progresses.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0] ?? null
  )
}

/** Toutes les planches ouvertes de l'étudiant : une par UE choisie. */
export function listActiveProgresses(studentId: string): MedgameProgress[] {
  return readStore()
    .progresses.filter((item) => item.studentId === studentId && item.status === 'active')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getProgressById(progressId: string): MedgameProgress | null {
  return readStore().progresses.find((item) => item.id === progressId) ?? null
}

export function getActiveRun(
  studentId: string,
  progressId?: string,
): MedgameRun | null {
  const runs = readStore().runs.filter(
    (item) =>
      item.studentId === studentId &&
      item.status === 'in_progress' &&
      (progressId === undefined || item.progressId === progressId),
  )
  return (
    runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0] ??
    null
  )
}

export function getLatestRunForProgress(progressId: string): MedgameRun | null {
  const runs = readStore().runs.filter((item) => item.progressId === progressId)
  return (
    runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0] ??
    null
  )
}

export function getRunById(runId: string): MedgameRun | null {
  return readStore().runs.find((item) => item.id === runId) ?? null
}

export function saveProgress(progress: MedgameProgress): void {
  const store = readStore()
  const index = store.progresses.findIndex((item) => item.id === progress.id)
  if (index >= 0) store.progresses[index] = progress
  else store.progresses.push(progress)
  writeStore(store)
}

/**
 * Archive les parcours d'une même UE : changer les chapitres d'une UE ne
 * touche pas les planches ouvertes dans les autres UE.
 */
export function archiveOtherProgresses(
  studentId: string,
  ueId: string,
  keepId: string,
): void {
  const store = readStore()
  let changed = false
  for (const progress of store.progresses) {
    if (
      progress.studentId === studentId &&
      progress.ueId === ueId &&
      progress.id !== keepId &&
      progress.status === 'active'
    ) {
      progress.status = 'archived'
      progress.updatedAt = new Date().toISOString()
      changed = true
    }
  }
  if (changed) writeStore(store)
}

export function saveRun(run: MedgameRun): void {
  const store = readStore()
  const index = store.runs.findIndex((item) => item.id === run.id)
  if (index >= 0) store.runs[index] = run
  else store.runs.push(run)
  writeStore(store)
}

export function saveRunAnswers(runId: string, answers: MedgameAnswerResult[]): void {
  const store = readStore()
  store.answers[runId] = answers
  writeStore(store)
}

export function getRunAnswers(runId: string): MedgameAnswerResult[] {
  return readStore().answers[runId] ?? []
}

export function resetMedgameStore(): void {
  writeStore(emptyStore())
}

/**
 * Remet à zéro le cycle MEDGAME d'un étudiant : les consommations du cycle
 * précédent sont purgées, les parcours actifs archivés et les runs en cours
 * refermés. Utilisé lors du renouvellement d'un ticket, pour que le quota
 * partagé reparte de zéro.
 */
export function resetMedgameCycle(studentId: string): void {
  const store = readStore()
  const now = new Date().toISOString()
  store.consumptions = store.consumptions.filter((item) => item.studentId !== studentId)
  for (const progress of store.progresses) {
    if (progress.studentId === studentId && progress.status === 'active') {
      progress.status = 'archived'
      progress.updatedAt = now
    }
  }
  for (const run of store.runs) {
    if (run.studentId === studentId && run.status === 'in_progress') {
      run.status = 'abandoned'
      run.endedAt = now
    }
  }
  writeStore(store)
}
