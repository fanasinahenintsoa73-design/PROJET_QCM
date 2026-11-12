import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { usePageTitle } from '@/components/Layouts'
import { chapterTitle, findThemeForChapter } from '@/lib/themes'
import { LevelGrid } from '@/components/anki/LevelGrid'
import type { AnkiLevel } from '@/types'

/** La carte des niveaux d'un chapitre : la trajectoire, chaque cadre est cliquable. */
export default function AnkiLevelMapPage() {
  const { chapterId = '' } = useParams()
  const navigate = useNavigate()
  const theme = findThemeForChapter(chapterId)
  usePageTitle(`${chapterTitle(chapterId)} — MEDGAME — MEDQCM mada`)

  const [levels, setLevels] = useState<AnkiLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setLevels(await api.getAnkiLevels(chapterId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les niveaux.')
    } finally {
      setLoading(false)
    }
  }, [chapterId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-12">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-mute hover:text-accent"
        >
          <ArrowLeft size={14} /> Mon jeu
        </Link>

        <div className="mt-5 flex items-start justify-between gap-4">
          <h1 className="font-display text-[24px] tracking-[-0.02em] text-ink">
            {chapterTitle(chapterId)}
          </h1>
          <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent">
            {theme?.title.split('—')[0].trim() ?? 'UE'}
          </span>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-sale/25 bg-sale/5 px-4 py-3 text-[13px] text-sale">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-5 rounded-2xl border border-line bg-surface p-8 text-center text-[13px] text-mute">
            Chargement des niveaux…
          </div>
        ) : levels.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="text-[13px] text-mute">Ce chapitre n’a pas encore de questions.</p>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-line bg-surface p-5 sm:p-7">
            <div className="rounded-xl bg-canvas p-3 sm:p-4">
              <LevelGrid
                levels={levels}
                onSelect={(level) => {
                  navigate(`/app/medgame/${chapterId}/niveau/${level}`)
                }}
              />
            </div>
            <p className="mt-5 text-[12px] leading-relaxed text-mute">
              5 bonnes réponses ouvrent le cadre suivant. Un cadre réussi se rejoue quand tu
              veux : c’est ta révision.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
