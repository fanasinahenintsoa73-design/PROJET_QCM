import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { themeTitle } from '@/lib/themes'
import { usePageTitle } from '@/components/Layouts'
import { LevelGrid } from '@/components/anki/LevelGrid'
import { MedgameAbandonModal } from '@/components/MedgameAbandonModal'
import type { AnkiLevel, MedgameOverview } from '@/types'

/**
 * La planche des niveaux d'un parcours MEDGAME : un cadre par niveau, sur fond
 * manga. Seul le niveau en cours est jouable.
 */
export default function MedgameLevelMapPage() {
  usePageTitle('Planche des niveaux — MEDGAME — MEDQCM mada')
  const navigate = useNavigate()
  const [overview, setOverview] = useState<MedgameOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [abandonOpen, setAbandonOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      setOverview(await api.getMedgameOverview())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Le parcours est indisponible.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Le parcours doit rester vivant : un battement toutes les 25 secondes.
  useEffect(() => {
    const runId = overview?.run?.id
    if (!runId || overview?.run?.status !== 'in_progress') return
    const timer = window.setInterval(() => {
      void api.heartbeatMedgameRun(runId)
    }, 25_000)
    return () => window.clearInterval(timer)
  }, [overview])

  const progress = overview?.progress ?? null
  const quota = overview?.quota ?? null
  const usedPercent = quota && quota.limit > 0 ? (quota.used / quota.limit) * 100 : 0

  const levels: AnkiLevel[] = (overview?.levels ?? []).map((level) => {
    const completed = progress?.status === 'completed'
    const status: AnkiLevel['status'] = completed || level.level < progress!.currentLevel
      ? 'passed'
      : level.level === progress!.currentLevel
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

  const playableLevel = progress?.status === 'completed' ? undefined : progress?.currentLevel

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-content items-center justify-center px-5">
        <div className="text-center">
          <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="mt-4 text-sm text-mute">Chargement de la planche…</p>
        </div>
      </div>
    )
  }

  if (!progress) {
    return (
      <div className="mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-10">
        <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Aucun parcours</p>
        <h1 className="mt-3 font-display text-[2.4rem] leading-none text-ink">
          Choisis d’abord tes chapitres.
        </h1>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-mute">
          Un parcours MEDGAME se construit à partir d’une UE et de ses chapitres. Tes questions
          seront mélangées en niveaux de 5.
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
              {themeTitle(progress.ueId)}
            </h1>
            <div className="mt-3 flex items-center gap-3 text-[12px] text-mute">
              <span>
                Niveau{' '}
                <strong className="text-ink">
                  {Math.min(progress.currentLevel, progress.levelCount)}
                </strong>{' '}
                / {progress.levelCount}
              </span>
              <span className="h-1 w-1 rounded-full bg-line" />
              <span>
                {quota ? `${quota.remaining} série${quota.remaining > 1 ? 's' : ''} restante${quota.remaining > 1 ? 's' : ''}` : '—'}
              </span>
            </div>
            <div className="mt-4 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-cloud">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${usedPercent}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {overview?.run?.status === 'in_progress' ? (
              <button
                type="button"
                onClick={() => setAbandonOpen(true)}
                className="text-[12px] font-medium text-mute transition hover:text-sale"
              >
                Quitter MEDGAME
              </button>
            ) : null}
            <Link
              to="/app"
              className="text-[12px] font-medium text-mute transition hover:text-accent"
            >
              Quitter le parcours
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-sale/25 bg-sale/5 px-4 py-3 text-[13px] text-sale">
            {error}
          </div>
        ) : null}

        {progress.status === 'completed' ? (
          <div className="mt-6 rounded-xl border border-accent/20 bg-accent-soft/40 px-4 py-3 text-[13px] text-ink">
            Parcours terminé. Toutes les étoiles sont récoltées.
          </div>
        ) : null}

        <div className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-7">
          <LevelGrid
            levels={levels}
            chapterTitle={themeTitle(progress.ueId)}
            chapterId={progress.chapterIds.join('_')}
            planche={1}
            playableLevel={playableLevel}
            onSelect={(level) => navigate(`/app/medgame/parcours/niveau/${level}`)}
          />
        </div>
      </div>

      <MedgameAbandonModal
        open={abandonOpen}
        onClose={() => setAbandonOpen(false)}
        runId={overview?.run?.id ?? null}
        onAbandoned={() => {
          setAbandonOpen(false)
          navigate('/app')
        }}
      />
    </div>
  )
}
