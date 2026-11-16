import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import { useMedgameKeepAlive } from '@/lib/useMedgameKeepAlive'
import { themeNumber, themeTitle } from '@/lib/themes'
import { usePageTitle } from '@/components/Layouts'
import { LevelGrid } from '@/components/anki/LevelGrid'
import type { AnkiLevel, MedgameBoard, MedgameOverview } from '@/types'

/**
 * Le jeu MEDGAME : une partie par UE choisie, avec un cadre par niveau.
 * Chaque niveau est tiré au hasard parmi les chapitres choisis dans l'UE, et
 * il faut 5/5 pour ouvrir le suivant.
 */
export default function MedgameLevelMapPage() {
  usePageTitle('Mon jeu — MEDGAME — MEDQCM mada')
  const navigate = useNavigate()
  const [overview, setOverview] = useState<MedgameOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startingId, setStartingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setOverview(await api.getMedgameOverview())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Le jeu est indisponible.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Le quota partagé bouge ailleurs (fin de parcours MEDGAME, série Pres
  // Concours) : on recharge l'aperçu quand l'onglet redevient visible ou
  // reprend le focus, sinon le compteur affiché reste figé.
  useEffect(() => {
    const reload = () => {
      if (document.visibilityState === 'visible') void load()
    }
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', reload)
    return () => {
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', reload)
    }
  }, [load])

  const boards = overview?.boards ?? []
  // Les parcours doivent rester vivants : un battement toutes les 25 secondes.
  const activeRunId =
    boards.find((board) => board.run?.status === 'in_progress')?.run?.id ?? null
  useMedgameKeepAlive(activeRunId)
  const quota = overview?.quota ?? null
  const usedPercent = quota && quota.limit > 0 ? (quota.used / quota.limit) * 100 : 0

  async function start(board: MedgameBoard) {
    if (startingId) return
    setStartingId(board.progress.id)
    setError('')
    try {
      window.sessionStorage.removeItem(`medgame.level.abandoned.${board.progress.id}`)
    } catch {
      // Navigateur sans stockage session.
    }
    try {
      const state = await api.startMedgameRun(board.progress.id)
      navigate(`/app/medgame/parcours/${board.progress.id}/niveau/${state.run.currentLevel}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Le parcours n’a pas pu être repris.')
      setStartingId(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-content items-center justify-center px-5">
        <div className="text-center">
          <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="mt-4 text-sm text-mute">Chargement de ton jeu…</p>
        </div>
      </div>
    )
  }

  if (boards.length === 0) {
    return (
      <div className="mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-10">
        <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Aucune partie</p>
        <h1 className="mt-3 font-display text-[2.4rem] leading-none text-ink">
          Choisis d’abord tes chapitres.
        </h1>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-mute">
          Ton jeu se construit à partir d’une UE et de ses chapitres. Tes questions seront tirées au
          hasard par blocs de 5.
        </p>
        <Link
          to="/app/medgame"
          className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-accent"
        >
          <ArrowLeft size={15} /> Retour à MEDGAME
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        <Link
          to="/app/medgame"
          className="inline-flex items-center gap-2 text-[12px] font-medium text-mute transition hover:text-accent"
        >
          <ArrowLeft size={14} /> MEDGAME
        </Link>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              MEDGAME
            </span>
            <h1 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-[-0.035em] text-ink">
              Mon jeu
            </h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-mute">
              Un jeu par UE choisie. Chaque niveau est tiré au hasard dans tes chapitres, et il
              faut 5/5 pour ouvrir le suivant.
            </p>
            <div className="mt-4 flex items-center gap-3 text-[12px] text-mute">
              <span>
                {boards.length} partie{boards.length > 1 ? 's' : ''} ouverte{boards.length > 1 ? 's' : ''}
                {boards.length > 1 ? 's' : ''}
              </span>
              <span className="h-1 w-1 rounded-full bg-line" />
              <span>
                {quota
                  ? `${quota.remaining} série${quota.remaining > 1 ? 's' : ''} restante${
                      quota.remaining > 1 ? 's' : ''
                    }`
                  : '—'}
              </span>
            </div>
            <div className="mt-4 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-cloud">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${usedPercent}%` }}
              />
            </div>
          </div>

          <Link
            to="/app/medgame"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent"
          >
            Ouvrir une autre UE <ArrowRight size={13} />
          </Link>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-sale/25 bg-sale/5 px-4 py-3 text-[13px] text-sale">
            {error}
          </div>
        ) : null}

        {boards.map((board, index) => {
          const progress = board.progress
          const title = themeTitle(progress.ueId)
          const number = themeNumber(progress.ueId)
          const levels: AnkiLevel[] = board.levels.map((level) => {
            const completed = progress.status === 'completed'
            const status: AnkiLevel['status'] =
              completed || level.level < progress.currentLevel
                ? 'passed'
                : level.level === progress.currentLevel
                  ? 'unlocked'
                  : 'locked'
            return {
              level: level.level,
              totalLevels: level.totalLevels,
              status,
              bestStars: level.bestStars ?? 0,
              attempts: 0,
              passedAt: null,
            }
          })
          const playableLevel =
            progress.status === 'completed' ? undefined : progress.currentLevel
          const running = board.run?.status === 'in_progress'

          return (
            <section
              key={progress.id}
              className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-7"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="inline-block rounded-md bg-accent-soft px-2 py-1 text-[12px] font-semibold uppercase leading-snug tracking-[0.04em] text-accent">
                    {number ? `UE${number}` : 'UE'}
                  </span>
                  <h2 className="font-display text-[1.4rem] leading-tight tracking-[-0.02em] text-ink">
                    {title}
                  </h2>
                </div>
              </div>

              <div className="mt-5">
                <LevelGrid
                  levels={levels}
                  chapterTitle={title}
                  chapterId={progress.chapterIds.join('_')}
                  planche={index + 1}
                  playableLevel={playableLevel}
                  onSelect={(level) => {
                    try {
                      window.sessionStorage.removeItem(`medgame.level.abandoned.${progress.id}`)
                    } catch {
                      // Navigateur sans stockage session.
                    }
                    navigate(`/app/medgame/parcours/${progress.id}/niveau/${level}`)
                  }}
                />
              </div>

              <p className="mt-4 text-[12px] leading-relaxed text-mute">
                Répondre correctement aux 5 questions pour accéder au niveau supérieur.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-4">
                {progress.status === 'completed' ? (
                  <p className="text-[12px] text-accent">
                    Parcours terminé. Toutes les étoiles sont récoltées.
                  </p>
                ) : running ? (
                  <p className="text-[12px] font-medium text-ink">
                    Partie en cours. Reprenez-la depuis l’accueil MEDGAME.
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={startingId === progress.id}
                    onClick={() => void start(board)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent transition hover:text-accent-deep disabled:opacity-60"
                  >
                    {startingId === progress.id ? 'Ouverture…' : 'Jouer le niveau suivant'}
                    <ArrowRight size={13} />
                  </button>
                )}
                <span className="text-[12px] text-mute">
                  Niveau {Math.min(progress.currentLevel, progress.levelCount)} /{' '}
                  {progress.levelCount}
                </span>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
