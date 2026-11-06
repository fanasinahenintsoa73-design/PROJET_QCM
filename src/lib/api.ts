import type { GeneratedTicket, Receipt, SeriesFeedback, SeriesFeedbackReview, Subject, TicketItem, TicketStatus, User } from '@/types'
import { isSupabaseConfigured } from '@/lib/supabase'
import { sendNotification, type NotificationPayload } from '@/lib/notify'
import * as demo from '@/lib/db'
import * as remote from '@/lib/supabaseData'
import {
  getSeriesFeedback as getLocalFeedback,
  listLocalSeriesFeedbacks,
  removeSeriesFeedback,
  saveSeriesFeedback as saveLocalFeedback,
} from '@/lib/feedback'
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

  async saveSeriesFeedback(input: {
    attemptId: string
    userId: string
    rating: number
    comment: string
  }): Promise<SeriesFeedback> {
    if (isSupabaseConfigured) {
      try {
        const saved = await remote.saveSeriesFeedback(input)
        // L'avis est bien côté serveur : l'ancienne copie locale est inutile.
        removeSeriesFeedback(input.attemptId)
        return saved
      } catch (error) {
        // L'envoi a échoué (migration absente, RPC refusé, réseau).
        // On garde l'avis sur l'appareil pour ne pas le perdre, mais on
        // signale l'échec au lieu d'afficher un faux « Merci » : sinon
        // l'étudiant croit sa note envoyée alors que l'admin ne voit rien.
        console.warn('[feedback]', error instanceof Error ? error.message : error)
        saveLocalFeedback(input)
        throw new AppError(
          'FEEDBACK_NOT_SYNCED',
          'Votre avis est gardé sur cet appareil, mais il n’a pas encore été envoyé au serveur. Patientez puis touchez « Envoyer mon avis » de nouveau.',
        )
      }
    }
    return saveLocalFeedback(input)
  },

  async getSeriesFeedback(attemptId: string): Promise<SeriesFeedback | null> {
    if (isSupabaseConfigured) {
      const localFeedback = getLocalFeedback(attemptId) ?? null
      try {
        const remoteFeedback = await remote.getMySeriesFeedback(attemptId)
        if (remoteFeedback) {
          removeSeriesFeedback(attemptId)
          return remoteFeedback
        }
        // Avis encore seulement local (enregistré avant la migration ou
        // pendant une panne) : on tente de le synchroniser maintenant.
        if (localFeedback) {
          try {
            const synced = await remote.saveSeriesFeedback(localFeedback)
            removeSeriesFeedback(attemptId)
            return synced
          } catch {
            // Toujours pas synchronisable : on montre l'avis local pour que
            // l'étudiant retrouve ses étoiles, sans prétendre qu'il est envoyé.
            return localFeedback
          }
        }
      } catch {
        // Panne réseau / migration absente : on montre au moins l'avis local.
        return localFeedback
      }
      return null
    }
    return getLocalFeedback(attemptId) ?? null
  },

  /**
   * Envoie vers le backend tous les avis étoiles encore stockés en local sur
   * cet appareil (par exemple enregistrés avant la migration ou pendant une
   * panne). Ne lève jamais : un échec laisse simplement l'avis en attente
   * pour le prochain essai. Tous les téléphones partagent ensuite les mêmes
   * notes côté serveur.
   */
  async syncPendingSeriesFeedbacks(): Promise<{ synced: number; pending: number }> {
    if (!isSupabaseConfigured) return { synced: 0, pending: 0 }
    const pending = listLocalSeriesFeedbacks()
    if (pending.length === 0) return { synced: 0, pending: 0 }
    let synced = 0
    for (const feedback of pending) {
      try {
        await remote.saveSeriesFeedback(feedback)
        removeSeriesFeedback(feedback.attemptId)
        synced += 1
      } catch (error) {
        console.warn('[feedback-sync]', error instanceof Error ? error.message : error)
      }
    }
    return { synced, pending: pending.length - synced }
  },

  async listSeriesFeedbacks(): Promise<SeriesFeedbackReview[]> {
    if (isSupabaseConfigured) {
      // En production, une erreur doit être visible côté docteur (alerte avec
      // l'explication « migration ») au lieu de masquer le problème par une
      // page « 0 avis » trompeuse.
      return remote.listSeriesFeedbacks()
    }
    // Mode démonstration : on recompose depuis les avis locaux + la base locale.
    const db = demo.getDB()
    const usersById = new Map(db.users.map((account) => [account.id, account]))
    const attemptsById = new Map(db.attempts.map((attempt) => [attempt.id, attempt]))
    return listLocalSeriesFeedbacks()
      .map((feedback) => {
        const attempt = attemptsById.get(feedback.attemptId)
        const student = usersById.get(feedback.userId)
        return {
          ...feedback,
          userName: student ? `${student.firstName} ${student.lastName}` : 'Étudiant',
          userEmail: student?.email ?? '',
          ueId: attempt?.ueId,
          chapterIds: attempt?.chapterIds,
          score: attempt?.score ?? 0,
          total: attempt?.total ?? 0,
          attemptCreatedAt: attempt?.createdAt ?? feedback.createdAt,
        } satisfies SeriesFeedbackReview
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  async resolveReceiptUrl(path?: string): Promise<string> {
    if (!path) return ''
    if (isSupabaseConfigured) return remote.resolveReceiptUrl(path)
    return ''
  },

  /* ---------------------------------------------------------------- */
  /* Tickets d'accès (1 ticket = 30 séries)                            */
  /* ---------------------------------------------------------------- */

  /** Génère un lot de tickets (docteur uniquement). */
  async generateTickets(count: number): Promise<GeneratedTicket[]> {
    if (isSupabaseConfigured) return remote.generateTickets(count)
    return demo.generateTickets(count)
  },

  /** Tous les tickets (docteur uniquement). */
  async listTickets(): Promise<TicketItem[]> {
    if (isSupabaseConfigured) return remote.listTickets()
    return demo.listTickets()
  },

  /** Suspend un ticket, ou le réactive (statut 'active'). */
  async setTicketStatus(code: string, status: 'suspended' | 'active'): Promise<void> {
    if (isSupabaseConfigured) return remote.setTicketStatus(code, status)
    return demo.setTicketStatus(code, status)
  },

  /** Horodatage des connexions d'un ticket. */
  async ticketHistory(code: string): Promise<string[]> {
    if (isSupabaseConfigured) return remote.ticketHistory(code)
    return demo.ticketHistory(code)
  },

  /** Enregistre une connexion réussie par ticket. Ne lève jamais. */
  async recordTicketLogin(): Promise<void> {
    try {
      if (isSupabaseConfigured) return remote.recordTicketLogin()
      return demo.recordTicketLogin()
    } catch (error) {
      console.warn('[ticket]', error instanceof Error ? error.message : error)
    }
  },

  /** Statut du ticket de l'utilisateur connecté, null si pas un ticket. */
  async myTicketStatus(): Promise<TicketStatus | null> {
    if (isSupabaseConfigured) return remote.myTicketStatus()
    return Promise.resolve(demo.myTicketStatus())
  },
}
