import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clock3, Plus, Trophy } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { chapterTitle, findThemeForChapter } from '@/lib/themes'
import { buttonClasses } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import { LevelGrid } from '@/components/anki/LevelGrid'
import type { AnkiChapterState, AnkiLevel } from '@/types'

function formatDay(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

/** Une carte de chapitre : ses niveaux cliquables, comme la carte des niveaux. */
function ChapterCard({
  chapter,
  levels,
  planche,
  onOpenLevel,
}: {
  chapter: AnkiChapterState
  levels: AnkiLevel[]
  planche: number
  onOpenLevel: (level: number) => void
}) {
  const theme = findThemeForChapter(chapter.chapterId)

  return (
    <article className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[20px] tracking-[-0.02em] text-ink">
            <Link to={`/app/medgame/${chapter.chapterId}`} className="hover:underline">
              {chapterTitle(chapter.chapterId)}
            </Link>
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent">
          {theme?.title.split('—')[0].trim() ?? 'UE'}
        </span>
      </div>

      <LevelGrid
        levels={levels}
        onSelect={onOpenLevel}
        chapterTitle={chapterTitle(chapter.chapterId)}
        planche={planche}
      />

      <p className="mt-5 text-[12px] leading-relaxed text-mute">
        Réponds correctement aux 5 QCM pour accéder au niveau supérieur !
      </p>
    </article>
  )
}

export default function AnkiDashboard() {
  usePageTitle('Mon jeu — MEDGAME — MEDQCM mada')
  const { ticketExpiresAt } = useAuth()
  const navigate = useNavigate()
  const [chapters, setChapters] = useState<AnkiChapterState[]>([])
  const [levels, setLevels] = useState<Record<string, AnkiLevel[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const next = await api.getAnkiChapters()
        if (!active) return
        setChapters(next)
        const entries = await Promise.all(
          next.map(async (chapter) => {
            const items = await api.getAnkiLevels(chapter.chapterId).catch(() => [])
            return [chapter.chapterId, items] as const
          }),
        )
        if (!active) return
        setLevels(Object.fromEntries(entries))
      } catch {
        if (active) setError('Impossible de charger ton jeu.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const stats = useMemo(() => {
    const totalLevels = chapters.reduce((total, chapter) => total + chapter.totalLevels, 0)
    const passedLevels = chapters.reduce((total, chapter) => total + chapter.levelsPassed, 0)
    const stars = chapters.reduce((total, chapter) => total + chapter.stars, 0)
    return { totalLevels, passedLevels, stars }
  }, [chapters])

  if (loading) {
    return (
      <div className="bg-canvas">
        <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
          <p className="text-[13px] text-mute">Chargement de ton jeu…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">MEDGAME</p>
            <h1 className="mt-1 font-display text-[24px] tracking-[-0.02em] text-ink">Mon jeu</h1>
          </div>
          <Link to="/app/medgame/choisir" className={buttonClasses('secondary', 'sm')}>
            <Plus size={14} /> Ajouter un chapitre
          </Link>
        </div>

        {ticketExpiresAt ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-mute">
            <Clock3 size={13} /> Ticket valable jusqu’au {formatDay(ticketExpiresAt)}
          </p>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-sale/25 bg-sale/5 px-4 py-3 text-[13px] text-sale">
            {error}
          </div>
        ) : null}

        {chapters.length > 0 ? (
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-line bg-surface px-3 py-3 text-center">
              <p className="font-display text-[22px] leading-none text-ink">
                {stats.passedLevels}
                <span className="text-[12px] text-mute">/{stats.totalLevels}</span>
              </p>
              <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">
                Niveaux
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface px-3 py-3 text-center">
              <p className="font-display text-[22px] leading-none text-ink">{stats.stars}</p>
              <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">
                Étoiles
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface px-3 py-3 text-center">
              <p className="font-display text-[22px] leading-none text-ink">{chapters.length}</p>
              <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">
                Chapitres
              </p>
            </div>
          </div>
        ) : null}

        {chapters.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-6 text-center">
            <Trophy size={20} className="mx-auto text-mute" />
            <p className="mt-3 text-[14px] font-medium text-ink">Aucun chapitre pour l’instant.</p>
            <p className="mx-auto mt-1.5 max-w-sm text-[12px] leading-relaxed text-mute">
              Choisis un chapitre pour commencer : chaque chapitre se découpe en niveaux de 5
              questions.
            </p>
            <div className="mt-4 flex justify-center">
              <Link to="/app/medgame/choisir" className={buttonClasses('primary', 'sm')}>
                Choisir un chapitre
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {chapters.map((chapter, index) => (
              <ChapterCard
                key={chapter.chapterId}
                chapter={chapter}
                levels={levels[chapter.chapterId] ?? []}
                planche={index + 1}
                onOpenLevel={(level) =>
                  navigate(`/app/medgame/${chapter.chapterId}/niveau/${level}`)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
