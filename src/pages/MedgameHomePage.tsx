import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useMedgameKeepAlive } from '@/lib/useMedgameKeepAlive'
import { getUsableQuestions } from '@/lib/db'
import { chaptersForTheme, PACE_THEMES, themeNumber, themeTitle } from '@/lib/themes'
import { findChapterSubjects } from '@/lib/subjects'
import { usePageTitle } from '@/components/Layouts'
import { buttonClasses } from '@/components/ui/Button'
import type { MedgameBoard, MedgameOverview } from '@/types'

/**
 * Accueil MEDGAME : les unités d'enseignement, les planches déjà ouvertes et
 * le quota partagé. La planche de niveaux se reached ensuite, une fois le
 * parcours choisi.
 */
export default function MedgameHomePage() {
  usePageTitle('MEDGAME — MEDQCM mada')
  const navigate = useNavigate()
  const { db } = useAuth()
  const [overview, setOverview] = useState<MedgameOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resumingId, setResumingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setOverview(await api.getMedgameOverview())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MEDGAME est indisponible pour le moment.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const themes = useMemo(
    () =>
      PACE_THEMES.map((theme) => {
        const chapters = chaptersForTheme(theme.id).map((chapter) => {
          const subjects = findChapterSubjects(chapter.id, db.subjects)
          const count = subjects.reduce(
            (total, subject) => total + getUsableQuestions(subject.id, db).length,
            0,
          )
          return { id: chapter.id, title: chapter.title, count }
        })
        return {
          theme,
          chapters,
          availableCount: chapters.filter((chapter) => chapter.count > 0).length,
        }
      }),
    [db],
  )

  const boards = overview?.boards ?? []
  const quota = overview?.quota ?? null
  // Tant que l'étudiant reste dans MEDGAME, ses parties restent jouables.
  const activeRunId =
    boards.find((board) => board.run?.status === 'in_progress')?.run?.id ?? null
  useMedgameKeepAlive(activeRunId)

  async function resume(board: MedgameBoard) {
    if (resumingId) return
    setResumingId(board.progress.id)
    setError('')
    try {
      if (!board.run) await api.startMedgameRun(board.progress.id)
      navigate('/app/medgame/parcours')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Le parcours n’a pas pu être repris.')
    } finally {
      setResumingId(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-content items-center justify-center px-5">
        <div className="text-center">
          <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="mt-4 text-sm text-mute">Chargement de la page d’accueil…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              MEDGAME
            </span>
            <h1 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-[-0.035em] text-ink">
              Réussis PACES, un niveau à la fois.
            </h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-mute">
              Choisis une UE puis les chapitres de ton parcours. Chaque niveau tire 5 questions au
              hasard dans tes chapitres, et il faut 5/5 pour ouvrir le suivant.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-line bg-surface px-4 py-3 text-[12px] text-mute">
              <span>Séries restantes</span>
              <span className="mt-1 block font-medium text-ink">
                {quota ? `${quota.remaining} / ${quota.limit}` : '—'}
              </span>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-sale/25 bg-sale/5 px-4 py-3 text-[13px] text-sale">
            {error}
          </div>
        ) : null}

        {boards.length > 0 ? (
          <section className="mt-8">
            <div className="flex items-end justify-between gap-3 border-b border-line pb-4">
              <div>
                <h2 className="font-display text-[1.6rem] leading-none text-ink">Tes planches</h2>
                <p className="mt-2 text-[12px] text-mute">
                  Une planche par UE choisie. Chaque niveau est tiré au hasard parmi tes chapitres.
                </p>
              </div>
              <Link
                to="/app/medgame/parcours"
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent"
              >
                Voir les planches <ArrowRight size={13} />
              </Link>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {boards.map((board) => {
                const progress = board.progress
                const number = themeNumber(progress.ueId)
                return (
                  <article
                    key={progress.id}
                    className="rounded-2xl border border-line bg-surface p-5 transition hover:border-accent/40"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-block rounded-md bg-accent-soft px-2 py-1 text-[12px] font-semibold uppercase leading-snug tracking-[0.04em] text-accent">
                        {number ? `UE${number}` : 'UE'}
                      </span>
                      <h3 className="font-display text-[1.2rem] leading-tight text-ink">
                        {themeTitle(progress.ueId)}
                      </h3>
                    </div>
                    <p className="mt-2 font-display text-[1.35rem] leading-tight text-ink">
                      Niveau {Math.min(progress.currentLevel, progress.levelCount)} /{' '}
                      {progress.levelCount}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-mute">
                      {progress.chapterIds.length} chapitre
                      {progress.chapterIds.length > 1 ? 's' : ''} ·{' '}
                      {progress.questionIds.length} questions dans la banque.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={resumingId === progress.id}
                        onClick={() => void resume(board)}
                        className={buttonClasses('primary', 'md')}
                      >
                        {resumingId === progress.id ? 'Ouverture…' : 'Reprendre le parcours'}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <div className="flex items-end justify-between gap-3 border-b border-line pb-4">
            <div>
              <h2 className="font-display text-[1.6rem] leading-none text-ink">
                Unités d’enseignement
              </h2>
              <p className="mt-2 text-[12px] text-mute">
                Choisis une UE, puis les chapitres qui composent ton parcours.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {themes.map(({ theme, chapters, availableCount }) => {
              const board = boards.find((item) => item.progress.ueId === theme.id)
              return (
                <Link
                  key={theme.id}
                  to={`/app/medgame/ue/${theme.id}`}
                  className="rounded-2xl border border-line bg-surface p-5 text-left transition hover:border-accent/60 hover:shadow-sm"
                >
                  <h3 className="mt-1 min-h-[3.2rem]">
                    <span className="inline-block rounded-md bg-accent-soft px-2 py-1 text-[12px] font-semibold uppercase leading-snug tracking-[0.04em] text-accent">
                      {theme.title}
                    </span>
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-mute">
                    {theme.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-mute">
                    <span>
                      {availableCount} chapitre{availableCount > 1 ? 's' : ''} disponible
                      {availableCount > 1 ? 's' : ''} sur {chapters.length}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[11px]">
                    <span className="font-medium text-ink">
                      {board
                        ? `Planche ouverte · ${board.progress.levelCount} niveau${board.progress.levelCount > 1 ? 'x' : ''}`
                        : availableCount > 0
                          ? 'Choisir des chapitres'
                          : 'Voir les chapitres'}
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-accent">
                      Ouvrir <ArrowRight size={13} />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </div>
      </div>
  )
}
