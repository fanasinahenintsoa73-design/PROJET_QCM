import type { AccessRequest, Database, User } from '@/types'
import { isExpired } from '@/lib/utils'

export type StudentAccess = 'pending' | 'choosing' | 'rejected' | 'expired' | 'active'

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
 * Renouvellement validé par le docteur, en attente du choix obligatoire de
 * l'étudiant. Le cycle de 30 jours ne démarre qu'à ce choix.
 */
export function getPendingSubjectChoice(
  userId: string,
  db: Database,
): AccessRequest | undefined {
  // Un cycle déjà ouvert (choix effectué ou attribution manuelle) prime.
  if (db.assignments.some((assignment) => assignment.userId === userId && !isExpired(assignment.expiresAt))) {
    return undefined
  }
  const assignedRequests = new Set(
    db.assignments.map((assignment) => assignment.requestId).filter(Boolean),
  )
  return db.requests
    .filter(
      (request) =>
        request.userId === userId &&
        request.type === 'renewal' &&
        request.status === 'approved' &&
        Boolean(request.currentSubjectId) &&
        !request.chosenSubjectId &&
        !assignedRequests.has(request.id),
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
}

export function getStudentAccess(user: User, db: Database): StudentAccess {
  if (user.status === 'rejected') return 'rejected'
  if (getPendingSubjectChoice(user.id, db)) return 'choosing'
  if (getPendingRequest(user.id, db)) return 'pending'
  if (user.status === 'pending') return 'pending'
  if (isExpired(user.expiresAt)) return 'expired'
  return 'active'
}

export function studentHomePath(user: User, db: Database): string {
  switch (getStudentAccess(user, db)) {
    case 'choosing':
      return '/choix-sujet'
    case 'pending':
      return '/en-attente'
    case 'rejected':
    case 'expired':
      return '/expiration'
    default:
      return '/app'
  }
}
