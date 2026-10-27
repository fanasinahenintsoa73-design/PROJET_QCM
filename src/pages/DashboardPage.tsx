import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getActiveAssignment } from '@/lib/db'
import { ButtonLink } from '@/components/ui/Button'
import { StatusPill } from '@/components/ui/StatusPill'
import { usePageTitle } from '@/components/Layouts'
import { cn, daysLeft, formatDate, formatDateLong, monthLabel, averageScoreOnTen, scoreOnTen, SERIES_SIZE } from '@/lib/utils'

function formatTen(value: number) {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
}

export default function DashboardPage() {
  usePageTitle('Mon cycle — MEDQCM L1')
  const { user, db } = useAuth()
  const [filter, setFilter] = useState('all')

  const assignment = user ? getActiveAssignment(user.id, db) : undefined
  const subject = assignment
    ? db.subjects.find((candidate) => candidate.id === assignment.subjectId)
    : undefined
  const seriesSize = Math.min(SERIES_SIZE, subject?.questionCount ?? SERIES_SIZE)
  const remaining = daysLeft(user?.expiresAt)
  const lowTime = remaining <= 7

  const attempts = useMemo(() => {
    if (!user) return []
    return db.attempts
      .filter((attempt) => attempt.userId === user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [db.attempts, user])

  const subjects = useMemo(() => {
    const ids = new Set(attempts.map((attempt) => attempt.subjectId))
    return db.subjects.filter((candidate) => ids.has(candidate.id))
  }, [attempts, db.subjects])

  const subjectById = useMemo(
    () => new Map(db.subjects.map((candidate) => [candidate.id, candidate])),
    [db.subjects],
  )

  const visible = filter === 'all' ? attempts : attempts.filter((attempt) => attempt.subjectId === filter)
  const showSubject = subjects.length > 1
  const best = attempts.reduce((max, attempt) => Math.max(max, scoreOnTen(attempt.score, attempt.total)), 0)
  const average = averageScoreOnTen(attempts)
  const accessProgress = Math.min(100, Math.max(0, (remaining / 30) * 100))

  return (
    <div className="bg-canvas">
      <section className="border-b border-line">
        <div className="mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-14 lg:px-10">
          <p className="text-[12px] text-mute">{monthLabel()} · votre cycle</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h1 className="font-display text-[clamp(2.2rem,4.5vw,3.4rem)] leading-[1.05] tracking-[-0.03em] text-ink">
              Bonjour, {user?.firstName}.
            </h1>
            <StatusPill tone={lowTime ? 'warning' : 'success'} dot>
              {lowTime ? 'Derniers jours' : 'Accès actif'}
            </StatusPill>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-12 lg:px-10">
        {subject && assignment ? (
          <div className="rounded-2xl border border-line bg-surface p-6 sm:p-9 lg:p-10">
            <p className="text-[11px] text-mute">
              Sujet publié le {formatDate(subject.publishedAt)}
            </p>
            <h2 className="mt-3 max-w-2xl font-display text-[clamp(1.9rem,3.7vw,2.9rem)] leading-[1.08] tracking-[-0.025em] text-ink">
              {subject.title}
            </h2>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-mute">
              {subject.description}
            </p>

            <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <ButtonLink to="/app/entrainement" size="lg" className="w-full sm:w-auto">
                Commencer une série <ArrowRight size={16} />
              </ButtonLink>
              <p className="text-[11px] text-mute">{seriesSize} questions · tirage aléatoire</p>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-5">
              <p className="text-[12px] text-ink">
                <span className="font-medium">{remaining} jours</span> restants
              </p>
              <div className="h-1 min-w-[110px] flex-1 overflow-hidden rounded-full bg-cloud">
                <div
                  className={`h-full rounded-full ${lowTime ? 'bg-warning' : 'bg-accent'}`}
                  style={{ width: `${accessProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-mute">
                Fin le {formatDateLong(assignment.expiresAt)}
              </p>
            </div>

            <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-3">
              {[
                ['Séries', attempts.length],
                ['Moyenne', attempts.length ? `${formatTen(average)}/10` : '—'],
                ['Meilleur', attempts.length ? `${formatTen(best)}/10` : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] text-mute">{label}</dt>
                  <dd className="mt-1 text-[15px] font-medium tabular-nums text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <h2 className="font-display text-[2rem] leading-[1.1] text-ink">Aucun sujet actif.</h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-mute">
              Votre accès est actif. Le docteur doit encore attribuer un sujet à votre cycle.
            </p>
          </div>
        )}
      </section>

      <section id="series" className="mx-auto max-w-content px-5 pb-16 sm:px-8 lg:px-10">
        <div className="border-b border-line pb-4">
          <h2 className="font-display text-[1.6rem] leading-none text-ink">Mes séries</h2>
        </div>

        {subjects.length > 1 && (
          <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={cn(
                'h-11 shrink-0 rounded-full border px-4 text-[12px] font-medium transition',
                filter === 'all'
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line bg-surface text-mute hover:border-accent hover:text-accent',
              )}
            >
              Tous les sujets
            </button>
            {subjects.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => setFilter(candidate.id)}
                className={cn(
                  'h-11 max-w-[240px] shrink-0 truncate rounded-full border px-4 text-[12px] font-medium transition',
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

        {visible.length > 0 ? (
          <div>
            {visible.map((attempt) => {
              const rowSubject = subjectById.get(attempt.subjectId)
              return (
                <Link
                  key={attempt.id}
                  to={`/app/resultat/${attempt.id}`}
                  className="group flex items-center justify-between gap-4 border-b border-line py-4 transition-colors hover:bg-surface"
                >
                  <div className="min-w-0 flex-1">
                    {showSubject && (
                      <p className="truncate text-[14px] font-medium text-ink">
                        {rowSubject?.title ?? 'Sujet archivé'}
                      </p>
                    )}
                    <p className={showSubject ? 'mt-1 text-[11px] text-mute' : 'text-[13px] text-ink'}>
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
              Vos résultats et corrigés apparaîtront ici dès que vous aurez terminé une série.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
