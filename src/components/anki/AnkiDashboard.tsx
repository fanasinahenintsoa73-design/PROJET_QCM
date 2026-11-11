import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock3,
  History,
  Plus,
  Search,
  Trophy,
  X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { chapterTitle, findThemeForChapter } from '@/lib/themes'
import { buttonClasses } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import { cn } from '@/lib/utils'
import type { AnkiChapterState, AnkiReviewCard } from '@/types'

function formatDay(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function statusLabel(status: AnkiReviewCard['status']): string {
  if (status === 'correct') return 'Juste'
  if (status === 'wrong') return 'Faux'
  if (status === 'revealed') return 'Réponse affichée'
  return 'Sans réponse'
}

type CardBucket = 'all' | 'review'

/**
 * « À réviser » = une question déjà réussie : le bloc Réviser te la repose en QCM.
 * Les autres restent dans le bloc de 5 du chapitre.
 */
function isReviewCard(card: AnkiReviewCard): boolean {
  return card.state === 'review'
}

const HISTORY_FILTERS: { value: CardBucket; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'review', label: 'À réviser' },
]

/** Le texte de la bonne réponse, à partir des propositions de la question. */
function cardAnswer(card: AnkiReviewCard): string {
  const options = card.options as Record<string, string | undefined>
  const texts = card.correctAnswers
    .map((letter) => options[letter])
    .filter((text): text is string => Boolean(text))
  return texts.length > 0 ? texts.join(' · ') : card.correctAnswers.join(', ')
}

/** Un bloc par question : question, réponse et explication. */
function ReviewCardRow({ card }: { card: AnkiReviewCard }) {
  return (
    <article className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[9px] font-semibold',
            card.status === 'correct' && 'bg-success/10 text-success',
            card.status === 'wrong' && 'bg-sale/10 text-sale',
            card.status === 'revealed' && 'bg-accent-soft text-accent',
            card.status === 'skipped' && 'bg-cloud text-mute',
          )}
        >
          {statusLabel(card.status)}
        </span>
        <span className="ml-auto text-[10px] text-mute">
          Vue le {formatDay(card.lastSeenAt)}
        </span>
      </div>

      <div className="mt-3 space-y-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Question</p>
          <p className="mt-1 text-[14px] font-medium leading-snug text-ink">{card.statement}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Réponse</p>
          <p className="mt-1 text-[13px] font-medium leading-relaxed text-success">{cardAnswer(card)}</p>
        </div>
        {card.explanation ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
              Explication
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-mute">{card.explanation}</p>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export default function AnkiDashboard() {
  usePageTitle('Tableau Anki — MEDQCM mada')
  const { ticketExpiresAt } = useAuth()
  const navigate = useNavigate()
  const [chapters, setChapters] = useState<AnkiChapterState[]>([])
  const [reviewCards, setReviewCards] = useState<AnkiReviewCard[]>([])
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<'chapters' | 'history'>(
    searchParams.get('tab') === 'history' ? 'history' : 'chapters',
  )
  const [filter, setFilter] = useState<CardBucket>('all')
  const [openChapter, setOpenChapter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [nextChapters, nextCards] = await Promise.all([
        api.getAnkiChapters(),
        api.getAnkiReviewCards().catch(() => [] as AnkiReviewCard[]),
      ])
      setChapters(nextChapters)
      setReviewCards(nextCards)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger le mode Anki.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!loading && chapters.length === 0) {
      navigate('/app/anki/choisir', { replace: true })
    }
  }, [loading, chapters.length, navigate])

  const totalQuestions = chapters.reduce((total, chapter) => total + chapter.totalQuestions, 0)
  const answeredQuestions = chapters.reduce(
    (total, chapter) => total + chapter.answeredQuestions,
    0,
  )
  const completedChapters = chapters.filter((chapter) => chapter.completedAt).length
  const maxLevel = chapters.reduce((level, chapter) => Math.max(level, chapter.level), 1)

  const filteredCards = useMemo(() => {
    const term = search.trim().toLowerCase()
    return reviewCards.filter((card) => {
      if (filter === 'review' && !isReviewCard(card)) return false
      if (!term) return true
      return (
        card.statement.toLowerCase().includes(term) ||
        chapterTitle(card.chapterId).toLowerCase().includes(term)
      )
    })
  }, [reviewCards, search, filter])

  const historyCounts = useMemo(
    () => ({
      all: reviewCards.length,
      review: reviewCards.filter((card) => isReviewCard(card)).length,
    }),
    [reviewCards],
  )

  /** L'historique, regroupé par chapitre : un bloc par chapitre choisi. */
  const historyGroups = useMemo(() => {
    const byChapter = new Map<string, AnkiReviewCard[]>()
    for (const card of filteredCards) {
      const list = byChapter.get(card.chapterId) ?? []
      list.push(card)
      byChapter.set(card.chapterId, list)
    }
    return chapters.map((chapter) => ({
      chapterId: chapter.chapterId,
      title: chapterTitle(chapter.chapterId),
      cards: [...(byChapter.get(chapter.chapterId) ?? [])].sort((a, b) =>
        b.lastSeenAt.localeCompare(a.lastSeenAt),
      ),
    }))
  }, [filteredCards, chapters])

  useEffect(() => {
    if (tab !== 'history' || openChapter !== null) return
    const first = historyGroups.find((group) => group.cards.length > 0)
    if (first) setOpenChapter(first.chapterId)
  }, [tab, openChapter, historyGroups])

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-content items-center justify-center px-5">
        <div className="text-center">
          <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="mt-4 text-sm text-mute">Chargement du mode Anki…</p>
        </div>
      </div>
    )
  }

  if (chapters.length === 0) {
    return null
  }

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-[-0.035em] text-ink">
              BONJOUR PACES ; prêt à réviser avec Anki ?
            </h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-mute">
              Tes chapitres, ton historique et ta progression, au même endroit.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface px-4 py-3 text-[12px] text-mute">
            <span className="flex items-center gap-2">
              <Clock3 size={14} className="text-accent" />
              Ticket valable jusqu’au
            </span>
            <span className="mt-1 block font-medium text-ink">{formatDay(ticketExpiresAt)}</span>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-sale/25 bg-sale/5 px-4 py-3 text-[13px] text-sale">
            {error}
          </div>
        )}

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
            <p className="text-[11px] uppercase tracking-[0.1em] text-mute">Niveau max</p>
            <p className="mt-1 flex items-center gap-2 font-display text-[26px] leading-none text-ink">
              <Trophy size={18} className="text-accent" /> {maxLevel}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
            <p className="text-[11px] uppercase tracking-[0.1em] text-mute">Chapitres terminés</p>
            <p className="mt-1 font-display text-[26px] leading-none text-ink">
              {completedChapters} / {chapters.length}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
            <p className="text-[11px] uppercase tracking-[0.1em] text-mute">Questions vues</p>
            <p className="mt-1 font-display text-[26px] leading-none text-ink">
              {answeredQuestions} / {totalQuestions}
            </p>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-b border-line">
          <div className="flex gap-1" role="tablist" aria-label="Vues du tableau Anki">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'chapters'}
              onClick={() => setTab('chapters')}
              className={cn(
                'inline-flex items-center gap-1.5 border-b-2 px-3 py-3 text-[13px] font-medium transition',
                tab === 'chapters'
                  ? 'border-accent text-ink'
                  : 'border-transparent text-mute hover:text-ink',
              )}
            >
              Mes chapitres
              <span className="rounded-full bg-cloud px-1.5 py-0.5 text-[10px] text-mute">
                {chapters.length}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'history'}
              onClick={() => setTab('history')}
              className={cn(
                'inline-flex items-center gap-1.5 border-b-2 px-3 py-3 text-[13px] font-medium transition',
                tab === 'history'
                  ? 'border-accent text-ink'
                  : 'border-transparent text-mute hover:text-ink',
              )}
            >
              <History size={14} />
              Historique
              <span className="rounded-full bg-cloud px-1.5 py-0.5 text-[10px] text-mute">
                {reviewCards.length}
              </span>
            </button>
          </div>
          <div className="flex items-center gap-3 pb-2">
            <span className="text-[11px] text-mute">{chapters.length} / 5 chapitres</span>
            {chapters.length < 5 && (
              <Link to="/app/anki/choisir" className={buttonClasses('secondary', 'sm')}>
                <Plus size={14} /> Ajouter un chapitre
              </Link>
            )}
          </div>
        </div>

        {tab === 'chapters' ? (
          <section className="mt-5">
            <div className="grid gap-3 lg:grid-cols-2">
              {chapters.map((chapter) => {
                const theme = findThemeForChapter(chapter.chapterId)
                const percent =
                  chapter.totalQuestions > 0
                    ? Math.round((chapter.answeredQuestions / chapter.totalQuestions) * 100)
                    : 0
                const done = Boolean(chapter.completedAt)
                const available = chapter.totalQuestions > 0
                const cardClass = cn(
                  'group rounded-2xl border bg-surface p-5 transition',
                  available
                    ? 'border-line hover:border-accent/60 hover:shadow-sm'
                    : 'border-line/70 bg-cloud/30',
                  done && available && 'border-success/30',
                )
                const href = done
                  ? `/app/anki/${chapter.chapterId}?replay=1`
                  : `/app/anki/${chapter.chapterId}`
                const chapterLabel = `${done ? 'Refaire le chapitre' : 'Continuer le chapitre'} ${chapterTitle(chapter.chapterId)}`
                const header = (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                        {theme?.title ?? 'UE'}
                      </p>
                      <h3 className="mt-1 truncate font-display text-[18px] tracking-[-0.01em] text-ink">
                        {chapterTitle(chapter.chapterId)}
                      </h3>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]',
                        !available
                          ? 'bg-cloud text-mute'
                          : done
                            ? 'bg-success/10 text-success'
                            : 'bg-accent-soft text-accent',
                      )}
                    >
                      {!available
                        ? 'Indisponible'
                        : done
                          ? 'Terminé · Niveau conservé'
                          : `Niveau ${chapter.level}`}
                    </span>
                  </div>
                )

                const counters = (
                  <div className="mt-4 border-t border-line pt-4">
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        to={`/app/anki/${chapter.chapterId}`}
                        aria-label={`Commencer le chapitre : ${chapter.newQuestions} nouvelles questions`}
                        className="rounded-xl border border-line bg-surface px-2 py-3 text-center transition hover:border-accent/60 hover:shadow-sm"
                      >
                        <p className="font-display text-[22px] leading-none text-ink">
                          {chapter.newQuestions}
                        </p>
                        <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">
                          Nouvelles
                        </p>
                      </Link>
                      <Link
                        to={`/app/anki/${chapter.chapterId}/reviser`}
                        aria-label={`Réviser les ${chapter.reviewQuestions} questions réussies en QCM`}
                        className="rounded-xl border border-line bg-surface px-2 py-3 text-center transition hover:border-accent/60 hover:shadow-sm"
                      >
                        <p className="font-display text-[22px] leading-none text-success">
                          {chapter.reviewQuestions}
                        </p>
                        <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">
                          À réviser
                        </p>
                      </Link>
                    </div>
                  </div>
                )

                const footer = (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] text-mute">
                      <span>
                        {chapter.answeredQuestions} / {chapter.totalQuestions} questions vues
                      </span>
                      <span>{percent}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cloud">
                      <div
                        className={cn('h-full rounded-full', done ? 'bg-success' : 'bg-accent')}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                  </div>
                )

                const actions = (
                  <div className="mt-4 flex flex-col gap-2">
                    <Link
                      to={href}
                      className={cn(
                        'flex h-12 w-full items-center gap-2 rounded-xl border bg-surface px-4 text-[14px] font-medium transition',
                        available
                          ? 'border-line text-ink hover:border-accent/60'
                          : 'pointer-events-none border-line/70 text-mute opacity-70',
                      )}
                    >
                      {!available
                        ? 'Contenu indisponible'
                        : done
                          ? 'Refaire le chapitre'
                          : 'Continuer le chapitre'}
                      {available ? <ArrowRight size={16} className="text-accent" /> : null}
                    </Link>
                    {available && chapter.reviewQuestions > 0 ? (
                      <Link
                        to={`/app/anki/${chapter.chapterId}/reviser`}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-4 text-[13px] font-medium text-accent transition hover:border-accent/60"
                      >
                        Réviser ({chapter.reviewQuestions})
                      </Link>
                    ) : null}
                  </div>
                )

                if (!available) {
                  return (
                    <div key={chapter.chapterId} className={cardClass}>
                      {header}
                      {counters}
                      {footer}
                      <p className="mt-4 text-[11px] text-mute">Sujet ou correction retiré.</p>
                    </div>
                  )
                }

                return (
                  <div key={chapter.chapterId} className={cardClass}>
                    <Link
                      to={href}
                      aria-label={chapterLabel}
                      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                    >
                      {header}
                    </Link>
                    {counters}
                    {footer}
                    {actions}
                  </div>
                )
              })}
            </div>
          </section>
        ) : (
          <section className="mt-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative max-w-md flex-1">
                <Search
                  size={15}
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher dans l’historique"
                  aria-label="Rechercher dans l’historique"
                  className="h-11 w-full rounded-[10px] border border-line bg-surface pl-9 pr-9 text-[13px] text-ink outline-none transition placeholder:text-mute focus:border-accent"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Effacer la recherche"
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-mute transition hover:bg-cloud hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {HISTORY_FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={filter === option.value}
                    onClick={() => setFilter(option.value)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-[12px] font-medium transition',
                      filter === option.value
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line text-mute hover:border-accent/60 hover:text-ink',
                    )}
                  >
                    {option.label}
                    <span className="ml-1.5 text-[10px] opacity-70">
                      {historyCounts[option.value]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {reviewCards.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-line bg-surface p-6 text-center">
                <p className="text-[14px] font-medium text-ink">
                  Aucune question passée pour le moment.
                </p>
                <p className="mt-1 text-[12px] text-mute">
                  Réponds à une question dans un chapitre : elle apparaîtra ici avec sa réponse et
                  son explication.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <p className="text-[12px] leading-relaxed text-mute">
                  Un bloc par chapitre. Clique sur un chapitre pour voir ses questions : une
                  question = un seul bloc (question, réponse, explication). « À réviser » = les
                  questions déjà réussies, celles que le bloc Réviser te repose en QCM.
                </p>
                {historyGroups.map((group) => {
                  const open = openChapter === group.chapterId
                  return (
                    <section
                      key={group.chapterId}
                      className="overflow-hidden rounded-xl border border-line bg-surface"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenChapter(open ? null : group.chapterId)}
                        aria-expanded={open}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-cloud/40"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium text-ink">
                            {group.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-mute">
                            {group.cards.length} question{group.cards.length > 1 ? 's' : ''} dans
                            l’historique
                          </span>
                        </span>
                        {open ? (
                          <ChevronUp size={16} className="shrink-0 text-mute" />
                        ) : (
                          <ChevronDown size={16} className="shrink-0 text-mute" />
                        )}
                      </button>
                      {open ? (
                        <div className="border-t border-line p-3">
                          {group.cards.length === 0 ? (
                            <p className="px-1 py-2 text-[12px] text-mute">
                              Aucune question dans ce filtre pour ce chapitre.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {group.cards.map((card) => (
                                <ReviewCardRow
                                  key={`${card.chapterId}:${card.questionId}`}
                                  card={card}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </section>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
