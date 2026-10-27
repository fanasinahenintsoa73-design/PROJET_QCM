import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Clock3, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import type { QuizPayload } from '@/lib/supabaseData'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { usePageTitle } from '@/components/Layouts'
import { answerLetters, cn, isExpired, timeLeft, type AnswerLetter } from '@/lib/utils'

export default function QuizPage() {
  usePageTitle('Série en cours — MEDQCM L1')
  const navigate = useNavigate()
  const { user } = useAuth()

  const [payload, setPayload] = useState<QuizPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const finished = useRef(false)

  const questions = payload?.questions ?? []
  const current = questions[index]
  const selected = current ? answers[current.id] ?? [] : []
  const answeredCount = questions.filter((question) => (answers[question.id] ?? []).length > 0).length
  const isLast = index === questions.length - 1
  const expiresAt = payload?.assignmentExpiresAt

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    setBlocked(false)
    setLoadError('')

    api
      .startQuiz(user.id, 20)
      .then((quiz) => {
        if (!active) return
        setPayload(quiz)
        setIndex(0)
        setAnswers({})
        finished.current = false
      })
      .catch((error: unknown) => {
        if (!active) return
        const message = error instanceof Error ? error.message : 'La série n’a pas pu être chargée.'
        if (/accès|attribué|terminé/i.test(message)) setBlocked(true)
        else setLoadError(message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user?.id])

  useEffect(() => {
    const check = () => {
      if (isExpired(user?.expiresAt)) {
        navigate('/expiration', { replace: true })
        return
      }
      if (payload && isExpired(expiresAt)) setBlocked(true)
    }
    check()
    const interval = window.setInterval(check, 15_000)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [expiresAt, navigate, payload, user?.expiresAt])

  function toggleAnswer(letter: AnswerLetter) {
    if (!current) return
    setAnswers((previous) => {
      const existing = previous[current.id] ?? []
      if (existing.includes(letter)) {
        return { ...previous, [current.id]: [] }
      }
      return { ...previous, [current.id]: [letter] }
    })
  }

  function canContinue() {
    if (isExpired(user?.expiresAt) || !payload || isExpired(expiresAt)) {
      setBlocked(true)
      return false
    }
    return true
  }

  async function goNext() {
    if (!isLast) {
      if (!canContinue()) return
      setIndex((value) => Math.min(value + 1, questions.length - 1))
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!canContinue() || !user || !payload || saving || finished.current) return
    setSaving(true)
    setSubmitError('')
    finished.current = true
    try {
      const result = await api.saveAttempt({
        userId: user.id,
        questionIds: questions.map((question) => question.id),
        answers,
      })
      navigate(`/app/resultat/${result.attemptId}`, { replace: true })
    } catch (error) {
      finished.current = false
      setSaving(false)
      setSubmitError(
        error instanceof Error ? error.message : 'La série n’a pas pu être enregistrée.',
      )
    }
  }

  function quit() {
    if (
      answeredCount > 0 &&
      !window.confirm('Quitter cette série ? Vos réponses ne seront pas enregistrées.')
    ) {
      return
    }
    navigate('/app')
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-lg">
          <p className="text-[12px] text-mute">Préparation de la série</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Vingt questions arrivent.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">
            Le sujet est chargé de façon sécurisée. La correction restera masquée jusqu’à l’envoi.
          </p>
        </div>
      </div>
    )
  }

  if (blocked) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-lg">
          <p className="text-[12px] text-mute">Série interrompue</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Le cycle est terminé.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">
            Votre accès n’est plus actif. Vos anciens résultats restent consultables dans
            l’historique.
          </p>
          <ButtonLink to="/app" className="mt-6">
            Retour au tableau de bord
          </ButtonLink>
        </div>
      </div>
    )
  }

  if (loadError || !current) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-lg">
          <p className="text-[12px] text-mute">Série indisponible</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Aucune question à afficher.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">
            {loadError || 'Le sujet n’a pas encore de questions publiées. Contactez votre docteur.'}
          </p>
          <ButtonLink to="/app" className="mt-6">
            Retour au tableau de bord
          </ButtonLink>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-68px)] bg-canvas">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-content px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={quit}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-mute transition hover:text-ink"
            >
              <ArrowLeft size={14} /> Quitter
            </button>
            <p className="text-[12px] tabular-nums text-mute">
              Question <span className="font-medium text-ink">{String(index + 1).padStart(2, '0')}</span>{' '}
              / {String(questions.length).padStart(2, '0')}
            </p>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-mute">
              <Clock3 size={13} /> {timeLeft(expiresAt)}
            </span>
          </div>
          <ProgressBar
            value={((index + 1) / questions.length) * 100}
            className="mt-3 h-1"
            barClassName="bg-accent"
          />
        </div>
      </div>

      <div className="mx-auto max-w-[900px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-mute">
          <span className="font-medium text-ink">{current.matiere}</span>
          <span className="h-1 w-1 rounded-full bg-line" />
          <span>Une seule réponse</span>
          <span className="ml-auto rounded-full bg-cloud px-2.5 py-1">
            {questions.length} questions au total
          </span>
        </div>

        <h1 className="mt-5 max-w-3xl font-display text-[clamp(1.7rem,3.2vw,2.35rem)] leading-[1.25] tracking-[-0.02em] text-ink">
          {current.statement}
        </h1>

        <div className="mt-7 space-y-2.5" role="group" aria-label="Réponses possibles">
          {answerLetters.map((letter) => {
            const active = selected.includes(letter)
            return (
              <button
                key={letter}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => toggleAnswer(letter)}
                className={cn(
                  'flex w-full items-start gap-3.5 rounded-xl border px-3.5 py-3.5 text-left transition',
                  active
                    ? 'border-accent bg-accent-soft'
                    : 'border-line bg-surface hover:border-accent/50 hover:bg-canvas',
                )}
              >
                <span
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-[12px] font-semibold',
                    active
                      ? 'border-accent bg-accent text-white'
                      : 'border-line bg-canvas text-mute',
                  )}
                >
                  {letter}
                </span>
                <span className="flex-1 pt-1 text-[14px] leading-relaxed text-ash">
                  {current.options[letter]}
                </span>
                <span
                  className={cn(
                    'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border transition',
                    active ? 'border-accent bg-accent text-white' : 'border-line bg-surface',
                  )}
                  aria-hidden
                >
                  {active && <Check size={12} strokeWidth={3} />}
                </span>
              </button>
            )
          })}
        </div>

        {submitError && (
          <p className="mt-5 rounded-lg border border-sale/20 bg-danger-soft px-4 py-3 text-[13px] text-sale" role="alert">
            {submitError}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2"><button type="button" onClick={quit} className="inline-flex h-10 items-center gap-1.5 text-[12px] font-medium text-mute transition hover:text-ink"><ArrowLeft size={14} /> Quitter la série</button>{index > 0 && <button type="button" onClick={() => setIndex((v) => Math.max(0, v - 1))} className="inline-flex h-10 items-center gap-1.5 text-[12px] font-medium text-mute transition hover:text-ink"><ArrowLeft size={14} /> Précédente</button>}</div>

          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
            <span className="text-center text-[11px] text-mute sm:text-right">
              {answeredCount} / {questions.length} répondues
            </span>
            <Button
              onClick={goNext}
              disabled={selected.length === 0 || saving}
              className="min-w-[172px]"
            >
              {isLast ? (saving ? 'Enregistrement…' : 'Terminer la série') : 'Question suivante'}
              {!isLast && <ArrowRight size={15} />}
            </Button>
          </div>
        </div>

        <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-mute">
          <ShieldCheck size={13} className="mt-0.5 shrink-0 text-accent" />
          La correction et les bonnes réponses apparaîtront uniquement après l’envoi de la série.
        </p>
      </div>
    </div>
  )
}
