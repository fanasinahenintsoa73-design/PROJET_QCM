import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  RotateCcw,
  Star,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { usePageTitle } from '@/components/Layouts'
import { cn, sameAnswer } from '@/lib/utils'
import type {
  MedgameAnswerInput,
  MedgameResult,
  MedgameRunState,
  Question,
} from '@/types'

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const

function questionOptions(question: Question): Array<{ letter: string; text: string }> {
  return LETTERS.filter((letter) => Boolean(question.options[letter])).map((letter) => ({
    letter,
    text: question.options[letter] ?? '',
  }))
}

export default function MedgameRunPage() {
  usePageTitle('MEDGAME — Partie en cours')
  const navigate = useNavigate()
  const [state, setState] = useState<MedgameRunState | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [result, setResult] = useState<MedgameResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [exitPath, setExitPath] = useState<string | null>(null)
  const [abandoning, setAbandoning] = useState(false)

  const loadRun = useCallback(async (runId?: string) => {
    setLoading(true)
    try {
      const next = runId ? await api.getMedgameRun(runId) : await api.startMedgameRun()
      setState(next)
      setIndex(0)
      setAnswers({})
      setResult(null)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger la partie.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRun()
  }, [loadRun])

  const runId = state?.run.id
  const runActive = state?.run.status === 'in_progress' && !result

  useEffect(() => {
    if (!runId || !runActive) return
    const timer = window.setInterval(() => {
      void api.heartbeatMedgameRun(runId)
    }, 25_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void api.heartbeatMedgameRun(runId)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [runActive, runId])

  useEffect(() => {
    if (!runActive) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('/app/medgame')) return
      event.preventDefault()
      event.stopPropagation()
      setExitPath(href)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [runActive])

  const questions = state?.questions ?? []
  const question = questions[index]
  const answered = question ? (answers[question.id]?.length ?? 0) > 0 : false
  const allAnswered = questions.length > 0 && questions.every((item) => answers[item.id]?.length)

  const progress = useMemo(
    () => (questions.length ? ((index + 1) / questions.length) * 100 : 0),
    [index, questions.length],
  )

  function choose(letter: string) {
    if (!question || result) return
    setAnswers((current) => ({ ...current, [question.id]: [letter] }))
  }

  async function submit() {
    if (!state || !allAnswered || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const payload: MedgameAnswerInput[] = questions.map((item) => ({
        questionId: item.id,
        given: answers[item.id] ?? [],
      }))
      const nextResult = await api.submitMedgameLevel(state.run.id, payload)
      setResult(nextResult)
      // Le quota affiché en en-tête doit refléter la série éventuellement
      // consommée à la fin du niveau.
      setState((current) =>
        current ? { ...current, quota: nextResult.quota } : current,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer le niveau.')
    } finally {
      setSubmitting(false)
    }
  }

  async function nextLevel() {
    if (!state) return
    await loadRun(state.run.id)
  }

  async function retry() {
    await loadRun()
  }

  async function confirmExit() {
    if (!state || abandoning) return
    setAbandoning(true)
    try {
      await api.abandonMedgameRun(state.run.id)
    } catch {
      /* le balayage serveur finalisera l'abandon */
    } finally {
      const target = exitPath ?? '/app/medgame'
      setAbandoning(false)
      setExitPath(null)
      navigate(target)
    }
  }

  async function leaveNow() {
    if (!state) {
      navigate('/app/medgame')
      return
    }
    setExitPath('/app/medgame')
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-content items-center justify-center px-5">
        <div className="text-center">
          <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="mt-4 text-sm text-mute">Chargement de la partie…</p>
        </div>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="mx-auto max-w-content px-5 py-16 text-center">
        <p className="text-[14px] text-mute">{error || 'Aucune partie MEDGAME en cours.'}</p>
        <Button className="mt-5" onClick={() => navigate('/app/medgame')}>
          Retour à MEDGAME
        </Button>
      </div>
    )
  }

  const level = state.run.currentLevel
  const totalLevels = state.progress.levelCount
  const stars = result?.stars ?? 0
  // Une reprise après abandon a déjà consommé sa série au démarrage.
  const runAlreadyConsumed = state.run.consumedReason === 'resume_after_abandonment'

  return (
    <div className="min-h-[calc(100vh-100px)] bg-canvas">
      <div className="mx-auto max-w-content px-5 py-6 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void leaveNow()}
            className="inline-flex items-center gap-2 text-[12px] font-medium text-mute transition hover:text-accent"
          >
            <ArrowLeft size={14} /> Quitter
          </button>
          <div className="flex items-center gap-3 text-[12px] text-mute">
            <span>
              Niveau <strong className="text-ink">{level}</strong> / {totalLevels}
            </span>
            <span className="h-1 w-1 rounded-full bg-line" />
            <span>
              {state.quota.remaining} série{state.quota.remaining > 1 ? 's' : ''} restante
              {state.quota.remaining > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-cloud">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-sale/25 bg-sale/5 px-4 py-3 text-[13px] text-sale">
            {error}
          </div>
        )}

        {result ? (
          <ResultPanel
            result={result}
            level={level}
            totalLevels={totalLevels}
            stars={stars}
            runAlreadyConsumed={runAlreadyConsumed}
            onNext={() => void nextLevel()}
            onRetry={() => void retry()}
            onHome={() => navigate('/app/medgame')}
          />
        ) : question ? (
          <div className="mx-auto mt-7 max-w-3xl">
            <div className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
                  Question {index + 1} / {questions.length}
                </p>
                <div className="flex items-center gap-1 text-accent">
                  {questions.map((_, itemIndex) => (
                    <span
                      key={itemIndex}
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        itemIndex === index ? 'bg-accent' : 'bg-line',
                      )}
                    />
                  ))}
                </div>
              </div>

              <h2 className="mt-5 text-[16px] font-medium leading-relaxed text-ink sm:text-[18px]">
                {question.statement}
              </h2>

              <div className="mt-5 space-y-2.5">
                {questionOptions(question).map((option) => {
                  const chosen = answers[question.id]?.includes(option.letter)
                  return (
                    <button
                      key={option.letter}
                      type="button"
                      onClick={() => choose(option.letter)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-[13px] leading-relaxed transition',
                        chosen
                          ? 'border-accent bg-accent-soft/60 text-ink'
                          : 'border-line bg-surface text-ink hover:border-accent/40 hover:bg-cloud/40',
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold',
                          chosen
                            ? 'border-accent bg-accent text-white'
                            : 'border-line bg-canvas text-mute',
                        )}
                      >
                        {option.letter}
                      </span>
                      <span>{option.text}</span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => setIndex((current) => Math.max(0, current - 1))}
                  >
                    <ChevronLeft size={15} /> Précédent
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={index >= questions.length - 1}
                    onClick={() => setIndex((current) => Math.min(questions.length - 1, current + 1))}
                  >
                    Suivant <ChevronRight size={15} />
                  </Button>
                </div>
                <Button onClick={() => void submit()} disabled={!allAnswered} loading={submitting}>
                  Valider le niveau <ArrowRight size={15} />
                </Button>
              </div>
              {!answered && (
                <p className="mt-3 text-right text-[11px] text-mute">
                  Choisis une réponse pour continuer.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-[14px] text-mute">Ce niveau ne contient aucune question.</p>
            <Button className="mt-5" onClick={() => navigate('/app/medgame')}>
              Retour à MEDGAME
            </Button>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(exitPath)}
        onClose={() => setExitPath(null)}
        title="Quitter MEDGAME ?"
        eyebrow="Abandon"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setExitPath(null)}>
              Rester
            </Button>
            <Button variant="danger" onClick={() => void confirmExit()} loading={abandoning}>
              <DoorOpen size={15} /> Quitter et abandonner
            </Button>
          </div>
        }
      >
        <p className="text-[13px] leading-relaxed text-mute">
          Quitter maintenant compte comme un abandon et consomme une série. Ta progression dans le
          parcours est conservée.
        </p>
      </Modal>
    </div>
  )
}

function ResultPanel({
  result,
  level,
  totalLevels,
  stars,
  runAlreadyConsumed,
  onNext,
  onRetry,
  onHome,
}: {
  result: MedgameResult
  level: number
  totalLevels: number
  stars: number
  runAlreadyConsumed: boolean
  onNext: () => void
  onRetry: () => void
  onHome: () => void
}) {
  const success = result.passed
  return (
    <div className="mx-auto mt-7 max-w-3xl">
      <div
        className={cn(
          'rounded-2xl border p-6 sm:p-8',
          success ? 'border-accent/25 bg-accent-soft/40' : 'border-sale/25 bg-sale/5',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
              Niveau {level} / {totalLevels}
            </p>
            <h2 className="mt-2 font-display text-[clamp(1.7rem,3vw,2.4rem)] leading-tight tracking-[-0.02em] text-ink">
              {result.completed
                ? 'Parcours terminé.'
                : success
                  ? 'Niveau réussi.'
                  : 'Niveau échoué.'}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-mute">
              {result.completed
                ? runAlreadyConsumed
                  ? 'Tu as terminé tous les niveaux. La série de cette reprise a été consommée à son démarrage.'
                  : 'Tu as terminé tous les niveaux. Une série est consommée.'
                : success
                  ? runAlreadyConsumed
                    ? 'Tu passes au niveau suivant. La série de cette reprise a déjà été consommée.'
                    : 'Tu passes au niveau suivant. Une série sera consommée à la fin du parcours.'
                  : runAlreadyConsumed
                    ? 'Il faut 5/5 pour passer. Ta progression est conservée : tu reprendras à ce niveau. La série de cette reprise a déjà été consommée.'
                    : 'Il faut 5/5 pour passer. Ta progression est conservée : tu reprendras à ce niveau.'}
            </p>
          </div>
          <div className="flex items-center gap-1 text-accent">
            {Array.from({ length: result.total }, (_, index) => (
              <Star
                key={index}
                size={20}
                fill={index < stars ? 'currentColor' : 'none'}
                className={index < stars ? '' : 'text-line'}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-mute">Score</p>
            <p className="mt-1 text-[18px] font-medium text-ink">
              {result.correct} / {result.total}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-mute">Séries restantes</p>
            <p className="mt-1 text-[18px] font-medium text-ink">{result.quota.remaining}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-mute">Prochain niveau</p>
            <p className="mt-1 text-[18px] font-medium text-ink">
              {result.completed ? '—' : result.nextLevel}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {result.completed ? (
            <Button onClick={onHome}>
              Choisir un nouveau parcours <ArrowRight size={15} />
            </Button>
          ) : success ? (
            <Button onClick={onNext}>
              Niveau suivant <ArrowRight size={15} />
            </Button>
          ) : (
            <Button onClick={onRetry}>
              <RotateCcw size={15} /> Réessayer
            </Button>
          )}
          <Button variant="secondary" onClick={onHome}>
            Retour à MEDGAME
          </Button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-4">
          <h3 className="text-[13px] font-medium text-ink">Correction</h3>
        </div>
        <div className="divide-y divide-line">
          {result.answers.map((answer, answerIndex) => {
            const question = result.answers[answerIndex]
            return (
              <div key={answer.questionId} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full',
                      answer.correct ? 'bg-accent-soft text-accent' : 'bg-sale/10 text-sale',
                    )}
                  >
                    {answer.correct ? <Check size={13} /> : <X size={13} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-relaxed text-ink">
                      Question {answerIndex + 1}
                    </p>
                    <p className="mt-1 text-[12px] text-mute">
                      Ta réponse : {answer.given.length ? answer.given.join(', ') : '—'} · Bonne
                      réponse : {question.correctAnswers.join(', ')}
                    </p>
                    {answer.explanation && (
                      <p className="mt-2 text-[12px] leading-relaxed text-mute">
                        {answer.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
