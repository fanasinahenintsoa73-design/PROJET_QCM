import type { AccessRequest, Database, User } from '@/types'
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

export function getStudentAccess(user: User, db: Database): StudentAccess {
  if (getPendingRequest(user.id, db)) return 'pending'
  if (user.status === 'pending') return 'pending'
  if (user.status === 'rejected') return 'rejected'
  if (isExpired(user.expiresAt)) return 'expired'
  return 'active'
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
