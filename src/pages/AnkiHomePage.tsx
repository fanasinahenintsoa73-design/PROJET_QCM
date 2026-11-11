import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  ListChecks,
  LockKeyhole,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { getUsableQuestions } from '@/lib/db'
import { chaptersForTheme, chapterTitle, PACE_THEMES } from '@/lib/themes'
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
        chapters: chaptersForTheme(theme.id).map((chapter) => {
          const count = questionCount(chapter.id, db)
          return { ...chapter, count, available: count > 0 }
        }),
      })),
    [db],
  )

  const selectedIds = useMemo(
    () => new Set(selectedChapters.map((chapter) => chapter.chapterId)),
    [selectedChapters],
  )
  const activeTheme = PACE_THEMES.find((theme) => theme.id === activeUeId) ?? null
  const activeChapters = selection.find((entry) => entry.theme.id === activeUeId)?.chapters ?? []
  const activeAvailableCount = activeChapters.filter((chapter) => chapter.available).length
  const full = selectedChapters.length >= 5

  async function addChapter(chapterId: string) {
    if (saving || selectedIds.has(chapterId) || full) return
    const chapter = selection
      .flatMap((entry) => entry.chapters)
      .find((item) => item.id === chapterId)
    if (!chapter?.available) return
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
          <div>
            <div className="min-w-0">
              <h2 className="font-display text-[22px] tracking-[-0.02em] text-ink">
                Comment ça marche
              </h2>
              <p className="mt-1 text-[12px] text-mute">
                5 questions à la fois : assez court pour tenir entre deux cours, assez répété pour
                que ça rentre.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-cloud/70 p-3">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-semibold text-white">
                    1
                  </span>
                  <p className="mt-2 text-[12px] font-semibold text-ink">Choisis</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-mute">
                    Un chapitre, dans l’UE que tu veux. 5 chapitres maximum au total.
                  </p>
                </div>
                <div className="rounded-xl bg-cloud/70 p-3">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-semibold text-white">
                    2
                  </span>
                  <p className="mt-2 text-[12px] font-semibold text-ink">Réponds</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-mute">
                    5 questions tirées au hasard. Tu réponds, ou tu affiches la réponse si tu
                    bloques.
                  </p>
                </div>
                <div className="rounded-xl bg-cloud/70 p-3">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-semibold text-white">
                    3
                  </span>
                  <p className="mt-2 text-[12px] font-semibold text-ink">Mémorise</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-mute">
                    Juste : la question est acquise, elle ne revient plus. Ratée : elle reste{' '}
                    <strong className="font-medium text-ink">En cours</strong> et revient en tête de
                    la série suivante. Tu ne peux pas la perdre.
                  </p>
                </div>
                <div className="rounded-xl bg-cloud/70 p-3">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-semibold text-white">
                    4
                  </span>
                  <p className="mt-2 text-[12px] font-semibold text-ink">Décide</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-mute">
                    Après une question ratée :{' '}
                    <strong className="font-medium text-ink">Suivant</strong> (elle revient) ou{' '}
                    <strong className="font-medium text-ink">Ignorer</strong> (elle part dans « À
                    réviser »).
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-ink">Suivant</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-mute">
                    Elle reste <strong className="font-medium text-ink">En cours</strong> et revient
                    en tête de la prochaine série de 5, avant les questions nouvelles. Chaque
                    passage la fait rentrer un peu plus — et tu la retrouves aussi dans le bloc{' '}
                    <strong className="font-medium text-ink">Réviser</strong>.
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-ink">Ignorer</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-mute">
                    Elle passe <strong className="font-medium text-ink">À réviser</strong> : elle
                    sort de ce QCM, mais tu la retrouves dans le bloc{' '}
                    <strong className="font-medium text-ink">Réviser</strong>, quand tu veux.
                  </p>
                </div>
              </div>

              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                Les 3 états d’une question
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-ink">Nouvelle</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-mute">
                    Jamais vue. Elle peut sortir dans ta prochaine série.
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-ink">En cours</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-mute">
                    Ratée. Elle revient en tête de la série suivante, et tu peux la retravailler
                    dans le bloc <strong className="font-medium text-ink">Réviser</strong>.
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-ink">À réviser</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-mute">
                    Pas encore maîtrisée : ratée ou ignorée. Le bloc{' '}
                    <strong className="font-medium text-ink">Réviser</strong> de ton tableau Anki
                    te la sert en QCM.
                  </p>
                </div>
              </div>

              <p className="mt-3 border-l-2 border-line pl-3 text-[11px] leading-relaxed text-mute">
                Exemple : tu rates la Q3.{' '}
                <strong className="font-medium text-ink">Suivant</strong> → elle revient en tête de
                la série suivante.{' '}
                <strong className="font-medium text-ink">Ignorer</strong> → elle sort du QCM, mais
                reste à réviser dans le bloc Réviser.
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-mute">
                Chaque bonne réponse fait monter ton{' '}
                <strong className="font-medium text-ink">niveau</strong> de 1 — et il ne descend
                jamais. Quand toutes les questions sont maîtrisées ou ignorées, le chapitre est
                terminé : bravo. Tu peux le refaire pendant tout le mois de ton ticket.
              </p>

              <div className="mt-3 rounded-xl border border-accent/20 bg-accent-soft/50 px-3 py-2.5 text-[11px] leading-relaxed text-ink">
                <p>
                  <strong className="font-medium">Résultat :</strong> aucune question ne se perd, et
                  une question acquise ne revient plus dans le QCM.
                </p>
                <p className="mt-1 text-mute">
                  Les questions à réviser te sont servies <strong className="font-medium">en QCM</strong>{' '}
                  : tu y réponds, ce n’est pas une liste à lire.
                </p>
                <p className="mt-1 text-mute">
                  Astuce : si tu bloques, affiche la réponse plutôt que d’ignorer — elle reviendra,
                  et tu la maîtriseras.
                </p>
              </div>
            </div>
          </div>
        </section>

        {selectedChapters.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent-soft/40 px-4 py-3">
            <p className="text-[13px] text-ink">
              <strong>{selectedChapters.length} / 5</strong> chapitre
              {selectedChapters.length > 1 ? 's' : ''} choisi
              {selectedChapters.length > 1 ? 's' : ''}
              {full ? ' · maximum atteint' : ''}
            </p>
            <Link to="/app" className={buttonClasses('primary', 'sm')}>
              Voir mon tableau Anki <ArrowRight size={15} />
            </Link>
          </div>
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
                {activeAvailableCount} chapitre{activeAvailableCount > 1 ? 's' : ''} disponible
                {activeAvailableCount > 1 ? 's' : ''} sur {activeChapters.length}
              </p>
            </div>

            {full && (
              <div className="border-b border-line bg-accent-soft/40 px-5 py-3 text-[12px] text-ink sm:px-6">
                5 chapitres maximum atteints. Ouvre ton tableau Anki pour commencer.
              </div>
            )}

            <div className="divide-y divide-line">
              {activeChapters.map((chapter) => {
                const chosen = selectedIds.has(chapter.id)
                const disabled = chosen || !chapter.available || full || saving
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
                      disabled && !chosen && 'cursor-not-allowed opacity-55',
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
                      <span className="block text-[14px] font-medium text-ink">{chapter.title}</span>
                      <span className="mt-0.5 block text-[11px] text-mute">
                        {chapter.available
                          ? `${chapter.count} question${chapter.count > 1 ? 's' : ''} Anki${
                              chapter.count < 5 ? ' · moins de 5 questions' : ''
                            }`
                          : 'Sujet et correction en préparation'}
                      </span>
                    </span>
                    {chosen ? (
                      <span className="shrink-0 rounded-full bg-accent-soft px-2 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-accent">
                        Choisi
                      </span>
                    ) : chapter.available ? (
                      <span className="shrink-0 text-[11px] font-medium text-accent">
                        {full ? '5/5' : 'Choisir'}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-cloud px-2 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-mute">
                        Bientôt
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {activeAvailableCount === 0 && (
              <div className="px-5 py-7 text-center sm:px-6">
                <p className="text-[13px] font-medium text-ink">
                  Aucun chapitre publié pour cette UE pour le moment.
                </p>
                <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-mute">
                  Les chapitres apparaîtront ici dès que le sujet et sa correction seront
                  disponibles.
                </p>
              </div>
            )}
          </section>
        ) : (
          <section className="mt-8">
            <div className="flex items-end justify-between gap-3 border-b border-line pb-4">
              <div>
                <h2 className="font-display text-[1.6rem] leading-none text-ink">
                  Unités d’enseignement
                </h2>
                <p className="mt-2 text-[12px] text-mute">
                  Choisis une UE, puis un chapitre. Un par un, jusqu’à 5 au total.
                </p>
              </div>
              <p className="text-[11px] text-mute">
                {selectedChapters.length} / 5 choisi
                {selectedChapters.length > 1 ? 's' : ''}
              </p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {selection.map(({ theme, chapters }) => {
                const availableCount = chapters.filter((chapter) => chapter.available).length
                const chosenInTheme = chapters.filter((chapter) => selectedIds.has(chapter.id)).length
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setActiveUeId(theme.id)}
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
                      {chosenInTheme > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-accent">
                            {chosenInTheme} choisi{chosenInTheme > 1 ? 's' : ''}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[11px]">
                      <span className="font-medium text-ink">
                        {availableCount > 0 ? 'Choisir un chapitre' : 'Voir les chapitres'}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-accent">
                        Ouvrir <ArrowRight size={13} />
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
