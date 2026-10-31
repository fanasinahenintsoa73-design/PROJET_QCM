import type { Receipt, Subject, User } from '@/types'
import { isSupabaseConfigured } from '@/lib/supabase'
import { sendNotification, type NotificationPayload } from '@/lib/notify'
import * as demo from '@/lib/db'
import * as remote from '@/lib/supabaseData'
import { AppError, SERIES_SIZE } from '@/lib/utils'
import type {
  SaveChapterSubjectInput,
  SaveSubjectInput,
  ThemePackInput,
} from '@/lib/themes'
import type {
  AttemptReview,
  ChapterQuizPayload,
  PublishSubjectInput,
  QuizPayload,
  SubmitAttemptResult,
} from '@/lib/supabaseData'

export interface AuthResult {
  user: User
}

async function notify(payload: NotificationPayload): Promise<void> {
  try {
    await sendNotification(payload)
  } catch (error) {
    // L'action métier est déjà enregistrée : une panne email ne doit pas la annuler.
    console.warn('[email]', error instanceof Error ? error.message : error)
  }
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
    if (isSupabaseConfigured) {
      const user = await remote.registerStudent(input)
      await notify({ type: 'new_request' })
      return user
    }
    return demo.registerStudent(input)
  },

  async submitRenewal(userId: string, receipt: Receipt): Promise<void> {
    if (isSupabaseConfigured) {
      await remote.submitRenewal(receipt)
      await notify({ type: 'new_request' })
      return
    }
    demo.submitRenewal(userId, receipt)
  },

  async renewNow(userId: string, fullName: string, email: string): Promise<void> {
    if (isSupabaseConfigured) {
      await remote.renewNow(fullName, email)
      return
    }
    demo.renewNow(userId, fullName, email)
  },

  async deleteRenewal(requestId: string): Promise<void> {
    if (isSupabaseConfigured) {
      await remote.deleteRenewal(requestId)
      return
    }
    demo.deleteRenewal(requestId)
  },

  async approveRequest(requestId: string): Promise<void> {
    if (isSupabaseConfigured) {
      await remote.approveRequest(requestId)
      await notify({ type: 'access_activated', requestId })
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
      await notify({ type: 'access_activated', userId })
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

  async publishThemePack(input: ThemePackInput): Promise<void> {
    if (isSupabaseConfigured) {
      await remote.publishThemePack(input)
      return
    }
    demo.publishThemePack(input)
  },

  async publishSubject(input: PublishSubjectInput): Promise<Subject> {
    if (isSupabaseConfigured) return remote.publishSubject(input)
    return demo.publishSubject(input)
  },

  async saveSubject(input: SaveSubjectInput): Promise<Subject> {
    if (isSupabaseConfigured) return remote.saveSubject(input)
    return demo.saveSubject(input)
  },

  async saveChapterSubject(input: SaveChapterSubjectInput): Promise<Subject> {
    if (isSupabaseConfigured) return remote.saveChapterSubject(input)
    return demo.saveChapterSubject(input)
  },

  async removeSubject(subjectId: string): Promise<void> {
    if (isSupabaseConfigured) {
      await remote.removeSubject(subjectId)
      return
    }
    demo.removeSubject(subjectId)
  },

  async startQuiz(
    userId: string,
    subjectId: string,
    count = SERIES_SIZE,
  ): Promise<QuizPayload> {
    if (isSupabaseConfigured) return remote.startQuiz(subjectId, count)

    const started = demo.startSeries(userId, subjectId, count)
    return {
      assignmentId: started.assignment.id,
      assignmentExpiresAt: started.assignment.expiresAt,
      subject: started.subject,
      // Le corrigé reste en base : il n'est jamais envoyé au navigateur
      // avant la soumission, même en mode démonstration.
      questions: started.questions,
    }
  },

  async startChapterQuiz(
    userId: string,
    ueId: string,
    chapterIds: string[],
    count = SERIES_SIZE,
  ): Promise<ChapterQuizPayload> {
    if (isSupabaseConfigured) return remote.startChapterQuiz(ueId, chapterIds, count)

    const started = demo.startChapterSeries(userId, ueId, chapterIds, count)
    return {
      attemptId: started.attempt.id,
      assignmentId: started.assignment.id,
      assignmentExpiresAt: started.assignment.expiresAt,
      ueId: started.ueId,
      chapterIds: started.chapterIds,
      questions: started.questions,
    }
  },

  async saveChapterAttempt(input: {
    userId: string
    attemptId: string
    answers: Record<string, string[]>
  }): Promise<SubmitAttemptResult> {
    if (isSupabaseConfigured) {
      return remote.saveChapterAttempt({ attemptId: input.attemptId, answers: input.answers })
    }
    const attempt = demo.saveChapterAttempt(input)
    const active = demo.getActiveAssignment(input.userId)
    return {
      attemptId: attempt.id,
      score: attempt.score,
      total: attempt.total,
      subjectId: attempt.subjectId,
      assignmentExpiresAt: active?.expiresAt ?? '',
      ueId: attempt.ueId,
      chapterIds: attempt.chapterIds,
    }
  },

  async abandonSeries(userId: string, attemptId: string): Promise<void> {
    if (isSupabaseConfigured) {
      await remote.abandonSeries(attemptId)
      return
    }
    demo.abandonSeries(attemptId, userId)
  },

  async saveAttempt(input: {
    userId: string
    subjectId: string
    questionIds: string[]
    answers: Record<string, string[]>
  }): Promise<SubmitAttemptResult> {
    if (isSupabaseConfigured) {
      return remote.saveAttempt({
        subjectId: input.subjectId,
        questionIds: input.questionIds,
        answers: input.answers,
      })
    }

    const attempt = demo.saveAttempt({
      userId: input.userId,
      subjectId: input.subjectId,
      questionIds: input.questionIds,
      answers: input.answers,
    })
    const active = demo.getActiveAssignment(input.userId)
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

    const viewerId = demo.getSessionUserId()
    if (!viewerId) {
      throw new AppError('FORBIDDEN', 'Votre session a expiré. Reconnectez-vous.')
    }
    return demo.getAttemptForReview(attemptId, viewerId)
  },

  async resolveReceiptUrl(path?: string): Promise<string> {
    if (!path) return ''
    if (isSupabaseConfigured) return remote.resolveReceiptUrl(path)
    return ''
  },
}
