import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Clock3, ListChecks, LockKeyhole } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { getUsableQuestions } from '@/lib/db'
import { chaptersForTheme, chapterTitle, findThemeForChapter, PACE_THEMES } from '@/lib/themes'
import { buttonClasses } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import { cn } from '@/lib/utils'
import type { AnkiChapterState, Database } from '@/types'

function questionCount(chapterId: string, db: Database): number {
  return db.subjects
    .filter((subject) => !subject.archived && subject.chapterId === chapterId)
    .reduce((total, subject) => {
      const usable = getUsableQuestions(subject.id, db).length
      return total + (usable > 0 ? usable : (subject.questionCount ?? 0))
    }, 0)
}

export default function AnkiHomePage() {
  usePageTitle('Page d’accueil — Anki — MEDQCM mada')
  const { db, ticketExpiresAt } = useAuth()
  const [selectedChapters, setSelectedChapters] = useState<AnkiChapterState[]>([])
  const [activeUeId, setActiveUeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      setSelectedChapters(await api.getAnkiChapters())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger ta sélection Anki.')
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
        chapters: chaptersForTheme(theme.id)
          .map((chapter) => ({ ...chapter, count: questionCount(chapter.id, db) }))
          .filter((chapter) => chapter.count > 0),
      })).filter((entry) => entry.chapters.length > 0),
    [db],
  )

  const selectedIds = useMemo(
    () => new Set(selectedChapters.map((chapter) => chapter.chapterId)),
    [selectedChapters],
  )
  const activeTheme = PACE_THEMES.find((theme) => theme.id === activeUeId) ?? null
  const activeChapters =
    selection.find((entry) => entry.theme.id === activeUeId)?.chapters ?? []

  async function addChapter(chapterId: string) {
    if (saving || selectedIds.has(chapterId) || selectedChapters.length >= 5) return
    setSaving(true)
    try {
      await api.addAnkiChapter(chapterId)
      await load()
      setActiveUeId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Le chapitre n’a pas pu être ajouté.')
    } finally {
      setSaving(false)
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
              Page d’accueil Anki
            </span>
            <h1 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-[-0.035em] text-ink">
              Réussis PACES, un chapitre à la fois.
            </h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-mute">
              Choisis tes chapitres un par un, réponds aux questions, monte de niveau à chaque
              bonne réponse et revois tes erreurs jusqu’à les maîtriser.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface px-4 py-3 text-[12px] text-mute">
            <span className="flex items-center gap-2">
              <Clock3 size={14} className="text-accent" />
              Ticket valable jusqu’au
            </span>
            <span className="mt-1 block font-medium text-ink">
              {ticketExpiresAt
                ? new Date(ticketExpiresAt).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })
                : '—'}
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-sale/25 bg-sale/5 px-4 py-3 text-[13px] text-sale">
            {error}
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
              <LockKeyhole size={18} />
            </span>
            <div>
              <h2 className="font-display text-[22px] tracking-[-0.02em] text-ink">
                Comment ça marche
              </h2>
              <div className="mt-3 grid gap-2 text-[13px] leading-relaxed text-mute sm:grid-cols-2">
                <p>1) Choisis un chapitre, un par un, dans une UE. Tu peux en choisir jusqu’à 5 au total.</p>
                <p>2) Réponds au QCM ou affiche le résultat.</p>
                <p>3) Juste → maîtrisée, niveau +1. Faux → Suivant pour la revoir, Ignorer pour la retirer du parcours.</p>
                <p>4) À la fin du chapitre : Félicitations, vous avez terminé le chapitre. Tu peux le refaire pendant le mois du ticket.</p>
              </div>
            </div>
          </div>
        </section>

        {selectedChapters.length > 0 && (
          <section className="mt-5 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Tes chapitres choisis</p>
                <p className="mt-1 font-display text-[26px] leading-none text-ink">
                  {selectedChapters.length} / 5
                </p>
              </div>
              <Link to="/app" className={buttonClasses('primary')}>
                Voir mon tableau Anki <ArrowRight size={16} />
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedChapters.map((chapter) => (
                <span
                  key={chapter.chapterId}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[12px] font-medium text-accent"
                >
                  <Check size={13} /> {chapterTitle(chapter.chapterId)}
                </span>
              ))}
            </div>
            {selectedChapters.length >= 5 && (
              <p className="mt-3 text-[12px] text-mute">
                5 chapitres maximum atteints. Tu peux ouvrir ton tableau Anki.
              </p>
            )}
          </section>
        )}

        {activeUeId && activeTheme ? (
          <section className="mt-8 rounded-2xl border border-line bg-surface">
            <button
              type="button"
              onClick={() => setActiveUeId(null)}
              className="inline-flex items-center gap-2 px-5 pt-5 text-[12px] font-medium text-mute transition hover:text-accent sm:px-6"
            >
              <ArrowLeft size={14} /> Toutes les UE
            </button>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                <ListChecks size={16} className="text-accent" />
                {activeTheme.title}
              </div>
              <p className="text-[12px] text-mute">
                {activeChapters.length} chapitre{activeChapters.length > 1 ? 's' : ''} disponible
                {activeChapters.length > 1 ? 's' : ''}
              </p>
            </div>
            <div className="divide-y divide-line">
              {activeChapters.map((chapter) => {
                const chosen = selectedIds.has(chapter.id)
                const disabled = chosen || selectedChapters.length >= 5 || saving
                return (
                  <button
                    key={chapter.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => void addChapter(chapter.id)}
                    aria-pressed={chosen}
                    className={cn(
                      'flex w-full items-center gap-4 px-5 py-4 text-left transition sm:px-6',
                      chosen ? 'bg-accent-soft/60' : 'hover:bg-cloud/50',
                      disabled && !chosen && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-5 w-5 shrink-0 place-items-center rounded border transition',
                        chosen
                          ? 'border-accent bg-accent text-white'
                          : 'border-line bg-surface text-transparent',
                      )}
                    >
                      <Check size={13} strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-ink">{chapter.title}</span>
                      <span className="mt-0.5 block text-[11px] text-mute">
                        {chapter.count} question{chapter.count > 1 ? 's' : ''} Anki
                      </span>
                    </span>
                    {chosen ? (
                      <span className="shrink-0 rounded-full bg-accent-soft px-2 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-accent">
                        Choisi
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </section>
        ) : (
          <section className="mt-8">
            <div className="flex items-end justify-between gap-3 border-b border-line pb-4">
              <div>
                <h2 className="font-display text-[1.6rem] leading-none text-ink">Unités d’enseignement</h2>
                <p className="mt-2 text-[12px] text-mute">
                  Choisis une UE, puis un chapitre. Tu peux en choisir un par un, jusqu’à 5 au total.
                </p>
              </div>
              <p className="text-[11px] text-mute">{selectedChapters.length} / 5 choisi{selectedChapters.length > 1 ? 's' : ''}</p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {PACE_THEMES.map((theme) => {
                const themeChapters =
                  selection.find((entry) => entry.theme.id === theme.id)?.chapters ?? []
                const chosenInTheme = themeChapters.filter((chapter) => selectedIds.has(chapter.id)).length
                const available = themeChapters.length > 0
                return (
                  <button
                    key={theme.id}
                    type="button"
                    disabled={!available}
                    onClick={() => setActiveUeId(theme.id)}
                    className={cn(
                      'rounded-2xl border border-line bg-surface p-5 text-left transition',
                      available
                        ? 'hover:border-accent/60 hover:shadow-sm'
                        : 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {available ? null : (
                      <span className="inline-block rounded-full bg-cloud px-2.5 py-1 text-[10px] font-medium text-mute">
                        Bientôt disponible
                      </span>
                    )}
                    <h3 className="mt-4 min-h-[3.2rem]">
                      <span className="inline-block rounded-md bg-accent-soft px-2 py-1 text-[12px] font-semibold uppercase leading-snug tracking-[0.04em] text-accent">
                        {theme.title}
                      </span>
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-mute">
                      {theme.description}
                    </p>
                    <div className="mt-4 flex gap-2 text-[10px] text-mute">
                      <span>
                        {themeChapters.length} chapitre{themeChapters.length > 1 ? 's' : ''}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Niveau +1 par bonne réponse</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[11px]">
                      <span className="font-medium text-ink">
                        {chosenInTheme > 0
                          ? `${chosenInTheme} chapitre${chosenInTheme > 1 ? 's' : ''} choisi${chosenInTheme > 1 ? 's' : ''}`
                          : available
                            ? 'Choisir un chapitre'
                            : 'Indisponible'}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-accent">
                        {available ? 'Ouvrir' : ''}
                        {available ? <ArrowRight size={13} /> : null}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
