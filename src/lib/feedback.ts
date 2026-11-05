export interface SeriesFeedback {
  attemptId: string
  userId: string
  rating: number
  comment: string
  createdAt: string
}

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

export { MAX_COMMENT_LENGTH }
