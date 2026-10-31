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
  /** Chemin dans le bucket Supabase (absent en mode démonstration). */
  path?: string
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
  /** Ancien sujet suivi avant le renouvellement (legacy, non utilisé). */
  currentSubjectId?: string
  /** Ancien sujet suivant proposé au choix (legacy, non utilisé). */
  nextSubjectId?: string
  /** Ancien sujet retenu par l'étudiant (legacy, non utilisé). */
  chosenSubjectId?: string
  chosenAt?: string
}

export interface Subject {
  id: string
  title: string
  description: string
  monthLabel: string
  publishedAt: string
  archived: boolean
  questionCount: number
  /** Chapitre auquel le sujet est rattaché (absent pour les anciens sujets). */
  chapterId?: string
  /** Nom du dernier fichier de questions enregistré (vide pour les anciens sujets). */
  questionFileName?: string
  /** Nom du dernier fichier de correction enregistré (vide pour les anciens sujets). */
  answerFileName?: string
}

export type AttemptStatus = 'in_progress' | 'completed' | 'abandoned'

export interface SubjectAssignment {
  id: string
  userId: string
  /** Le cycle est indépendant d'un thème : null pour les nouveaux abonnements. */
  subjectId: string | null
  requestId?: string
  startedAt: string
  expiresAt: string
}

export interface QuestionOptions {
  A: string
  B: string
  C: string
  D: string
  E?: string
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
  /** UE et chapitres de la série (absents pour les anciennes tentatives). */
  ueId?: string
  chapterIds?: string[]
  status?: AttemptStatus
  completedAt?: string
  /**
   * Copie figée des questions et du corrigé au moment du passage.
   * Elle garantit que les anciens résultats ne changent pas si le sujet est
   * corrigé ou modifié plus tard.
   */
  questionSnapshot?: Question[]
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
