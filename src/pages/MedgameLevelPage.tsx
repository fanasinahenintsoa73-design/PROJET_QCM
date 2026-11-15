import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { usePageTitle } from '@/components/Layouts'
import { LevelRunner } from '@/components/anki/LevelRunner'
import type { AnkiLevelResult, MedgameRunState, Question } from '@/types'

/**
 * Un niveau MEDGAME : les 5 questions du niveau, répondues sans correction,
 * puis une seule soumission. Le bilan reprend la même grammaire que les séries
 * de questions.
 */
export default function MedgameLevelPage() {
  usePageTitle('Niveau — MEDGAME — MEDQCM mada')
  const navigate = useNavigate()
  const [state, setState] = useState<MedgameRunState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const overview = await api.getMedgameOverview()
      let runId = overview.run?.id ?? null
      if (!runId) {
        const started = await api.startMedgameRun()
        runId = started.run.id
      }
      setState(await api.getMedgameRun(runId))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ce niveau est indisponible.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Tant que le niveau est ouvert, le parcours reste vivant.
  useEffect(() => {
    const runId = state?.run?.id
    if (!runId) return
    const timer = window.setInterval(() => {
      void api.heartbeatMedgameRun(runId)
    }, 25_000)
    return () => window.clearInterval(timer)
  }, [state])

  async function submit(answers: Record<string, string[]>) {
    if (!state) return
    const payload = state.questions.map((question) => ({
      questionId: question.id,
      given: answers[question.id] ?? [],
    }))
    const result = await api.submitMedgameLevel(state.run.id, payload)

    // La correction est complétée par le serveur : on enrichit les questions
    // avec la bonne réponse et l'explication avant d'afficher le bilan.
    const corrections = new Map(result.answers.map((answer) => [answer.questionId, answer]))
    const questions: Question[] = state.questions.map((question) => {
      const correction = corrections.get(question.id)
      if (!correction) return question
      return {
        ...question,
        correctAnswers: correction.correctAnswers,
        explanation: correction.explanation,
      }
    })

    const bilan: AnkiLevelResult = {
      level: result.level,
      stars: result.stars,
      correct: result.correct,
      total: result.total,
      passed: result.passed,
      nextUnlocked: result.nextLevel !== null,
      bestStars: result.stars,
      totalLevels: state.progress.levelCount,
    }

    navigate(`/app/medgame/parcours/niveau/${result.level}/bilan`, {
      state: {
        result: bilan,
        questions,
        answers,
        consumed: result.consumed,
        runAlreadyConsumed: state.run.consumedReason === 'resume_after_abandonment',
        completed: result.completed,
        failed: result.failed,
      },
    })
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-content items-center justify-center px-5">
        <div className="text-center">
          <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="mt-4 text-sm text-mute">Chargement du niveau…</p>
        </div>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-10">
        <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Niveau indisponible</p>
        <h1 className="mt-3 font-display text-[2.4rem] leading-none text-ink">
          Ce niveau n’est pas ouvert.
        </h1>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-mute">
          {error || 'Reprends ton parcours pour continuer.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/app/medgame/parcours')}
          className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-accent"
        >
          Retour à la planche des niveaux
        </button>
      </div>
    )
  }

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <LevelRunner
          level={state.run.currentLevel}
          questions={state.questions}
          onExit={() => navigate('/app/medgame/parcours')}
          onSubmit={submit}
          backLabel="Planche des niveaux"
        />
      </div>
    </div>
  )
}
