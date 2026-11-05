import type { SeriesFeedback } from '@/types'

export type { SeriesFeedback }

const STORAGE_KEY = 'medqcm.series-feedback.v1'
const MAX_COMMENT_LENGTH = 500

type FeedbackStore = Record<string, SeriesFeedback>

function readStore(): FeedbackStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as FeedbackStore
  } catch {
    return {}
  }
}

function writeStore(store: FeedbackStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Stockage indisponible : l'avis reste affiché pour la session en cours.
  }
}

export function getSeriesFeedback(attemptId: string): SeriesFeedback | undefined {
  return readStore()[attemptId]
}

export function saveSeriesFeedback(input: {
  attemptId: string
  userId: string
  rating: number
  comment: string
}): SeriesFeedback {
  const rating = Math.min(5, Math.max(1, Math.round(input.rating)))
  const comment = input.comment.trim().slice(0, MAX_COMMENT_LENGTH)
  const feedback: SeriesFeedback = {
    attemptId: input.attemptId,
    userId: input.userId,
    rating,
    comment,
    createdAt: new Date().toISOString(),
  }
  const store = readStore()
  store[input.attemptId] = feedback
  writeStore(store)
  return feedback
}

/** Supprime l'avis local après une synchronisation réussie vers le serveur. */
export function removeSeriesFeedback(attemptId: string) {
  const store = readStore()
  if (!(attemptId in store)) return
  delete store[attemptId]
  writeStore(store)
}

/** Tous les avis stockés localement (mode démo / repli si migration absente). */
export function listLocalSeriesFeedbacks(): SeriesFeedback[] {
  return Object.values(readStore()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export { MAX_COMMENT_LENGTH }
