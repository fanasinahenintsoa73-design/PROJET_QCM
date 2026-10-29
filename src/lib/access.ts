import type { AccessRequest, Database, User } from '@/types'
import { getSeriesUsage } from '@/lib/db'
import { isExpired } from '@/lib/utils'

export type StudentAccess = 'pending' | 'rejected' | 'expired' | 'active'

export function getPendingRequest(userId: string, db: Database): AccessRequest | undefined {
  return db.requests
    .filter((request) => request.userId === userId && request.status === 'pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
}

export function getLatestRequest(userId: string, db: Database): AccessRequest | undefined {
  return db.requests
    .filter((request) => request.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
}

/**
 * Compatibilité avec l'ancienne fiche docteur : le parcours par thèmes ne
 * demande plus de choix de sujet après validation d'un renouvellement.
 */
export function getPendingSubjectChoice(
  _userId: string,
  _db: Database,
): AccessRequest | undefined {
  return undefined
}

export function getStudentAccess(user: User, db: Database): StudentAccess {
  if (user.status === 'rejected') return 'rejected'
  if (getPendingRequest(user.id, db)) return 'pending'
  if (user.status === 'pending') return 'pending'
  const current = getSeriesUsage(user.id, db).assignment
  if (!current && isExpired(user.expiresAt)) return 'expired'
  return 'active'
}

/** Un étudiant actif ne peut renouveler qu'une fois ses 30 séries terminées. */
export function canRequestRenewal(user: User, db: Database): boolean {
  const access = getStudentAccess(user, db)
  if (access === 'expired' || access === 'rejected') return true
  if (access !== 'active') return false
  return getSeriesUsage(user.id, db).reached
}

export function studentHomePath(user: User, db: Database): string {
  switch (getStudentAccess(user, db)) {
    case 'pending':
      return '/en-attente'
    case 'rejected':
    case 'expired':
      return '/expiration'
    default:
      return '/app'
  }
}
