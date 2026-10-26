import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Clock3 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getActiveAssignment } from '@/lib/db'
import { ButtonLink } from '@/components/ui/Button'
import { StatusPill } from '@/components/ui/StatusPill'
import { usePageTitle } from '@/components/Layouts'
import {
  daysLeft,
  formatDate,
  formatDateLong,
  monthLabel,
  relativeDate,
  scoreTone,
} from '@/lib/utils'

function scoreLabel(score: number, total: number) {
  const label = scoreTone(score, total)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function DashboardPage() {
  usePageTitle('Mon cycle — MEDQCM L1')
  const { user, db } = useAuth()
  const assignment = user ? getActiveAssignment(user.id, db) : undefined
  const subject = assignment
    ? db.subjects.find((candidate) => candidate.id === assignment.subjectId)
    : undefined
  const seriesSize = Math.min(20, subject?.questionCount ?? 20)
  const remaining = daysLeft(user?.expiresAt)
  const lowTime = remaining <= 7

  const attempts = subject
    ? db.attempts
        .filter((a) => a.userId === user?.id && a.subjectId === subject.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : []
  const recent = attempts.slice(0, 3)
  const best = attempts.reduce((max, a) => Math.max(max, a.score), 0)
  const average = attempts.length
    ? Math.round((attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length) * 10) / 10
    : 0
  const accessProgress = Math.min(100, Math.max(0, (remaining / 30) * 100))

  return (
    <div className="bg-canvas">
      <section className="border-b border-line">
        <div className="mx-auto max-w-content px-5 py-9 sm:px-8 sm:py-11 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[12px] text-mute">{monthLabel()} · votre cycle</p>
              <h1 className="mt-2 font-display text-[clamp(2.2rem,4.5vw,3.4rem)] leading-[1.05] tracking-[-0.03em] text-ink">
                Bonjour, {user?.firstName}.
              </h1>
              <p className="mt-2 text-[14px] text-mute">
                {subject
                  ? 'Votre sujet est ouvert. Choisissez une série quand vous êtes prêt.'
                  : 'Votre accès est actif. Aucun sujet ne vous a encore été attribué.'}
              </p>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <StatusPill tone={lowTime ? 'warning' : 'success'} dot>
                {lowTime ? 'Derniers jours' : 'Accès actif'}
              </StatusPill>
              <p className="text-[11px] text-mute">
                Jusqu’au {formatDateLong(user?.expiresAt)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-content px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        {subject && assignment ? (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="grid lg:grid-cols-[1fr_290px]">
              <div className="p-6 sm:p-8 lg:p-10">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    Sujet en cours
                  </span>
                  <span className="text-[11px] text-mute">Publié le {formatDate(subject.publishedAt)}</span>
                </div>

                <h2 className="mt-5 max-w-2xl font-display text-[clamp(1.9rem,3.7vw,2.9rem)] leading-[1.08] tracking-[-0.025em] text-ink">
                  {subject.title}
                </h2>
                <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-mute">
                  {subject.description}
                </p>

                <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <ButtonLink to="/app/entrainement" size="lg" className="w-full sm:w-auto">
                    Commencer une série <ArrowRight size={16} />
                  </ButtonLink>
                  <p className="text-[11px] text-mute">
                    {seriesSize} questions · tirage aléatoire
                  </p>
                </div>
              </div>

              <div className="border-t border-line bg-accent-soft/60 p-6 sm:p-8 lg:border-l lg:border-t-0">
                <div className="flex items-center gap-2 text-[11px] font-medium text-accent">
                  <Clock3 size={13} /> Temps restant
                </div>
                <p className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-[3.4rem] leading-none text-ink">{remaining}</span>
                  <span className="text-[12px] text-mute">jours</span>
                </p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/70">
                  <div
                    className={`h-full rounded-full ${lowTime ? 'bg-warning' : 'bg-accent'}`}
                    style={{ width: `${accessProgress}%` }}
                  />
                </div>
                <dl className="mt-5 space-y-2 border-t border-accent/15 pt-4 text-[11px]">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-mute">Ouverture</dt>
                    <dd className="font-medium text-ink">{formatDate(assignment.startedAt)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-mute">Fin du cycle</dt>
                    <dd className="font-medium text-ink">{formatDate(assignment.expiresAt)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-mute">Banque</dt>
                    <dd className="font-medium text-ink">{subject.questionCount} questions</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="grid grid-cols-3 border-t border-line">
              {[
                ['Séries', attempts.length],
                ['Moyenne', attempts.length ? `${average.toFixed(1).replace('.', ',')}/20` : '—'],
                ['Meilleur', attempts.length ? `${best}/20` : '—'],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className={`px-5 py-4 sm:px-8 ${index > 0 ? 'border-l border-line' : ''}`}
                >
                  <p className="text-[10px] text-mute">{label}</p>
                  <p className="mt-1 text-[16px] font-medium tabular-nums text-ink">{value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <h2 className="font-display text-[2rem] leading-[1.1] text-ink">Aucun sujet actif.</h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-mute">
              Votre accès est bien actif. Le docteur doit encore attribuer un sujet à votre cycle.
              Vous pouvez consulter vos anciennes séries en attendant.
            </p>
            <ButtonLink to="/app/historique" variant="secondary" className="mt-5">
              Voir mon historique
            </ButtonLink>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-content px-5 pb-16 sm:px-8 lg:px-10">
        <div className="flex items-end justify-between gap-4 border-b border-line pb-4">
          <div>
            <h2 className="text-[18px] font-medium text-ink">Dernières séries</h2>
            <p className="mt-1 text-[12px] text-mute">Les résultats du sujet en cours.</p>
          </div>
          {attempts.length > 0 && (
            <Link
              to="/app/historique"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:text-accent-deep"
            >
              Tout voir <ArrowUpRight size={13} />
            </Link>
          )}
        </div>

        {recent.length > 0 ? (
          <div>
            {recent.map((attempt) => (
              <Link
                key={attempt.id}
                to={`/app/resultat/${attempt.id}`}
                className="group flex items-center gap-4 border-b border-line py-4 transition-colors hover:bg-surface sm:gap-6"
              >
                <span className="w-10 shrink-0 text-[12px] tabular-nums text-mute">
                  {formatDate(attempt.createdAt, { day: '2-digit', month: 'short' })}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-ink">
                    Série de {attempt.total} questions
                  </p>
                  <p className="mt-0.5 text-[11px] text-mute">{relativeDate(attempt.createdAt)}</p>
                </div>
                <span className="text-[12px] text-mute">{scoreLabel(attempt.score, attempt.total)}</span>
                <span className="text-[16px] font-medium tabular-nums text-ink">
                  {attempt.score}
                  <span className="text-[11px] font-normal text-mute">/{attempt.total}</span>
                </span>
                <ArrowUpRight className="size-4 text-stone transition-colors group-hover:text-accent" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-10">
            <p className="text-[16px] font-medium text-ink">Votre première série vous attend.</p>
            <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-mute">
              Vingt questions tirées au hasard, puis une correction expliquée. Aucun téléchargement.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
