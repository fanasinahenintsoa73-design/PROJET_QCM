import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useMedgameKeepAlive } from '@/lib/useMedgameKeepAlive'
import { getUsableQuestions } from '@/lib/db'
import { chaptersForTheme, PACE_THEMES } from '@/lib/themes'
import { findChapterSubjects } from '@/lib/subjects'
import { usePageTitle } from '@/components/Layouts'
import { buttonClasses } from '@/components/ui/Button'
import type { MedgameOverview } from '@/types'

/**
 * Accueil MEDGAME : le jeu, les unités d'enseignement et le quota partagé.
 */
export default function MedgameHomePage() {
  usePageTitle('MEDGAME — MEDQCM mada')
  const { db } = useAuth()
  const [overview, setOverview] = useState<MedgameOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        <Link
          to="/app"
          aria-label="Retour au tableau de bord"
          className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-mute transition hover:text-accent"
        >
          <ArrowLeft size={16} /> Retour au tableau de bord
        </Link>
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

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
            <div>
              <h2 className="font-display text-[1.6rem] leading-none text-ink">Mon jeu</h2>
              <p className="mt-2 text-[12px] text-mute">
                Reprends ton parcours, niveau après niveau, jusqu’à la réussite.
              </p>
            </div>
            <Link
              to="/app/medgame/parcours"
              className={buttonClasses('primary', 'md', 'inline-flex items-center gap-1.5')}
            >
              Voir mon jeu <ArrowRight size={15} />
            </Link>
          </div>
        </section>

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
                        ? `Jeu ouvert · ${board.progress.levelCount} niveau${board.progress.levelCount > 1 ? 'x' : ''}`
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
