import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, RotateCcw, Sparkles, Star, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import type { AttemptReview } from '@/lib/supabaseData'
import { Button, ButtonLink } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import { resultEncouragement } from '@/lib/engagement'
import { MAX_COMMENT_LENGTH } from '@/lib/feedback'
import { answerLetters, cn, formatDateTime, scoreTone } from '@/lib/utils'
import { chapterTitle, findPaceTheme, findThemeForChapter } from '@/lib/themes'

const RATING_LABELS = ['À revoir', 'Moyen', 'Bien', 'Très bien', 'Excellent']

export default function ResultPage() {
  usePageTitle('Résultat de la série — MEDQCM mada')
  const { attemptId } = useParams<{ attemptId: string }>()
  const { user, db } = useAuth()

  const [review, setReview] = useState<AttemptReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackSkipped, setFeedbackSkipped] = useState(false)
  const [feedbackSaving, setFeedbackSaving] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')

  useEffect(() => {
    if (!attemptId) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setLoadError('')
    api
      .getAttemptReview(attemptId)
      .then((result) => {
        if (active) setReview(result)
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Ce résultat est introuvable.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [attemptId])

  useEffect(() => {
    if (!attemptId) return
    let active = true
    api
      .getSeriesFeedback(attemptId)
      .then((existing) => {
        if (!active) return
        if (!existing) {
          setRating(0)
          setComment('')
          setFeedbackSent(false)
          setFeedbackSkipped(false)
          return
        }
        setRating(existing.rating)
        setComment(existing.comment)
        setFeedbackSent(true)
      })
      .catch(() => {
        if (active) {
          setRating(0)
          setComment('')
          setFeedbackSent(false)
        }
      })
    return () => {
      active = false
    }
  }, [attemptId])

  const attempt = review?.attempt
  const ownsAttempt = attempt && userIdMatches(attempt.userId, user?.id)
  const subject = attempt ? db.subjects.find((item) => item.id === attempt.subjectId) : undefined
  const ue = attempt?.ueId
    ? findPaceTheme(attempt.ueId)
    : subject?.chapterId
      ? findThemeForChapter(subject.chapterId)
      : undefined
  const chapters =
    attempt?.chapterIds?.length
      ? attempt.chapterIds.map((id) => chapterTitle(id)).filter(Boolean)
      : subject?.chapterId
        ? [chapterTitle(subject.chapterId)].filter(Boolean)
        : []
  const originLabel = ue?.title ?? subject?.title ?? 'UE de QCM'
  const chapterLabel = chapters.length ? chapters.join(' · ') : 'Chapitre non précisé'
  const questions = review?.questions ?? []

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-content flex-col justify-center px-5 py-16 sm:px-8 lg:px-10">
        <p className="text-[12px] text-mute">Correction en cours</p>
        <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] text-ink">
          Votre résultat se prépare.
        </h1>
        <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-mute">
          Les réponses et les explications sont vérifiées côté serveur.
        </p>
      </div>
    )
  }

  if (!attempt || !ownsAttempt) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-content flex-col justify-center px-5 py-16 sm:px-8 lg:px-10">
        <h1 className="font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] text-ink">
          Ce résultat n’est pas disponible.
        </h1>
        <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-mute">
          {loadError || 'La série demandée n’existe pas ou n’appartient pas à votre compte.'}
        </p>
        <ButtonLink to="/app" className="mt-6">
          Retour à mon cycle
        </ButtonLink>
      </div>
    )
  }

  const total = attempt.total
  const score = attempt.score
  const unanswered = attempt.questionIds.filter((id) => !(attempt.answers[id] ?? []).length).length
  const incorrect = Math.max(0, total - score - unanswered)
  const percent = total ? Math.round((score / total) * 100) : 0
  const verdict = capitalize(scoreTone(score, total))
  const message =
    percent >= 80
      ? 'Maîtrise solide. Continuez à consolider les détails.'
      : percent >= 60
        ? 'De bonnes bases. Le corrigé va préciser les points fragiles.'
        : percent >= 40
          ? 'Les notions clés sont là, mais elles doivent être stabilisées.'
          : 'Ce score est un point de départ. Reprenez les explications une par une.'

  const redoHref = ue
    ? `/app/ue/${encodeURIComponent(ue.id)}`
    : `/app/entrainement?theme=${encodeURIComponent(attempt.subjectId)}`
  const shownRating = hoverRating || rating

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!attemptId || rating < 1 || feedbackSaving) return
    setFeedbackSaving(true)
    setFeedbackError('')
    try {
      await api.saveSeriesFeedback({
        attemptId,
        userId: user?.id ?? attempt?.userId ?? 'unknown',
        rating,
        comment,
      })
      setFeedbackSent(true)
    } catch (error) {
      setFeedbackError(
        error instanceof Error ? error.message : 'Votre avis n’a pas pu être envoyé.',
      )
    } finally {
      setFeedbackSaving(false)
    }
  }

  return (
    <div className="bg-canvas">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 px-5 py-3 text-[12px] sm:px-8 lg:px-10">
          <Link to="/app" className="inline-flex items-center gap-2 text-mute transition hover:text-accent">
            <ArrowLeft size={14} /> Mon cycle
          </Link>
          <span className="text-mute">Résultat de la série</span>
          <Link to="/app#series" className="text-mute transition hover:text-accent">
            Mes séries
          </Link>
        </div>
      </div>

      <section className="mx-auto max-w-content px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_260px] lg:items-end lg:p-10">
            <div>
              <p className="text-[12px] text-mute">
                {originLabel} · {formatDateTime(attempt.createdAt)}
              </p>
              <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-[11px] font-medium text-accent">
                <Sparkles size={12} /> {resultEncouragement(percent)}
              </span>
              <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.8rem)] leading-[1.02] tracking-[-0.03em] text-ink">
                {verdict}.
              </h1>
              <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-mute">{message}</p>
            </div>
            <div className="lg:text-right">
              <p className="text-[11px] text-mute">Score final</p>
              <p className="mt-1 flex items-baseline gap-1 lg:justify-end" aria-label={`${score} sur ${total}`}>
                <span className="font-display text-[clamp(4rem,9vw,5.6rem)] leading-none text-accent">
                  {score}
                </span>
                <span className="text-[18px] text-mute">/{total}</span>
              </p>
              <p className="mt-2 text-[11px] text-mute">{percent} % de réussite</p>
            </div>
          </div>

          <div className="grid grid-cols-3 border-t border-line">
            {[
              ['Correctes', score, 'text-success'],
              ['Incorrectes', incorrect, 'text-sale'],
              ['Sans réponse', unanswered, 'text-mute'],
            ].map(([label, value, tone], index) => (
              <div key={label} className={`px-5 py-4 sm:px-8 ${index > 0 ? 'border-l border-line' : ''}`}>
                <p className="text-[10px] text-mute">{label}</p>
                <p className={`mt-1 text-[18px] font-medium tabular-nums ${tone}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

      </section>

      <section
        id="corrige"
        className="mx-auto max-w-content scroll-mt-24 px-5 pb-10 sm:px-8 lg:px-10"
      >
        <div className="border-b border-line pb-4">
          <h2 className="text-[18px] font-medium text-ink">Corrigé détaillé</h2>
          <p className="mt-1 text-[12px] text-mute">
            {originLabel} · {chapterLabel} · {total} questions · chaque question compte un point.
          </p>
        </div>

        {questions.map((question, questionIndex) => {
          const given = attempt.answers[question.id] ?? []
          const isCorrect = sameLetters(given, question.correctAnswers)
          const isBlank = given.length === 0
          return (
            <article key={question.id} className="border-b border-line py-7 sm:py-9">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[11px] font-medium text-mute">
                  Question {String(questionIndex + 1).padStart(2, '0')}
                </span>
                <span className="text-[11px] text-stone">·</span>
                <span className="text-[11px] text-mute">{question.matiere}</span>
                <span
                  className={cn(
                    'ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium',
                    isBlank
                      ? 'bg-cloud text-mute'
                      : isCorrect
                        ? 'bg-accent-soft text-accent'
                        : 'bg-danger-soft text-sale',
                  )}
                >
                  {isBlank ? (
                    'Sans réponse'
                  ) : isCorrect ? (
                    <>
                      <Check size={11} strokeWidth={2.5} /> Juste
                    </>
                  ) : (
                    <>
                      <X size={11} strokeWidth={2.5} /> À revoir
                    </>
                  )}
                </span>
              </div>

              <h3 className="mt-3 max-w-3xl text-[16px] font-medium leading-relaxed text-ink">
                {question.statement}
              </h3>

              <div className="mt-4 max-w-3xl overflow-hidden rounded-lg border border-line">
                {answerLetters.filter((letter) => question.options[letter]?.trim()).map((letter) => {
                  const isExpected = question.correctAnswers.includes(letter)
                  const isGiven = given.includes(letter)
                  return (
                    <div
                      key={letter}
                      className={cn(
                        'flex items-start gap-3 border-b border-line px-3.5 py-3 last:border-b-0',
                        isExpected && 'bg-accent-soft/60',
                        !isExpected && isGiven && 'bg-danger-soft/60',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded border text-[11px] font-medium',
                          isExpected
                            ? 'border-accent bg-accent text-white'
                            : isGiven
                              ? 'border-sale bg-sale text-white'
                              : 'border-line text-mute',
                        )}
                      >
                        {letter}
                      </span>
                      <span className="flex-1 text-[13px] leading-relaxed text-ash">
                        {question.options[letter]}
                      </span>
                      {isExpected && (
                        <span className="mt-0.5 shrink-0 text-[10px] font-medium text-accent">
                          Attendue
                        </span>
                      )}
                      {!isExpected && isGiven && (
                        <span className="mt-0.5 shrink-0 text-[10px] font-medium text-sale">
                          Votre réponse
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 max-w-3xl rounded-lg bg-cloud px-4 py-4">
                <p className="text-[11px] font-medium text-ink">Explication</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ash">{question.explanation}</p>
              </div>
            </article>
          )
        })}
      </section>

      <section className="mx-auto max-w-content px-5 pb-10 sm:px-8 lg:px-10">
        {feedbackSent ? (
          <div className="rounded-2xl border border-accent/25 bg-accent-soft/60 p-6 sm:p-8">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent">
              Avis enregistré
            </p>
            <h2 className="mt-2 font-display text-[1.8rem] leading-tight text-ink">
              Merci, votre avis compte.
            </h2>
            <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-mute">
              Votre note aide à améliorer les prochaines séries. Vous pouvez relancer une série
              quand vous le souhaitez.
            </p>
            <div
              className="mt-4 flex items-center gap-1.5 text-accent"
              aria-label={`${rating} étoiles sur 5`}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={18}
                  strokeWidth={1.8}
                  fill={star <= rating ? 'currentColor' : 'none'}
                  className={star <= rating ? '' : 'text-stone'}
                />
              ))}
              <span className="ml-2 text-[12px] font-medium text-ink">
                {RATING_LABELS[Math.max(0, rating - 1)]}
              </span>
            </div>
            {comment ? (
              <p className="mt-3 max-w-2xl rounded-lg bg-white/70 px-4 py-3 text-[13px] leading-relaxed text-ash">
                « {comment} »
              </p>
            ) : null}
          </div>
        ) : feedbackSkipped ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-5">
            <p className="text-[13px] text-mute">Avis passé pour cette série.</p>
            <button
              type="button"
              onClick={() => setFeedbackSkipped(false)}
              className="text-[12px] font-medium text-accent hover:text-accent-deep"
            >
              Donner mon avis
            </button>
          </div>
        ) : (
          <form
            onSubmit={submitFeedback}
            className="rounded-2xl border border-line bg-surface p-6 sm:p-8"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-mute">
              Votre avis
            </p>
            <h2 className="mt-2 font-display text-[1.8rem] leading-tight text-ink">
              Cette série vous a-t-elle aidé ?
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-mute">
              Une note rapide, un mot si vous voulez. Le commentaire est facultatif.
            </p>
            <div
              className="mt-5 flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Note de la série sur 5 étoiles"
            >
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= shownRating
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
                      aria-pressed={rating === star}
                      className="rounded-md p-1.5 transition hover:text-accent focus-visible:text-accent"
                    >
                      <Star
                        size={25}
                        strokeWidth={1.6}
                        fill={active ? 'currentColor' : 'none'}
                        className={active ? 'text-accent' : 'text-stone'}
                      />
                    </button>
                  )
                })}
              </div>
              <span className="text-[12px] font-medium text-mute">
                {shownRating ? RATING_LABELS[shownRating - 1] : 'Touchez une étoile'}
              </span>
            </div>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value.slice(0, MAX_COMMENT_LENGTH))}
              maxLength={MAX_COMMENT_LENGTH}
              rows={3}
              aria-label="Votre commentaire, facultatif"
              placeholder="Un mot sur les questions, le corrigé, ce qui vous a aidé… (facultatif)"
              className="form-textarea mt-5"
            />
            {feedbackError ? (
              <p role="alert" className="mt-3 text-[12px] font-medium text-sale">
                {feedbackError}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={rating < 1 || feedbackSaving} loading={feedbackSaving}>
                Envoyer mon avis
              </Button>
              <button
                type="button"
                onClick={() => setFeedbackSkipped(true)}
                disabled={feedbackSaving}
                className="text-[12px] text-mute transition hover:text-accent disabled:opacity-45"
              >
                Passer
              </button>
              <span className="ml-auto text-[10px] tabular-nums text-mute">
                {comment.length} / {MAX_COMMENT_LENGTH}
              </span>
            </div>
          </form>
        )}
      </section>

      <section className="mx-auto max-w-content px-5 pb-16 sm:px-8 lg:px-10">
        <div className="relative overflow-hidden rounded-2xl bg-accent px-6 py-8 text-white sm:px-10 sm:py-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full border border-white/15"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 right-10 h-56 w-56 rounded-full border border-white/10"
          />
          <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/70">La suite</p>
              <h2 className="mt-3 max-w-xl font-display text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.05] tracking-[-0.02em]">
                {feedbackSent ? 'Merci. Gardez le rythme.' : 'Gardez le rythme.'}
              </h2>
              <p className="mt-3 max-w-md text-[13px] leading-relaxed text-white/85">
                {feedbackSent
                  ? 'Votre avis est enregistré. La prochaine série vous attend.'
                  : 'Chaque série terminée vous rapproche de votre objectif. La suivante vous attend.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink
                to={redoHref}
                variant="white"
                size="lg"
                className="w-full justify-center sm:w-auto"
              >
                <RotateCcw size={16} /> Refaire une série
              </ButtonLink>
              <ButtonLink
                to="/app#ues"
                variant="white-outline"
                size="lg"
                className="w-full justify-center sm:w-auto"
              >
                Choisir une autre UE <ArrowRight size={16} />
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function sameLetters(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((letter, index) => letter === right[index])
}

function userIdMatches(a: string, b?: string) {
  return Boolean(b) && a === b
}
