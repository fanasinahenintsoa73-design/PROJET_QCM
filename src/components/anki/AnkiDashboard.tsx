import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  History,
  LockKeyhole,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { getUsableQuestions } from '@/lib/db'
import { chaptersForTheme, chapterTitle, findThemeForChapter, PACE_THEMES } from '@/lib/themes'
import { buttonClasses } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import { cn } from '@/lib/utils'
import type { AnkiChapterState, AnkiHistoryEntry, Database } from '@/types'

function questionCount(chapterId: string, db: Database): number {
  return db.subjects
    .filter((subject) => !subject.archived && subject.chapterId === chapterId)
    .reduce((total, subject) => {
      const usable = getUsableQuestions(subject.id, db).length
      // En production, la banque de questions n’est jamais chargée côté étudiant.
      // On retombe alors sur le compteur publié du sujet, comme la sélection 30 séries.
      return total + (usable > 0 ? usable : (subject.questionCount ?? 0))
    }, 0)
}

function formatDay(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function statusLabel(status: AnkiHistoryEntry['status']): string {
  if (status === 'correct') return 'Juste'
  if (status === 'wrong') return 'Faux'
  if (status === 'revealed') return 'Réponse affichée'
  return 'Ignorée'
}

export default function AnkiDashboard() {
  usePageTitle('Mode Anki — MEDQCM mada')
  const { user, db, ticketExpiresAt } = useAuth()
  const [chapters, setChapters] = useState<AnkiChapterState[]>([])
  const [history, setHistory] = useState<AnkiHistoryEntry[]>([])
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [nextChapters, nextHistory] = await Promise.all([
        api.getAnkiChapters(),
        api.getAnkiHistory(),
      ])
      setChapters(nextChapters)
      setHistory(nextHistory)
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

  const selection = useMemo(
    () =>
      PACE_THEMES.map((theme) => ({
        theme,
        chapters: chaptersForTheme(theme.id)
          .map((chapter) => ({
            ...chapter,
            count: questionCount(chapter.id, db),
          }))
          .filter((chapter) => chapter.count > 0),
      })).filter((entry) => entry.chapters.length > 0),
    [db],
  )

  const totalQuestions = chapters.reduce((total, chapter) => total + chapter.totalQuestions, 0)
  const answeredQuestions = chapters.reduce(
    (total, chapter) => total + chapter.answeredQuestions,
    0,
  )
  const completedChapters = chapters.filter((chapter) => chapter.completedAt).length
  const maxLevel = chapters.reduce((level, chapter) => Math.max(level, chapter.level), 1)

  function toggleChapter(chapterId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(chapterId)) {
        next.delete(chapterId)
      } else if (next.size < 5) {
        next.add(chapterId)
      }
      return next
    })
  }

  async function startAnki() {
    if (selected.size === 0) return
    setSaving(true)
    try {
      await api.selectAnkiChapters([...selected])
      setSelected(new Set())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de choisir ces chapitres.')
    } finally {
      setSaving(false)
    }
  }

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

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              <Sparkles size={12} />
              Mode Anki
            </span>
            <h1 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-[-0.035em] text-ink">
              Bonjour {user?.firstName ?? ''}, prêt à réviser ?
            </h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-mute">
              Des blocs de 5 questions aléatoires, un niveau qui monte et un historique complet
              pour suivre ta progression.
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

        {chapters.length === 0 ? (
          <section className="mt-9">
            <div className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <LockKeyhole size={18} />
                </span>
                <div>
                  <h2 className="font-display text-[22px] tracking-[-0.02em] text-ink">
                    Choisis tes 5 chapitres
                  </h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-mute">
                    Une seule sélection par ticket. Elle reste verrouillée pendant toute la durée
                    de ton accès Anki.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-6">
                {selection.map(({ theme, chapters: themeChapters }) => (
                  <div key={theme.id}>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-mute">
                      {theme.title}
                    </p>
                    <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                      {themeChapters.map((chapter) => {
                        const active = selected.has(chapter.id)
                        const disabled = !active && selected.size >= 5
                        return (
                          <button
                            key={chapter.id}
                            type="button"
                            onClick={() => toggleChapter(chapter.id)}
                            disabled={disabled}
                            aria-pressed={active}
                            className={cn(
                              'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left text-[13px] transition',
                              active
                                ? 'border-accent bg-accent-soft text-ink'
                                : 'border-line bg-canvas text-ink hover:border-accent/60',
                              disabled && 'cursor-not-allowed opacity-40',
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span
                                className={cn(
                                  'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                                  active
                                    ? 'border-accent bg-accent text-white'
                                    : 'border-line bg-surface text-transparent',
                                )}
                              >
                                <Check size={12} />
                              </span>
                              <span className="truncate">{chapter.title}</span>
                            </span>
                            <span className="shrink-0 text-[11px] text-mute">{chapter.count} q.</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                <p className="text-[12px] text-mute">
                  {selected.size} / 5 chapitre{selected.size > 1 ? 's' : ''} sélectionné
                  {selected.size > 1 ? 's' : ''}
                </p>
                <button
                  type="button"
                  onClick={() => void startAnki()}
                  disabled={selected.size === 0 || saving}
                  className={buttonClasses('primary')}
                >
                  {saving ? 'Enregistrement…' : 'Commencer Anki'}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </section>
        ) : (
          <>
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

            <section className="mt-8">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-display text-[22px] tracking-[-0.02em] text-ink">Mes chapitres</h2>
                <span className="text-[11px] text-mute">5 chapitres verrouillés</span>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {chapters.map((chapter) => {
                  const theme = findThemeForChapter(chapter.chapterId)
                  const percent =
                    chapter.totalQuestions > 0
                      ? Math.round((chapter.answeredQuestions / chapter.totalQuestions) * 100)
                      : 0
                  const done = Boolean(chapter.completedAt)
                  return (
                    <article
                      key={chapter.chapterId}
                      className={cn(
                        'rounded-2xl border bg-surface p-5',
                        done ? 'border-success/30' : 'border-line',
                      )}
                    >
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
                            done
                              ? 'bg-success/10 text-success'
                              : 'bg-accent-soft text-accent',
                          )}
                        >
                          {done ? 'Terminé' : `Niveau ${chapter.level}`}
                        </span>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between text-[11px] text-mute">
                          <span>
                            {chapter.answeredQuestions} / {chapter.totalQuestions} questions
                          </span>
                          <span>{percent}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cloud">
                          <div
                            className={cn('h-full rounded-full', done ? 'bg-success' : 'bg-accent')}
                            style={{ width: `${Math.min(100, percent)}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-[11px] text-mute">
                          <BookOpen size={13} />
                          {chapter.completedBlocks} bloc{chapter.completedBlocks > 1 ? 's' : ''} de 5
                        </span>
                        {done ? (
                          <span className="flex items-center gap-1.5 text-[12px] font-medium text-success">
                            <Check size={14} /> Chapitre terminé
                          </span>
                        ) : (
                          <Link
                            to={`/app/anki/${chapter.chapterId}`}
                            className={buttonClasses('primary', 'sm')}
                          >
                            Continuer <ArrowRight size={14} />
                          </Link>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-line bg-surface">
              <button
                type="button"
                onClick={() => setShowHistory((value) => !value)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <span className="flex items-center gap-2.5">
                  <History size={16} className="text-accent" />
                  <span className="font-medium text-ink">Historique des réponses</span>
                  <span className="rounded-full bg-cloud px-2 py-0.5 text-[10px] text-mute">
                    {history.length}
                  </span>
                </span>
                {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showHistory && (
                <div className="border-t border-line px-5 py-4">
                  {history.length === 0 ? (
                    <p className="text-[13px] text-mute">Aucune réponse enregistrée pour le moment.</p>
                  ) : (
                    <div className="space-y-3">
                      {history.slice(0, 30).map((entry) => (
                        <article key={entry.id} className="rounded-xl border border-line bg-canvas p-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">
                              {chapterTitle(entry.chapterId)}
                            </span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                entry.status === 'correct' && 'bg-success/10 text-success',
                                entry.status === 'wrong' && 'bg-sale/10 text-sale',
                                entry.status === 'revealed' && 'bg-accent-soft text-accent',
                                entry.status === 'skipped' && 'bg-cloud text-mute',
                              )}
                            >
                              {statusLabel(entry.status)}
                            </span>
                          </div>
                          <p className="mt-2 text-[13px] leading-relaxed text-ink">{entry.statement}</p>
                          <div className="mt-2 grid gap-1 text-[12px] text-mute sm:grid-cols-2">
                            <span>
                              Ta réponse :{' '}
                              <strong className="font-medium text-ink">
                                {entry.givenAnswers.join(', ') || '—'}
                              </strong>
                            </span>
                            <span>
                              Bonne réponse :{' '}
                              <strong className="font-medium text-success">
                                {entry.correctAnswers.join(', ')}
                              </strong>
                            </span>
                          </div>
                          {entry.explanation && (
                            <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-[12px] leading-relaxed text-mute">
                              {entry.explanation}
                            </p>
                          )}
                          <p className="mt-2 text-[10px] text-mute">
                            {new Date(entry.createdAt).toLocaleString('fr-FR')}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
