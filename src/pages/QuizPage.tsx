import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { getSeriesUsage } from '@/lib/db'
import type { QuizPayload } from '@/lib/supabaseData'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { usePageTitle } from '@/components/Layouts'
import { findPaceTheme } from '@/lib/themes'
import {
  answerLetters,
  cn,
  errorCode,
  SERIES_LIMIT,
  SERIES_LIMIT_MESSAGE,
  SERIES_SIZE,
  type AnswerLetter,
} from '@/lib/utils'

type BlockReason = 'limit' | 'access' | null

export default function QuizPage() {
  usePageTitle('Série en cours — MEDQCM L1')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, db } = useAuth()
  const themeParam = searchParams.get('theme') ?? ''
  const theme = findPaceTheme(themeParam)
  const usage = user ? getSeriesUsage(user.id, db) : undefined
  const seriesNumber = Math.min(SERIES_LIMIT, (usage?.used ?? 0) + 1)

  const [payload, setPayload] = useState<QuizPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState<BlockReason>(null)
  const [unavailable, setUnavailable] = useState('')
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

  useEffect(() => {
    if (!user || !themeParam) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setBlocked(null)
    setUnavailable('')
    setLoadError('')
    setPayload(null)

    const selectedTheme = findPaceTheme(themeParam)
    const subject =
      (selectedTheme
        ? db.subjects.find(
            (candidate) =>
              candidate.id === selectedTheme.id ||
              findPaceTheme(candidate.title)?.id === selectedTheme.id,
          )
        : undefined) ?? db.subjects.find((candidate) => candidate.id === themeParam)
    const subjectId = subject?.id ?? themeParam

    api
      .startQuiz(user.id, subjectId, SERIES_SIZE)
      .then((quiz) => {
        if (!active) return
        setPayload(quiz)
        setIndex(0)
        setAnswers({})
        finished.current = false
      })
      .catch((error: unknown) => {
        if (!active) return
        const message =
          error instanceof Error ? error.message : 'La série n’a pas pu être chargée.'
        switch (errorCode(error)) {
          case 'SERIES_LIMIT_REACHED':
            setBlocked('limit')
            return
          case 'ACCESS_EXPIRED':
            setBlocked('access')
            return
          case 'THEME_UNAVAILABLE':
          case 'THEME_NOT_FOUND':
            setUnavailable(message)
            return
          default:
            break
        }
        if (/accès|attribué|terminé/i.test(message)) setBlocked('access')
        else setLoadError(message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [db.subjects, themeParam, user?.id])

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
    if (!payload) {
      setBlocked('access')
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
        subjectId: payload.subject.id,
        questionIds: questions.map((question) => question.id),
        answers,
      })
      navigate(`/app/resultat/${result.attemptId}`, { replace: true })
    } catch (error) {
      finished.current = false
      setSaving(false)
      if (errorCode(error) === 'SERIES_LIMIT_REACHED') {
        setBlocked('limit')
        return
      }
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
          <p className="text-[12px] text-mute">
            {theme ? theme.title : 'Préparation de la série'}
          </p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Dix questions arrivent.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">
            Le thème est chargé de façon sécurisée. La correction restera masquée jusqu’à l’envoi.
          </p>
        </div>
      </div>
    )
  }

  if (!themeParam) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-lg">
          <p className="text-[12px] text-mute">Aucun thème sélectionné</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Choisissez un thème.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">
            Les neuf thèmes PACES sont accessibles depuis votre tableau de bord. Chaque série
            contient dix questions.
          </p>
          <ButtonLink to="/app" className="mt-6">
            Voir les neuf thèmes
          </ButtonLink>
        </div>
      </div>
    )
  }

  if (blocked === 'limit') {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-lg">
          <p className="text-[12px] text-mute">Quota du cycle</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Vos 30 séries sont terminées.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">
            {SERIES_LIMIT_MESSAGE}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <ButtonLink to="/reinscription">Renouveler mon accès</ButtonLink>
            <ButtonLink to="/app" variant="ghost">
              Retour au tableau de bord
            </ButtonLink>
          </div>
        </div>
      </div>
    )
  }

  if (blocked === 'access') {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-lg">
          <p className="text-[12px] text-mute">Série interrompue</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Le cycle est terminé.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">
            Votre accès n’est plus actif. Renouvelez votre abonnement pour retrouver les neuf
            thèmes et vos 30 séries.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <ButtonLink to="/reinscription">Renouveler mon accès</ButtonLink>
            <ButtonLink to="/app" variant="ghost">
              Retour au tableau de bord
            </ButtonLink>
          </div>
        </div>
      </div>
    )
  }

  if (unavailable) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-lg">
          <p className="text-[12px] text-mute">Thème en préparation</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Bientôt disponible.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">{unavailable}</p>
          <ButtonLink to="/app" className="mt-6">
            Choisir un autre thème
          </ButtonLink>
        </div>
      </div>
    )
  }

  if (loadError || !payload || !current) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-lg">
          <p className="text-[12px] text-mute">Série indisponible</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Aucune question à afficher.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">
            {loadError || 'Ce thème n’a pas encore ses dix questions. Contactez votre docteur.'}
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
              Série <span className="font-medium text-ink">{seriesNumber}</span> sur {SERIES_LIMIT}
            </p>
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
          <span className="font-medium text-ink">{payload.subject.title}</span>
          <span className="h-1 w-1 rounded-full bg-line" />
          <span>Une seule réponse</span>
          <span className="ml-auto rounded-full bg-cloud px-2.5 py-1">
            Question {String(index + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}
          </span>
        </div>

        <h1 className="mt-5 max-w-3xl font-display text-[clamp(1.7rem,3.2vw,2.35rem)] leading-[1.25] tracking-[-0.02em] text-ink">
          {current.statement}
        </h1>

        <div className="mt-7 space-y-2.5" role="group" aria-label="Réponses possibles">
          {answerLetters.filter((letter) => current.options[letter]?.trim()).map((letter) => {
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={quit}
              className="inline-flex h-10 items-center gap-1.5 text-[12px] font-medium text-mute transition hover:text-ink"
            >
              <ArrowLeft size={14} /> Quitter la série
            </button>
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((value) => Math.max(0, value - 1))}
                className="inline-flex h-10 items-center gap-1.5 text-[12px] font-medium text-mute transition hover:text-ink"
              >
                <ArrowLeft size={14} /> Précédente
              </button>
            )}
          </div>

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
