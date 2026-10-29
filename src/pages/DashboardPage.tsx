import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  getCurrentCycleAttempts,
  getSeriesUsage,
  getUsableQuestions,
} from '@/lib/db'
import { PACE_THEMES, findPaceTheme, sortThemes } from '@/lib/themes'
import { ButtonLink } from '@/components/ui/Button'
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
import type { Subject } from '@/types'

function formatTen(value: number) {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
}

export default function DashboardPage() {
  usePageTitle('Mon cycle — MEDQCM L1')
  const { user, db } = useAuth()
  const [filter, setFilter] = useState('all')

  const usage = user ? getSeriesUsage(user.id, db) : undefined
  const assignment = usage?.assignment
  const attempts = useMemo(
    () => (user ? getCurrentCycleAttempts(user.id, db, assignment) : []),
    [assignment, db, user],
  )

  const themeBySubject = useMemo(
    () =>
      new Map(
        PACE_THEMES.map((theme) => [
          theme.id,
          db.subjects.find(
            (subject) => subject.id === theme.id || findPaceTheme(subject.title)?.id === theme.id,
          ),
        ]),
      ),
    [db.subjects],
  )

  const themes = useMemo(() => {
    const subjects = sortThemes(
      db.subjects.filter((subject) => !subject.archived),
    )
    return PACE_THEMES.map((theme, index) => {
      const subject =
        subjects.find((candidate) => findPaceTheme(candidate.title)?.id === theme.id) ??
        themeBySubject.get(theme.id)
      const usable = subject
        ? db.questions.length > 0
          ? getUsableQuestions(subject.id, db).length
          : subject.questionCount
        : 0
      return { theme, subject, usable, number: index + 1 }
    })
    // themeBySubject is derived from db.subjects; listing both deps keeps the
    // memo honest without recomputing on unrelated renders.
  }, [db.questions, db.subjects, themeBySubject])

  const attemptedThemeIds = useMemo(
    () => new Set(attempts.map((attempt) => attempt.subjectId)),
    [attempts],
  )

  const subjectById = useMemo(
    () => new Map(db.subjects.map((candidate) => [candidate.id, candidate])),
    [db.subjects],
  )

  const visibleAttempts =
    filter === 'all' ? attempts : attempts.filter((attempt) => attempt.subjectId === filter)
  const showTheme = attempts.length > 0
  const best = attempts.reduce(
    (max, attempt) => Math.max(max, scoreOnTen(attempt.score, attempt.total)),
    0,
  )
  const average = averageScoreOnTen(attempts)
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
                Neuf thèmes PACES. Des séries de dix questions, à votre rythme.
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
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Mon cycle</p>
                <p className="mt-2 text-[15px] font-medium text-ink">
                  Séries faites : {used} / {SERIES_LIMIT}
                </p>
              </div>
              <p className="text-[12px] text-mute">
                {remainingSeries > 0
                  ? `${remainingSeries} série${remainingSeries > 1 ? 's' : ''} restante${remainingSeries > 1 ? 's' : ''}`
                  : 'Quota atteint'}
              </p>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-cloud">
              <div
                className={cn('h-full rounded-full', reached ? 'bg-warning' : 'bg-accent')}
                style={{ width: `${seriesProgress}%` }}
              />
            </div>

            <dl className="mt-6 grid grid-cols-3 gap-3">
                {[
                  ['Séries', String(attempts.length)],
                  ['Moyenne', attempts.length ? `${formatTen(average)}/10` : '—'],
                  ['Meilleur', attempts.length ? `${formatTen(best)}/10` : '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] uppercase tracking-[0.1em] text-mute">{label}</dt>
                    <dd className="mt-1 text-[14px] font-medium tabular-nums text-ink">{value}</dd>
                  </div>
                ))}
            </dl>
          </div>

          <div
            className={cn(
              'rounded-2xl border p-6 sm:p-8',
              reached ? 'border-warning/40 bg-warning-soft' : 'border-line bg-accent-soft',
            )}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
              {reached ? 'Renouvellement' : 'Votre rythme'}
            </p>
            <p className="mt-3 font-display text-[1.7rem] leading-[1.15] tracking-[-0.02em] text-ink">
              {reached ? 'Vos 30 séries sont terminées.' : `${remainingSeries} séries vous attendent.`}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-ash">
              {reached
                ? SERIES_LIMIT_MESSAGE
                : 'Choisissez librement un thème. Chaque série compte 10 questions et ne peut être envoyée qu’une fois.'}
            </p>
            {reached ? (
              <ButtonLink to="/reinscription" size="lg" className="mt-5 w-full justify-center">
                Renouveler mon accès <ArrowRight size={16} />
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-content px-5 pb-12 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
          <div>
            <h2 className="font-display text-[1.6rem] leading-none text-ink">Les neuf thèmes</h2>
            <p className="mt-2 text-[12px] text-mute">
              Sélectionnez un thème pour lancer une série de {SERIES_SIZE} questions.
            </p>
          </div>
          <p className="text-[11px] text-mute">
            {attemptedThemeIds.size} thème{attemptedThemeIds.size > 1 ? 's' : ''} travaillé
            {attemptedThemeIds.size > 1 ? 's' : ''}
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {themes.map(({ theme, subject, usable, number }) => {
            const available = usable >= SERIES_SIZE
            const blocked = reached
            const href = `/app/entrainement?theme=${encodeURIComponent(theme.id)}`
            const content = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cloud text-[11px] font-medium tabular-nums text-mute">
                    {String(number).padStart(2, '0')}
                  </span>
                  {available ? (
                    <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-medium text-accent">
                      {subject?.questionCount ?? usable} questions
                    </span>
                  ) : (
                    <span className="rounded-full bg-cloud px-2.5 py-1 text-[10px] font-medium text-mute">
                      Bientôt disponible
                    </span>
                  )}
                </div>
                <h3 className="mt-4 min-h-[3.2rem] text-[15px] font-medium leading-snug text-ink">
                  {theme.title}
                </h3>
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-mute">
                  {theme.description}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-line pt-3 text-[11px]">
                  <span className={cn('font-medium', available && !blocked ? 'text-accent' : 'text-mute')}>
                    {blocked
                      ? 'Renouvelez pour continuer'
                      : available
                        ? attemptedThemeIds.has(subject?.id ?? theme.id)
                          ? 'Refaire une série'
                          : 'Commencer une série'
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
            Historique du cycle en cours uniquement. Il repart de zéro à chaque renouvellement.
          </p>
        </div>

        {attempts.length > 0 && (
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
              Tous les thèmes
            </button>
            {sortThemes(
              [...new Set(attempts.map((attempt) => attempt.subjectId))]
                .map((id) => subjectById.get(id))
                .filter((subject): subject is Subject => Boolean(subject)),
            ).map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => setFilter(candidate.id)}
                className={cn(
                  'h-10 max-w-[260px] shrink-0 truncate rounded-full border px-4 text-[12px] font-medium transition',
                  filter === candidate.id
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface text-mute hover:border-accent hover:text-accent',
                )}
              >
                {candidate.title}
              </button>
            ))}
          </div>
        )}

        {visibleAttempts.length > 0 ? (
          <div>
            {visibleAttempts.map((attempt) => {
              const rowSubject = subjectById.get(attempt.subjectId)
              return (
                <Link
                  key={attempt.id}
                  to={`/app/resultat/${attempt.id}`}
                  className="group flex items-center justify-between gap-4 border-b border-line py-4 transition-colors hover:bg-surface"
                >
                  <div className="min-w-0 flex-1">
                    {showTheme && (
                      <p className="truncate text-[14px] font-medium text-ink">
                        {rowSubject?.title ?? findPaceTheme(attempt.subjectId)?.title ?? 'Thème'}
                      </p>
                    )}
                    <p className={showTheme ? 'mt-1 text-[11px] text-mute' : 'text-[13px] text-ink'}>
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
