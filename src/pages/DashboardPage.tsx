import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Lightbulb,
  Target,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getActiveAssignment } from '@/lib/db'
import { ButtonLink } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
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
  usePageTitle('Tableau de bord')
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
  const recent = attempts.slice(0, 4)
  const best = attempts.reduce((max, a) => Math.max(max, a.score), 0)
  const average = attempts.length
    ? Math.round((attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length) * 10) / 10
    : 0
  const seen = new Set(attempts.flatMap((a) => a.questionIds)).size
  const accessProgress = Math.min(100, Math.max(0, (remaining / 30) * 100))

  return (
    <div className="bg-canvas">
      {/* Greeting */}
      <section className="border-b border-hairline-soft">
        <div className="mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-12 lg:px-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Tableau de bord · {monthLabel()}</p>
              <h1 className="display mt-4 text-[clamp(2.9rem,6vw,4.6rem)]">
                Bonjour, {user?.firstName}.
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-mute">
                Votre espace est actif. Refaite autant de séries que vous le souhaitez sur le
                sujet qui vous a été attribué, pendant toute la durée de votre cycle.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <StatusPill tone={lowTime ? 'warning' : 'success'} dot>
                {lowTime ? 'Derniers jours' : 'Accès actif'}
              </StatusPill>
              <p className="text-[12px] text-mute">
                Valable jusqu’au {formatDateLong(user?.expiresAt)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Subject / countdown */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-content px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
          {subject ? (
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="flex flex-col justify-between lg:col-span-8">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="eyebrow text-white/45">Votre sujet</span>
                    <span className="h-px w-10 bg-white/25" aria-hidden="true" />
                    <span className="inline-flex items-center gap-2 border border-white/25 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/80">
                      <span className="size-1.5 bg-success-bright" aria-hidden="true" />
                      En cours
                    </span>
                  </div>
                  <h2 className="display mt-6 text-[clamp(3.4rem,7vw,5.6rem)]">
                    Le sujet
                    <br />
                    est ouvert.
                  </h2>
                  <p className="mt-6 max-w-2xl text-[17px] font-medium leading-snug text-white">
                    {subject.title}
                  </p>
                  <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-white/55">
                    {subject.description}
                  </p>
                </div>

                <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
                  <ButtonLink
                    to="/app/entrainement"
                    variant="white"
                    size="lg"
                    className="group gap-3"
                  >
                    Démarrer une série de {seriesSize} QCM
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </ButtonLink>
                  <p className="text-[12px] text-white/45">
                    Tirage aléatoire · corrigé immédiat
                  </p>
                </div>
              </div>

              <aside className="lg:col-span-4">
                <div className="flex h-full flex-col border border-white/15 p-6 sm:p-7">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="eyebrow text-white/45">Temps restant</p>
                      <p className="mt-2 text-[12px] text-white/50">
                        {lowTime ? 'Derniers jours pour s’entraîner' : 'Sur votre accès d’un mois'}
                      </p>
                    </div>
                    <Clock3 className="size-5 text-white/40" strokeWidth={1.5} aria-hidden="true" />
                  </div>

                  <div className="mt-5 flex items-baseline gap-3">
                    <span className="display text-[clamp(4.8rem,10vw,6.6rem)] leading-[0.8]">
                      {remaining}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                      jours
                      <br />
                      restants
                    </span>
                  </div>

                  <ProgressBar
                    value={accessProgress}
                    className="mt-7 bg-white/15"
                    barClassName={lowTime ? 'bg-sale' : 'bg-white'}
                  />
                  <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.14em] text-white/35">
                    <span>Passés</span>
                    <span>30 jours</span>
                  </div>

                  <div className="mt-auto space-y-2.5 border-t border-white/15 pt-5 text-[12px]">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-white/45">Attribué le</span>
                      <span className="text-white/85">{formatDate(assignment?.startedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-white/45">Fin du cycle</span>
                      <span className="text-white/85">{formatDate(assignment?.expiresAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-white/45">Banque</span>
                      <span className="text-white/85">{subject.questionCount} questions</span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          ) : (
            <div className="max-w-3xl py-6">
              <p className="eyebrow text-white/45">Votre sujet</p>
              <h2 className="display mt-5 text-[clamp(3rem,6vw,4.8rem)]">
                Aucun sujet
                <br />
                attribué.
              </h2>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/55">
                Votre accès est actif, mais aucun sujet ne vous a encore été attribué. Contactez
                votre docteur pour qu’il ajoute un sujet à la file.
              </p>
              <ButtonLink to="/app/historique" variant="white" className="mt-7 gap-2">
                Revoir mes anciennes séries
                <ArrowRight className="size-4" />
              </ButtonLink>
            </div>
          )}
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-hairline-soft bg-canvas">
        <div className="mx-auto max-w-content px-5 sm:px-8 lg:px-12">
          <div className="grid grid-cols-2 border-b border-hairline lg:grid-cols-4">
            {[
              {
                label: 'Score moyen',
                value: attempts.length ? average.toFixed(1).replace('.', ',') : '—',
                suffix: '/20',
                note: `Sur ${attempts.length} série${attempts.length > 1 ? 's' : ''}`,
              },
              {
                label: 'Meilleur score',
                value: attempts.length ? best : '—',
                suffix: '/20',
                note: attempts.length ? scoreLabel(best, 20) : 'Votre objectif',
              },
              {
                label: 'Séries terminées',
                value: attempts.length,
                suffix: '',
                note: 'Sur ce sujet',
              },
              {
                label: 'Questions vues',
                value: seen,
                suffix: `/ ${subject?.questionCount ?? '—'}`,
                note: 'Dans la banque',
              },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`py-6 pr-4 sm:py-7 ${i % 2 === 1 ? 'border-l border-hairline pl-5 lg:border-l' : ''} lg:border-l lg:pl-6 lg:first:border-l-0 lg:first:pl-0`}
              >
                <p className="eyebrow">{stat.label}</p>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="display text-[2.4rem] leading-none">{stat.value}</span>
                  {stat.suffix && (
                    <span className="text-[12px] text-mute">{stat.suffix}</span>
                  )}
                </p>
                <p className="mt-2 text-[11px] text-mute">{stat.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent + access info */}
      <section>
        <div className="mx-auto grid max-w-content gap-10 px-5 py-12 sm:px-8 sm:py-14 lg:grid-cols-12 lg:gap-14 lg:px-12">
          <div className="lg:col-span-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Activité</p>
                <h2 className="mt-2 text-[24px] font-medium tracking-[-0.01em] text-ink">
                  Vos dernières séries
                </h2>
              </div>
              {attempts.length > 0 && (
                <Link
                  to="/app/historique"
                  className="group inline-flex items-center gap-2 text-[12px] font-medium text-ink"
                >
                  Tout l’historique
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>

            {recent.length > 0 ? (
              <div className="mt-6 border-t border-hairline">
                {recent.map((attempt) => {
                  const percent = Math.round((attempt.score / attempt.total) * 100)
                  return (
                    <Link
                      key={attempt.id}
                      to={`/app/resultat/${attempt.id}`}
                      className="group flex items-center gap-4 border-b border-hairline py-4 transition-colors hover:bg-cloud sm:gap-6 sm:px-2"
                    >
                      <div className="grid size-11 shrink-0 place-items-center bg-cloud sm:size-12">
                        <Target className="size-4 text-ash" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-ink">
                          Série de {attempt.total} questions
                        </p>
                        <p className="mt-0.5 text-[11px] text-mute">
                          {relativeDate(attempt.createdAt)} · {formatDate(attempt.createdAt, {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </p>
                      </div>
                      <div className="hidden w-28 sm:block">
                        <ProgressBar value={percent} className="h-px" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-medium tabular-nums text-ink">
                          {attempt.score}
                        </span>
                        <span className="text-[11px] text-mute">/20</span>
                      </div>
                      <ArrowUpRight className="size-4 text-stone transition-colors group-hover:text-ink" />
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="mt-6 border-y border-hairline py-10">
                <p className="text-[20px] font-medium text-ink">Votre première série vous attend.</p>
                <p className="mt-2 max-w-md text-[14px] leading-relaxed text-mute">
                  Vingt questions tirées au hasard, un corrigé détaillé à la fin. Rien à
                  installer, rien à imprimer.
                </p>
                <ButtonLink to="/app/entrainement" variant="secondary" className="mt-5 gap-2">
                  Lancer ma première série
                  <ArrowRight className="size-4" />
                </ButtonLink>
              </div>
            )}

            {subject && (
              <p className="mt-4 text-[11px] leading-relaxed text-mute">
                Chaque série est tirée au hasard parmi les {subject.questionCount} questions du
                sujet. Les scores ci-dessus concernent le sujet en cours.
              </p>
            )}
          </div>

          <aside className="lg:col-span-5">
            <div className="bg-cloud p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Votre accès</p>
                  <h2 className="mt-2 text-[22px] font-medium tracking-[-0.01em] text-ink">
                    Un mois, un sujet.
                  </h2>
                </div>
                <CalendarDays className="size-5 text-ash" strokeWidth={1.5} aria-hidden="true" />
              </div>

              <p className="mt-3 text-[13px] leading-relaxed text-mute">
                Votre accès court 30 jours à partir de l’acceptation de votre demande. Le sujet
                attribué reste disponible pendant toute cette période.
              </p>

              <dl className="mt-6 border-t border-hairline text-[12px]">
                <div className="flex items-center justify-between gap-4 border-b border-hairline py-3">
                  <dt className="text-mute">Activation</dt>
                  <dd className="font-medium text-ink">{formatDate(user?.activatedAt)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-hairline py-3">
                  <dt className="text-mute">Fin d’accès</dt>
                  <dd className="font-medium text-ink">{formatDate(user?.expiresAt)}</dd>
                </div>
                {assignment && (
                  <div className="flex items-center justify-between gap-4 border-b border-hairline py-3">
                    <dt className="text-mute">Fin du cycle</dt>
                    <dd className="font-medium text-ink">{formatDate(assignment.expiresAt)}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-mute">Séries</dt>
                  <dd className="font-medium text-ink">Illimitées</dd>
                </div>
              </dl>

              <div className="mt-5 flex items-start gap-2.5 border-t border-hairline pt-5">
                <Clock3 className="mt-0.5 size-3.5 shrink-0 text-ash" aria-hidden="true" />
                <p className="text-[11px] leading-relaxed text-mute">
                  À l’expiration, l’accès au QCM est bloqué immédiatement. Vous pourrez
                  transmettre un nouveau justificatif pour le mois suivant.
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-3 border border-hairline-soft p-5">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-ash" strokeWidth={1.5} aria-hidden="true" />
              <div>
                <p className="text-[12px] font-medium text-ink">Conseil du docteur</p>
                <p className="mt-1 text-[12px] leading-relaxed text-mute">
                  Ne visez pas seulement le score. Lisez chaque explication, même quand la
                  réponse est juste.
                </p>
              </div>
            </div>

            {attempts.length > 0 && (
              <div className="mt-4 flex items-center gap-2 px-1 text-[11px] text-mute">
                <TrendingUp className="size-3.5" aria-hidden="true" />
                {average >= 10
                  ? `Vous êtes à ${average.toFixed(1).replace('.', ',')} de moyenne ce mois-ci.`
                  : 'Chaque explication relue fait progresser votre moyenne.'}
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}
