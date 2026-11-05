import type { Attempt } from '@/types'

/** Nombre de séries visé chaque jour pour installer un rythme régulier. */
export const DAILY_SERIES_GOAL = 2

/** Vrai si les deux dates tombent le même jour, dans le fuseau de l'appareil. */
export function isSameDay(value: string | Date, reference: Date = new Date()): boolean {
  const date = new Date(value)
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  )
}

/** Séries lancées aujourd'hui : une série lancée compte, même si elle est quittée. */
export function attemptsOnDay(attempts: Attempt[], reference: Date = new Date()): Attempt[] {
  return attempts.filter((attempt) => isSameDay(attempt.createdAt, reference))
}

/** Une tentative est considérée terminée si elle n'a pas de statut (anciens essais). */
export function isCompletedAttempt(attempt: Attempt): boolean {
  return !attempt.status || attempt.status === 'completed'
}

export function dailyGoalMessage(count: number): string {
  if (count >= DAILY_SERIES_GOAL) {
    return 'Objectif atteint. Vous pouvez continuer sur votre lancée.'
  }
  if (count === 1) {
    return 'Encore une série pour tenir votre objectif du jour.'
  }
  return 'Deux séries aujourd’hui : un petit rythme qui fait la différence.'
}

/** Phrase courte affichée après le résultat, selon le score. */
export function resultEncouragement(percent: number): string {
  if (percent >= 70) return 'Une de plus vers la réussite.'
  return 'Vous progressez, série après série.'
}
