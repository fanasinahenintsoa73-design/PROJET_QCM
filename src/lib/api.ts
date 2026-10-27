import type { Receipt, Subject, User } from '@/types'
import { isSupabaseConfigured } from '@/lib/supabase'
import * as demo from '@/lib/db'
import * as remote from '@/lib/supabaseData'
import { randomQuestionIds } from '@/lib/seed'
import { sameAnswer } from '@/lib/utils'
import type {
  AttemptReview,
  PublishSubjectInput,
  QuizPayload,
  SubmitAttemptResult,
} from '@/lib/supabaseData'

export interface AuthResult {
  user: User
}

/**
 * Façade unique utilisée par les pages. En mode démonstration elle délègue au
 * stockage local ; en production elle appelle Supabase (Auth, RPC, Storage).
 */
export const api = {
  async login(email: string, password: string): Promise<AuthResult> {
    if (isSupabaseConfigured) {
      return { user: await remote.signIn(email, password) }
    }
    const result = demo.login(email, password)
    if (!result.ok) throw new Error(result.error)
    return { user: result.user }
  },

  async logout(): Promise<void> {
    if (isSupabaseConfigured) {
      await remote.signOut()
      return
    }
    demo.logout()
  },

  async registerStudent(input: {
    firstName: string
    lastName: string
    email: string
    password: string
    receipt: Receipt
  }): Promise<User> {
    if (isSupabaseConfigured) return remote.registerStudent(input)
    return demo.registerStudent(input)
  },

  async submitRenewal(userId: string, receipt: Receipt): Promise<void> {
    if (isSupabaseConfigured) {
      await remote.submitRenewal(receipt)
      return
    }
    demo.submitRenewal(userId, receipt)
  },

  async approveRequest(requestId: string): Promise<void> {
    if (isSupabaseConfigured) {
      await remote.approveRequest(requestId)
      return
    }
    demo.approveRequest(requestId)
  },

  async rejectRequest(requestId: string, note?: string): Promise<void> {
    if (isSupabaseConfigured) {
      await remote.rejectRequest(requestId, note)
      return
    }
    demo.rejectRequest(requestId, note)
  },

  async assignSubjectToStudent(subjectId: string, userId: string): Promise<void> {
    if (isSupabaseConfigured) {
      await remote.assignSubjectToStudent(subjectId, userId)
      return
    }
    demo.assignSubjectToStudent(subjectId, userId)
  },

  async revokeAccess(userId: string, note?: string): Promise<void> {
    if (isSupabaseConfigured) {
      await remote.revokeAccess(userId, note)
      return
    }
    demo.revokeAccess(userId, note)
  },

  async extendAccess(userId: string, days = 30): Promise<void> {
    if (isSupabaseConfigured) {
      await remote.extendAccess(userId, days)
      return
    }
    demo.extendAccess(userId, days)
  },

  async publishSubject(input: PublishSubjectInput): Promise<Subject> {
    if (isSupabaseConfigured) return remote.publishSubject(input)
    return demo.publishSubject(input)
  },

  async removeSubject(subjectId: string): Promise<void> {
    if (isSupabaseConfigured) {
      await remote.removeSubject(subjectId)
      return
    }
    demo.removeSubject(subjectId)
  },

  async startQuiz(userId: string, count = 20): Promise<QuizPayload> {
    if (isSupabaseConfigured) return remote.startQuiz(userId, count)

    const db = demo.getDB()
    const assignment = demo.getActiveAssignment(userId, db)
    if (!assignment) throw new Error('Votre accès n’est plus actif.')
    const subject = db.subjects.find((candidate) => candidate.id === assignment.subjectId)
    if (!subject) throw new Error('Aucun sujet actif ne vous est attribué.')
    const bank = demo.getSubjectQuestions(subject.id, db)
    if (bank.length === 0) throw new Error('Le sujet ne contient aucune question.')
    const ids = randomQuestionIds(bank, count)
    const questions = ids
      .map((id) => bank.find((question) => question.id === id))
      .filter((question): question is NonNullable<typeof question> => Boolean(question))

    return {
      assignmentId: assignment.id,
      assignmentExpiresAt: assignment.expiresAt,
      subject,
      questions,
    }
  },

  async saveAttempt(input: {
    userId: string
    questionIds: string[]
    answers: Record<string, string[]>
  }): Promise<SubmitAttemptResult> {
    if (isSupabaseConfigured) {
      return remote.saveAttempt({
        questionIds: input.questionIds,
        answers: input.answers,
      })
    }

    const db = demo.getDB()
    const bank = db.questions
    const score = input.questionIds.reduce((total, id) => {
      const question = bank.find((candidate) => candidate.id === id)
      return total + (question && sameAnswer(input.answers[id] ?? [], question.correctAnswers) ? 1 : 0)
    }, 0)
    const active = demo.getActiveAssignment(input.userId, db)
    const attempt = demo.saveAttempt({
      userId: input.userId,
      subjectId: active?.subjectId ?? '',
      questionIds: input.questionIds,
      answers: input.answers,
      score,
    })
    return {
      attemptId: attempt.id,
      score: attempt.score,
      total: attempt.total,
      subjectId: attempt.subjectId,
      assignmentExpiresAt: active?.expiresAt ?? '',
    }
  },

  async getAttemptReview(attemptId: string): Promise<AttemptReview> {
    if (isSupabaseConfigured) return remote.getAttemptReview(attemptId)

    const db = demo.getDB()
    const attempt = demo.getAttempt(attemptId, db)
    if (!attempt) throw new Error('Ce résultat est introuvable.')
    const questions = attempt.questionIds
      .map((id) => db.questions.find((question) => question.id === id))
      .filter((question): question is NonNullable<typeof question> => Boolean(question))
    return { attempt, questions }
  },

  async resolveReceiptUrl(path?: string): Promise<string> {
    if (!path) return ''
    if (isSupabaseConfigured) return remote.resolveReceiptUrl(path)
    return ''
  },
}
