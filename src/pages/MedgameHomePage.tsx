import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Gamepad2,
  ListChecks,
  LockKeyhole,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { getUsableQuestions } from '@/lib/db'
import { chaptersForTheme, PACE_THEMES } from '@/lib/themes'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { usePageTitle } from '@/components/Layouts'
import { cn } from '@/lib/utils'
import type { Database, MedgameOverview } from '@/types'

function questionCount(chapterId: string, db: Database): number {
  return db.subjects
    .filter((subject) => !subject.archived && subject.chapterId === chapterId)
    .reduce((total, subject) => {
      const usable = getUsableQuestions(subject.id, db).length
      return total + (usable > 0 ? usable : (subject.questionCount ?? 0))
    }, 0)
}

export default function MedgameHomePage() {
  usePageTitle('MEDGAME — MEDQCM mada')
  const { db } = useAuth()
  const navigate = useNavigate()
  const [overview, setOverview] = useState<MedgameOverview | null>(null)
  const [activeUeId, setActiveUeId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [confirmChange, setConfirmChange] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setOverview(await api.getMedgameOverview())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger MEDGAME.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const selection = useMemo(
    () =>
      PACE_THEMES.map((theme) => ({
        theme,
        chapters: chaptersForTheme(theme.id).map((chapter) => {
          const count = questionCount(chapter.id, db)
          return { ...chapter, count, available: count > 0 }
        }),
      })),
    [db],
  )

  const activeTheme = PACE_THEMES.find((theme) => theme.id === activeUeId) ?? null
  const activeChapters = selection.find((entry) => entry.theme.id === activeUeId)?.chapters ?? []
  const activeAvailableCount = activeChapters.filter((chapter) => chapter.available).length
  const activeProgress = overview?.progress ?? null
  const activeRun = overview?.run ?? null

  function toggleChapter(chapterId: string) {
    if (activeProgress) return
    setSelected((current) =>
      current.includes(chapterId)
        ? current.filter((id) => id !== chapterId)
        : [...current, chapterId],
    )
  }

  async function start() {
    // Reprendre un parcours existant ne demande pas de nouveau chapitre.
    if (starting) return
    const ueId = activeUeId
    if (!activeProgress && (!ueId || selected.length === 0)) return
    setStarting(true)
    setError('')
    try {
      if (!activeProgress && ueId) {
        await api.createMedgameProgress(ueId, selected)
      }
      await api.startMedgameRun()
      navigate('/app/medgame/run')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de lancer MEDGAME.')
    } finally {
      setStarting(false)
    }
  }

  async function changeParcours() {
    if (!activeUeId || selected.length === 0) return
    setStarting(true)
    setError('')
    try {
      await api.createMedgameProgress(activeUeId, selected)
      await api.startMedgameRun()
      setConfirmChange(false)
      navigate('/app/medgame/run')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de changer de parcours.')
    } finally {
      setStarting(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-content items-center justify-center px-5">
        <div className="text-center">
          <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="mt-4 text-sm text-mute">Chargement de MEDGAME…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        <Link
          to="/app"
          className="inline-flex items-center gap-2 text-[12px] font-medium text-mute transition hover:text-accent"
        >
          <ArrowLeft size={14} /> Mon espace
        </Link>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-5">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              <Gamepad2 size={12} /> MEDGAME
            </span>
            <h1 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-[-0.035em] text-ink">
              Choisis tes chapitres. Franchis les niveaux.
            </h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-mute">
              Sélectionne une UE et au moins un chapitre. Les questions sont tirées au hasard et
              regroupées en niveaux de 5. Il faut 5/5 pour passer au niveau suivant.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface px-4 py-3 text-[12px] text-mute">
            <span className="flex items-center gap-2">
              <Clock3 size={14} className="text-accent" /> Quota partagé
            </span>
            <span className="mt-1 block font-medium text-ink">
              {overview?.quota.remaining ?? 0} série
              {(overview?.quota.remaining ?? 0) > 1 ? 's' : ''} restante
              {(overview?.quota.remaining ?? 0) > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-sale/25 bg-sale/5 px-4 py-3 text-[13px] text-sale">
            {error}
          </div>
        )}

        {activeRun && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-accent/25 bg-accent-soft/50 p-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-accent">Partie en cours</p>
              <p className="mt-1 text-[15px] font-medium text-ink">
                Niveau {activeRun.currentLevel}
                {activeProgress ? ` / ${activeProgress.levelCount}` : ''}
              </p>
              <p className="mt-1 text-[12px] text-mute">
                Reprends ta partie pour ne pas perdre ta progression.
              </p>
            </div>
            <Link to="/app/medgame/run" className={buttonClasses('primary', 'md')}>
              Reprendre <ArrowRight size={15} />
            </Link>
          </div>
        )}

        {activeProgress && !activeRun && (
          <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-mute">Parcours en cours</p>
                <p className="mt-1 text-[15px] font-medium text-ink">
                  Niveau {activeProgress.currentLevel} / {activeProgress.levelCount} ·{' '}
                  {activeProgress.chapterIds.length} chapitre
                  {activeProgress.chapterIds.length > 1 ? 's' : ''}
                </p>
                <p className="mt-1 text-[12px] text-mute">
                  {activeProgress.questionIds.length} question
                  {activeProgress.questionIds.length > 1 ? 's' : ''} dans la banque.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void start()} loading={starting}>
                  Reprendre le parcours <ArrowRight size={15} />
                </Button>
                <Button variant="secondary" onClick={() => setConfirmChange(true)}>
                  <RefreshCw size={14} /> Changer
                </Button>
              </div>
            </div>
          </div>
        )}

        {!activeProgress && (
          <>
            {!activeUeId ? (
              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {selection.map(({ theme, chapters }) => {
                  const available = chapters.filter((chapter) => chapter.available).length
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        setActiveUeId(theme.id)
                        setSelected([])
                      }}
                      className="group flex min-h-[150px] flex-col justify-between rounded-2xl border border-line bg-surface p-5 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-soft"
                    >
                      <div>
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
                          <ListChecks size={18} />
                        </span>
                        <h2 className="mt-3 text-[14px] font-medium leading-snug text-ink">
                          {theme.title}
                        </h2>
                      </div>
                      <p className="mt-3 text-[11px] text-mute">
                        {available} chapitre{available > 1 ? 's' : ''} disponible
                        {available > 1 ? 's' : ''}
                      </p>
                    </button>
                  )
                })}
              </div>
            ) : (
              <section className="mt-7 rounded-2xl border border-line bg-surface">
                <button
                  type="button"
                  onClick={() => {
                    setActiveUeId(null)
                    setSelected([])
                  }}
                  className="inline-flex items-center gap-2 px-5 pt-5 text-[12px] font-medium text-mute transition hover:text-accent sm:px-6"
                >
                  <ArrowLeft size={14} /> Toutes les UE
                </button>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                    <ListChecks size={16} className="text-accent" />
                    {activeTheme?.title}
                  </div>
                  <p className="text-[12px] text-mute">
                    {selected.length} chapitre{selected.length > 1 ? 's' : ''} sélectionné
                    {selected.length > 1 ? 's' : ''} · {activeAvailableCount} disponible
                    {activeAvailableCount > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="divide-y divide-line">
                  {activeChapters.map((chapter) => {
                    const chosen = selected.includes(chapter.id)
                    return (
                      <button
                        key={chapter.id}
                        type="button"
                        disabled={!chapter.available}
                        onClick={() => toggleChapter(chapter.id)}
                        aria-pressed={chosen}
                        className={cn(
                          'flex w-full items-center gap-4 px-5 py-4 text-left transition sm:px-6',
                          chosen ? 'bg-accent-soft/60' : 'hover:bg-cloud/50',
                          !chapter.available && 'cursor-not-allowed opacity-55',
                        )}
                      >
                        <span
                          className={cn(
                            'grid h-5 w-5 shrink-0 place-items-center rounded border transition',
                            chosen
                              ? 'border-accent bg-accent text-white'
                              : chapter.available
                                ? 'border-line bg-surface text-transparent'
                                : 'border-line bg-cloud text-mute',
                          )}
                        >
                          {chosen ? (
                            <Check size={13} strokeWidth={3} />
                          ) : chapter.available ? (
                            <Check size={13} strokeWidth={3} />
                          ) : (
                            <LockKeyhole size={11} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium text-ink">
                            {chapter.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-mute">
                            {chapter.available
                              ? `${chapter.count} question${chapter.count > 1 ? 's' : ''}${
                                  chapter.count < 5 ? ' · moins de 5 questions' : ''
                                }`
                              : 'Sujet et correction en préparation'}
                          </span>
                        </span>
                        {chosen && (
                          <span className="shrink-0 rounded-full bg-accent-soft px-2 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-accent">
                            Choisi
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-6">
                  <p className="text-[12px] text-mute">
                    {selected.length === 0
                      ? 'Sélectionne au moins un chapitre.'
                      : `${selected.length} chapitre${selected.length > 1 ? 's' : ''} · ${selected.reduce(
                          (total, chapterId) =>
                            total +
                            (activeChapters.find((chapter) => chapter.id === chapterId)?.count ?? 0),
                          0,
                        )} questions`}
                  </p>
                  <Button
                    onClick={() => void start()}
                    disabled={selected.length === 0}
                    loading={starting}
                  >
                    Lancer MEDGAME <ArrowRight size={15} />
                  </Button>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <Modal
        open={confirmChange}
        onClose={() => setConfirmChange(false)}
        title="Changer de parcours ?"
        eyebrow="MEDGAME"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmChange(false)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={() => void changeParcours()} loading={starting}>
              Changer et relancer
            </Button>
          </div>
        }
      >
        <p className="text-[13px] leading-relaxed text-mute">
          Changer de chapitres crée un nouveau parcours et remet la progression à zéro. La partie
          en cours sera archivée.
        </p>
      </Modal>
    </div>
  )
}
