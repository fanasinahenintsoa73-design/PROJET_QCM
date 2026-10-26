export type Role = 'student' | 'professor'
export type UserStatus = 'pending' | 'active' | 'rejected'
export type RequestStatus = 'pending' | 'approved' | 'rejected'
export type RequestType = 'initial' | 'renewal'

export interface User {
  id: string
  role: Role
  firstName: string
  lastName: string
  email: string
  password: string
  status: UserStatus
  createdAt: string
  activatedAt?: string
  expiresAt?: string
  rejectionReason?: string
}

export interface Receipt {
  dataUrl: string
  name: string
  mime: string
  size: number
}

export interface AccessRequest {
  id: string
  userId: string
  userName: string
  userEmail: string
  type: RequestType
  receipt: Receipt
  status: RequestStatus
  createdAt: string
  reviewedAt?: string
  note?: string
}

export interface Subject {
  id: string
  title: string
  description: string
  monthLabel: string
  publishedAt: string
  archived: boolean
  questionCount: number
}

export interface SubjectAssignment {
  id: string
  userId: string
  subjectId: string
  requestId?: string
  startedAt: string
  expiresAt: string
}

export interface QuestionOptions {
  A: string
  B: string
  C: string
  D: string
}

export interface Question {
  id: string
  subjectId: string
  number: number
  matiere: string
  statement: string
  options: QuestionOptions
  correctAnswers: string[]
  explanation: string
}

export interface Attempt {
  id: string
  userId: string
  subjectId: string
  questionIds: string[]
  answers: Record<string, string[]>
  score: number
  total: number
  createdAt: string
}

export interface Database {
  version: number
  users: User[]
  requests: AccessRequest[]
  subjects: Subject[]
  assignments: SubjectAssignment[]
  questions: Question[]
  attempts: Attempt[]
}
