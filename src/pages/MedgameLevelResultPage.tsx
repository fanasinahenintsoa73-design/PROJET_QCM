import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { usePageTitle } from '@/components/Layouts'
import { LevelBilan } from '@/components/anki/LevelBilan'
import type { AnkiLevelResult, Question, SeriesQuota } from '@/types'

type BilanState = {
  result: AnkiLevelResult
  questions: Question[]
  answers: Record<string, string[]>
  progressId?: string
  consumed?: boolean
  runAlreadyConsumed?: boolean
  completed?: boolean
  failed?: boolean
  /** Quota renvoyé par le serveur : il est à jour, sans rechargement. */
  quota?: SeriesQuota
}

/**
 * Le bilan d'un niveau MEDGAME : même grammaire que le corrigé des séries de
 * questions — la réponse attendue en vert, la réponse donnée fausse en rouge,
 * puis l'explication.
 */
export default function MedgameLevelResultPage() {
  usePageTitle('Bilan du niveau — MEDGAME — MEDQCM mada')
  const location = useLocation()
  const navigate = useNavigate()
  const { progressId: progressIdParam = '' } = useParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const state = (location.state ?? null) as BilanState | null
  const progressId = state?.progressId ?? progressIdParam

  const note = useMemo(() => {
    if (!state) return null
    if (state.runAlreadyConsumed) {
      return state.failed || state.completed
        ? 'La série de cette reprise a été consommée à son démarrage.'
        : 'La série de cette reprise a déjà été consommée.'
    }
    if (state.failed) {
      return "Le parcours s'arrête ici : une série est consommée. Tu peux reprendre ce niveau, la nouvelle tentative consommera une autre série."
    }
    if (state.completed) {
      return 'Parcours terminé : une série est consommée.'
    }
    return 'Une série sera consommée à la fin du parcours.'
  }, [state])

  if (!state?.result) {
    return (
      <div className="mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-10">
        <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Bilan indisponible</p>
        <h1 className="mt-3 font-display text-[2.4rem] leading-none text-ink">
          Le bilan de ce niveau n’est plus disponible.
        </h1>
        <Link
          to="/app/medgame/parcours"
          className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-accent"
        >
          <ArrowLeft size={15} /> Retour à mes planches
        </Link>
      </div>
    )
  }

  const { result } = state
  const isLastLevel = result.level >= result.totalLevels

  function clearAbandonedKey() {
    try {
      window.sessionStorage.removeItem(`medgame.level.abandoned.${progressId}`)
    } catch {
      // Navigateur sans stockage session.
    }
  }

  async function replay() {
    if (busy || !progressId) return
    setBusy(true)
    setError('')
    clearAbandonedKey()
    try {
      const started = await api.startMedgameRun(progressId)
      navigate(`/app/medgame/parcours/${progressId}/niveau/${started.run.currentLevel}`, {
        replace: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Le niveau n’a pas pu être relancé.')
      setBusy(false)
    }
  }

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        {error ? (
          <div className="mb-6 rounded-xl border border-sale/25 bg-sale/5 px-4 py-3 text-[13px] text-sale">
            {error}
          </div>
        ) : null}

        <LevelBilan
          chapterId=""
          level={result.level}
          result={result}
          questions={state.questions}
          answers={state.answers}
          completionLabel="Parcours terminé"
          failureHint={(missing) =>
            `Il te manque ${missing} bonne${missing > 1 ? 's' : ''} réponse${
              missing > 1 ? 's' : ''
            } pour valider ce niveau.`
          }
          note={note}
          primaryLabel={
            state.failed
              ? 'Rejouer le niveau'
              : state.completed
                ? 'Retour à mes planches'
                : 'Niveau suivant'
          }
          onPrimary={
            state.failed
              ? () => void replay()
              : state.completed
                ? () => navigate('/app/medgame/parcours')
                : () => {
                    clearAbandonedKey()
                    navigate(`/app/medgame/parcours/${progressId}/niveau/${result.level + 1}`, {
                      replace: true,
                    })
                  }
          }
          secondaryLabel="Carte des niveaux"
          onSecondary={() => navigate('/app/medgame/parcours')}
        />

        <p className="mt-4 text-center text-[11px] leading-relaxed text-mute">
          {isLastLevel
            ? 'Dernier niveau du parcours.'
            : `Il reste ${result.totalLevels - result.level} niveau${
                result.totalLevels - result.level > 1 ? 's' : ''
              } avant la fin du parcours.`}
        </p>

        {state.quota ? (
          <p className="mt-1 text-center text-[11px] leading-relaxed text-mute">
            Il te reste {state.quota.remaining} série
            {state.quota.remaining > 1 ? 's' : ''} sur {state.quota.limit}.
          </p>
        ) : null}
      </div>
    </div>
  )
}
