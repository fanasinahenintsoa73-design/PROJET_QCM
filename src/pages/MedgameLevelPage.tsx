import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { useMedgameKeepAlive } from '@/lib/useMedgameKeepAlive'
import { usePageTitle } from '@/components/Layouts'
import { LevelRunner } from '@/components/anki/LevelRunner'
import type { AnkiLevelResult, MedgameRunState, Question } from '@/types'

/**
 * Un niveau MEDGAME : les 5 questions tirées au hasard dans les chapitres
 * choisis, répondues sans correction, puis une seule soumission. Le bilan
 * reprend la même grammaire que les séries de questions.
 */
export default function MedgameLevelPage() {
  usePageTitle('Niveau — MEDGAME — MEDQCM mada')
  const navigate = useNavigate()
  const { progressId = '' } = useParams()
  const [state, setState] = useState<MedgameRunState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const overview = await api.getMedgameOverview()
      const board = overview.boards.find((item) => item.progress.id === progressId)
      if (!board) {
        throw new Error('Cette planche n’est plus ouverte.')
      }
      const runId = board.run?.id ?? null
      const started = runId
        ? await api.getMedgameRun(runId)
        : await api.startMedgameRun(progressId)
      setState(started)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ce niveau est indisponible.')
    } finally {
      setLoading(false)
    }
  }, [progressId])

  useEffect(() => {
    void load()
  }, [load])

  // Tant que le niveau est ouvert, le parcours reste vivant.
  useMedgameKeepAlive(state?.run?.status === 'in_progress' ? state.run.id : null)

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

    navigate(`/app/medgame/parcours/${progressId}/niveau/${result.level}/bilan`, {
      state: {
        result: bilan,
        questions,
        answers,
        progressId,
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
          Retour à mes planches
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
