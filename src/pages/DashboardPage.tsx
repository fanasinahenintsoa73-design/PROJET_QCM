import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  GraduationCap,
  Phone,
  Star,
  Sun,
  Trophy,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { doctorContactLine } from '@/lib/contact'
import {
  getCurrentCycleAttempts,
  getSeriesUsage,
  getUsableQuestions,
} from '@/lib/db'
import {
  attemptsOnDay,
  DAILY_SERIES_GOAL,
  dailyGoalMessage,
  isCompletedAttempt,
} from '@/lib/engagement'
import {
  PACE_THEMES,
  chaptersForTheme,
  findPaceTheme,
  findThemeForChapter,
} from '@/lib/themes'
import {
  findChapterSelectionSubjects,
  findLegacyThemeSubjects,
} from '@/lib/subjects'
import { buttonClasses } from '@/components/ui/Button'
import { StatusPill } from '@/components/ui/StatusPill'
import { usePageTitle } from '@/components/Layouts'
import {
  averageScoreOnTen,
  cn,
  formatDate,
  scoreOnTen,
  SERIES_LIMIT,
  SERIES_LIMIT_MESSAGE,
  SERIES_SIZE,
} from '@/lib/utils'
import type { Attempt } from '@/types'

function formatTen(value: number) {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
}

function attemptThemeId(attempt: Attempt, subjectTitleById: Map<string, string>): string | undefined {
  if (attempt.ueId) return attempt.ueId
  const chapterTheme = attempt.chapterIds?.[0]
    ? findThemeForChapter(attempt.chapterIds[0])
    : undefined
  if (chapterTheme) return chapterTheme.id
  return findPaceTheme(subjectTitleById.get(attempt.subjectId) ?? attempt.subjectId)?.id
}

export default function DashboardPage() {
  usePageTitle('Mon cycle — MEDQCM mada')
  const { user, db } = useAuth()
  const [filter, setFilter] = useState('all')

  const usage = user ? getSeriesUsage(user.id, db) : undefined
  const assignment = usage?.assignment
  const cycleAttempts = useMemo(
    () => (user ? getCurrentCycleAttempts(user.id, db, assignment) : []),
    [assignment, db, user],
  )
  const completedAttempts = useMemo(
    () => cycleAttempts.filter(isCompletedAttempt),
    [cycleAttempts],
  )
  const todayAttempts = useMemo(() => attemptsOnDay(cycleAttempts), [cycleAttempts])
  const todayCount = todayAttempts.length
  const dailyGoalReached = todayCount >= DAILY_SERIES_GOAL

  const subjectTitleById = useMemo(
    () => new Map(db.subjects.map((subject) => [subject.id, subject.title])),
    [db.subjects],
  )

  const themes = useMemo(
    () =>
      PACE_THEMES.map((theme) => {
        const chapters = chaptersForTheme(theme.id)
        const chapterIds = chapters.map((chapter) => chapter.id)
        const chapterSubjects = findChapterSelectionSubjects(chapterIds, db.subjects)
        const legacySubjects = findLegacyThemeSubjects(theme.id, db.subjects)
        const subjects = [...chapterSubjects, ...legacySubjects]
        const usable = subjects.reduce(
          (total, subject) =>
            total +
            (db.questions.length > 0
              ? getUsableQuestions(subject.id, db).length
              : subject.questionCount),
          0,
        )
        return {
          theme,
          chapters,
          subjects,
          usable,
          available: chapters.length > 0 && usable >= SERIES_SIZE,
        }
      }),
    [db.questions, db.subjects],
  )

  const attemptedThemeIds = useMemo(
    () =>
      new Set(
        completedAttempts
          .map((attempt) => attemptThemeId(attempt, subjectTitleById))
          .filter((id): id is string => Boolean(id)),
      ),
    [completedAttempts, subjectTitleById],
  )

  const triedThemes = useMemo(
    () => PACE_THEMES.filter((theme) => attemptedThemeIds.has(theme.id)),
    [attemptedThemeIds],
  )

  const completedChapterIds = useMemo(() => {
    const ids = new Set<string>()
    completedAttempts.forEach((attempt) => {
      ;(attempt.chapterIds ?? []).forEach((chapterId) => ids.add(chapterId))
    })
    return ids
  }, [completedAttempts])

  const completedThemes = useMemo(
    () =>
      themes.filter(
        ({ chapters }) =>
          chapters.length > 0 &&
          chapters.every((chapter) => completedChapterIds.has(chapter.id)),
      ),
    [completedChapterIds, themes],
  )

  const badges = [
    {
      id: 'day',
      label: 'Série du jour',
      description: 'Une série lancée aujourd’hui',
      earned: todayCount > 0,
      icon: Sun,
    },
    {
      id: 'five',
      label: '5 séries',
      description: 'Cinq séries terminées',
      earned: completedAttempts.length >= 5,
      icon: Star,
    },
    {
      id: 'ten',
      label: '10 séries',
      description: 'Dix séries terminées',
      earned: completedAttempts.length >= 10,
      icon: Trophy,
    },
    {
      id: 'ue',
      label: 'UE terminée',
      description: completedThemes.length
        ? `${completedThemes.length} UE parcourue${completedThemes.length > 1 ? 's' : ''}`
        : 'Tous les chapitres d’une UE',
      earned: completedThemes.length > 0,
      icon: GraduationCap,
    },
  ]
  const earnedBadges = badges.filter((badge) => badge.earned).length

  const visibleAttempts =
    filter === 'all'
      ? completedAttempts
      : completedAttempts.filter(
          (attempt) => attemptThemeId(attempt, subjectTitleById) === filter,
        )
  const best = completedAttempts.reduce(
    (max, attempt) => Math.max(max, scoreOnTen(attempt.score, attempt.total)),
    0,
  )
  const average = averageScoreOnTen(completedAttempts)
  const used = usage?.used ?? 0
  const remainingSeries = usage?.remaining ?? SERIES_LIMIT
  const reached = usage?.reached ?? false
  const seriesProgress = Math.min(100, (used / SERIES_LIMIT) * 100)

  return (
    <div className="bg-canvas">
      <section className="border-b border-line">
        <div className="mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-14 lg:px-10">
          <p className="text-[12px] text-mute">
            PACES (Première Année Commune des Études de Santé)
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-[clamp(2.2rem,4.5vw,3.4rem)] leading-[1.05] tracking-[-0.03em] text-ink">
                Bonjour, {user?.firstName}.
              </h1>
              <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-mute">
                Des séries de dix questions, à votre rythme.
              </p>
            </div>
            <StatusPill tone={reached ? 'warning' : 'success'} dot>
              {reached ? 'Quota atteint' : 'Accès actif'}
            </StatusPill>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-content px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Mon cycle</p>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-[2.6rem] leading-none tracking-[-0.02em] text-ink">
                  {used}
                </span>
                <span className="text-[14px] text-mute">/ {SERIES_LIMIT} séries</span>
              </p>
              <p className="mt-2 text-[12px] text-mute">
                {remainingSeries > 0
                  ? `${remainingSeries} série${remainingSeries > 1 ? 's' : ''} restante${remainingSeries > 1 ? 's' : ''} sur ce cycle`
                  : 'Quota atteint pour ce cycle'}
              </p>
            </div>

            <div
              className="mt-5 h-2.5 overflow-hidden rounded-full bg-cloud"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={SERIES_LIMIT}
              aria-valuenow={used}
              aria-label={`${used} séries lancées sur ${SERIES_LIMIT}`}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-500',
                  reached ? 'bg-warning' : 'bg-accent',
                )}
                style={{ width: `${seriesProgress}%` }}
              />
            </div>

            <dl className="mt-6 grid grid-cols-3 gap-3">
              {[
                ['Lancées', String(used)],
                ['Moyenne', completedAttempts.length ? `${formatTen(average)}/10` : '—'],
                ['Meilleur', completedAttempts.length ? `${formatTen(best)}/10` : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10px] uppercase tracking-[0.1em] text-mute">{label}</dt>
                  <dd className="mt-1 text-[14px] font-medium tabular-nums text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-accent p-6 text-white sm:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full border border-white/15"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -right-4 h-52 w-52 rounded-full border border-white/10"
            />
            <div className="relative">
              {reached ? (
                <>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/70">
                    Ticket terminé
                  </p>
                  <p className="mt-3 font-display text-[2.7rem] leading-none tracking-[-0.02em]">
                    {SERIES_LIMIT}
                    <span className="text-[1.3rem] text-white/65"> / {SERIES_LIMIT}</span>
                  </p>
                  <p className="mt-3 text-[13px] leading-relaxed text-white/80">
                    {SERIES_LIMIT_MESSAGE}
                  </p>
                  <p className="mt-4 flex items-start gap-2 rounded-xl bg-white/10 px-3.5 py-3 text-[12px] leading-relaxed text-white/90">
                    <Phone size={14} className="mt-0.5 shrink-0" />
                    <span>{doctorContactLine()}</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/70">
                    Objectif du jour
                  </p>
                  <p className="mt-3 font-display text-[2.7rem] leading-none tracking-[-0.02em]">
                    {todayCount}
                    <span className="text-[1.3rem] text-white/65"> / {DAILY_SERIES_GOAL}</span>
                  </p>
                  <p className="mt-3 text-[13px] leading-relaxed text-white/80">
                    {dailyGoalMessage(todayCount)}
                  </p>
                  <div className="mt-5 flex gap-2" aria-hidden>
                    {Array.from({ length: DAILY_SERIES_GOAL }).map((_, index) => (
                      <span
                        key={index}
                        className={cn(
                          'h-2 flex-1 rounded-full transition-colors',
                          index < todayCount ? 'bg-white' : 'bg-white/20',
                        )}
                      />
                    ))}
                  </div>
                  {dailyGoalReached ? (
                    <p className="mt-5 inline-flex items-center gap-2 text-[11px] font-medium text-white/80">
                      <Check size={13} strokeWidth={2.5} /> Objectif du jour atteint
                    </p>
                  ) : null}
                  <a
                    href="#ues"
                    className={buttonClasses('white', 'md', 'mt-6 w-full justify-center')}
                  >
                    Choisir une UE <ArrowRight size={16} />
                  </a>
                  <p className="mt-3 text-[10px] leading-relaxed text-white/70">
                    Toute série lancée compte, même si vous quittez le QCM.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-content px-5 pb-10 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
          <div>
            <h2 className="text-[13px] font-medium text-ink">Vos repères</h2>
            <p className="mt-1 text-[11px] text-mute">Des jalons simples, sans pression.</p>
          </div>
          <p className="text-[11px] tabular-nums text-mute">
            {earnedBadges} / {badges.length} obtenus
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {badges.map((badge) => {
            const Icon = badge.icon
            return (
              <div
                key={badge.id}
                aria-label={`${badge.label}, ${badge.earned ? 'obtenu' : 'à débloquer'}`}
                className={cn(
                  'flex min-w-0 items-start gap-3 rounded-xl border px-4 py-3.5',
                  badge.earned
                    ? 'border-accent/25 bg-accent-soft/60'
                    : 'border-line bg-surface',
                )}
              >
                <span
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-full',
                    badge.earned ? 'bg-accent text-white' : 'bg-cloud text-stone',
                  )}
                >
                  <Icon size={15} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-[12px] font-medium',
                      badge.earned ? 'text-ink' : 'text-mute',
                    )}
                  >
                    {badge.label}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-mute">
                    {badge.description}
                  </p>
                </div>
                {badge.earned ? (
                  <Check
                    size={12}
                    strokeWidth={2.5}
                    className="ml-auto mt-1 shrink-0 text-accent"
                    aria-hidden
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      <section
        id="ues"
        className="mx-auto max-w-content scroll-mt-24 px-5 pb-12 sm:px-8 lg:px-10"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
          <div>
            <h2 className="font-display text-[1.6rem] leading-none text-ink">
              Unités d’enseignement
            </h2>
            <p className="mt-2 text-[12px] text-mute">
              Sélectionnez une UE, puis un ou plusieurs chapitres.
            </p>
          </div>
          <p className="text-[11px] text-mute">
            {triedThemes.length} UE travaillée{triedThemes.length > 1 ? 's' : ''}
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {themes.map(({ theme, chapters, available }) => {
            const blocked = reached
            const href = `/app/ue/${encodeURIComponent(theme.id)}`
            const content = (
              <>
                {available ? null : (
                  <span className="inline-block rounded-full bg-cloud px-2.5 py-1 text-[10px] font-medium text-mute">
                    {chapters.length === 0 ? 'Chapitres à venir' : 'Bientôt disponible'}
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
                    {chapters.length} chapitre{chapters.length > 1 ? 's' : ''}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>10 questions par série</span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[11px]">
                  <span
                    className={cn(
                      'font-medium',
                      blocked
                        ? 'text-mute'
                        : available && attemptedThemeIds.has(theme.id)
                          ? 'font-semibold text-sale'
                          : available
                            ? 'text-accent'
                            : 'text-mute',
                    )}
                  >
                    {blocked
                      ? 'Ticket terminé, contactez le docteur'
                      : available
                        ? attemptedThemeIds.has(theme.id)
                          ? 'Refaire une série'
                          : 'Choisir mes chapitres'
                        : chapters.length === 0
                          ? 'Les chapitres arrivent bientôt'
                          : 'Le docteur prépare les questions'}
                  </span>
                  {available && !blocked ? (
                    <ArrowUpRight size={14} className="text-mute" />
                  ) : null}
                </div>
              </>
            )

            const className =
              'group block rounded-2xl border border-line bg-surface p-5 transition sm:p-6 ' +
              (available && !blocked
                ? 'hover:-translate-y-0.5 hover:border-accent hover:shadow-sm'
                : 'opacity-70')

            return available && !blocked ? (
              <Link key={theme.id} to={href} className={className}>
                {content}
              </Link>
            ) : (
              <div key={theme.id} className={className}>
                {content}
              </div>
            )
          })}
        </div>
      </section>

      <section id="series" className="mx-auto max-w-content px-5 pb-16 sm:px-8 lg:px-10">
        <div className="border-b border-line pb-4">
          <h2 className="font-display text-[1.6rem] leading-none text-ink">Mes séries</h2>
          <p className="mt-2 text-[12px] text-mute">
            Historique du ticket en cours uniquement. Il repart de zéro à chaque nouveau ticket.
          </p>
        </div>

        {completedAttempts.length > 0 && (
          <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={cn(
                'h-10 shrink-0 rounded-full border px-4 text-[12px] font-medium transition',
                filter === 'all'
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line bg-surface text-mute hover:border-accent hover:text-accent',
              )}
            >
              Toutes les UE
            </button>
            {triedThemes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setFilter(theme.id)}
                className={cn(
                  'h-10 max-w-[260px] shrink-0 truncate rounded-full border px-4 text-[12px] font-medium transition',
                  filter === theme.id
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface text-mute hover:border-accent hover:text-accent',
                )}
              >
                {theme.title}
              </button>
            ))}
          </div>
        )}

        {visibleAttempts.length > 0 ? (
          <div>
            {visibleAttempts.map((attempt) => {
              const theme = findPaceTheme(attempt.ueId ?? '') ??
                findPaceTheme(subjectTitleById.get(attempt.subjectId) ?? attempt.subjectId)
              return (
                <Link
                  key={attempt.id}
                  to={`/app/resultat/${attempt.id}`}
                  className="group flex items-center justify-between gap-4 border-b border-line py-4 transition-colors hover:bg-surface"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">
                      {theme?.title ?? 'Série'}
                    </p>
                    <p className="mt-1 text-[11px] text-mute">
                      {formatDate(attempt.createdAt)}
                      <span className="text-mute"> · Série de {attempt.total} questions</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="text-[17px] font-medium tabular-nums text-ink">
                      {attempt.score}
                      <span className="text-[11px] font-normal text-mute">/{attempt.total}</span>
                    </span>
                    <ArrowUpRight className="size-4 text-mute transition-colors group-hover:text-accent" />
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="py-8">
            <p className="text-[15px] font-medium text-ink">Votre première série vous attend.</p>
            <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-mute">
              Vos résultats et corrigés apparaîtront ici dès que vous aurez terminé une série du
              cycle en cours.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
