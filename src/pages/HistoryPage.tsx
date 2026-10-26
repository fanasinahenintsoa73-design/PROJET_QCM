import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, History, Target } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getActiveAssignment } from '@/lib/db'
import { ButtonLink } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { usePageTitle } from '@/components/Layouts'
import { cn, formatDate, formatDateTime, relativeDate, scoreTone } from '@/lib/utils'

export default function HistoryPage() {
  usePageTitle('Historique')
  const { user, db } = useAuth()
  const [filter, setFilter] = useState('all')
  const assignment = user ? getActiveAssignment(user.id, db) : undefined
  const activeSubject = assignment
    ? db.subjects.find((subject) => subject.id === assignment.subjectId)
    : undefined

  const attempts = useMemo(
    () =>
      db.attempts
        .filter((attempt) => attempt.userId === user?.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [db.attempts, user?.id],
  )

  const subjects = useMemo(
    () =>
      db.subjects.filter((subject) =>
        attempts.some((attempt) => attempt.subjectId === subject.id),
      ),
    [attempts, db.subjects],
  )

  const visible =
    filter === 'all'
      ? attempts
      : attempts.filter((attempt) => attempt.subjectId === filter)

  const totalQuestions = attempts.reduce((sum, attempt) => sum + attempt.total, 0)
  const average = attempts.length
    ? Math.round((attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length) * 10) / 10
    : 0
  const best = attempts.reduce((max, attempt) => Math.max(max, attempt.score), 0)

  return (
    <div className="bg-canvas">
      <section className="border-b border-hairline-soft">
        <div className="mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-12 lg:px-12">
          <div className="flex flex-wrap items-end justify-between gap-7">
            <div>
              <p className="eyebrow">Historique</p>
              <h1 className="display mt-4 text-[clamp(3rem,6.5vw,5rem)]">
                Chaque série
                <br />
                compte.
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mute">
                Retrouvez tous vos résultats et rouvrez le corrigé détaillé de chaque série.
                Vos réponses restent disponibles sur cet appareil.
              </p>
            </div>

            {attempts.length > 0 && (
              <div className="grid grid-cols-3 gap-5 border-t border-hairline pt-5 sm:gap-8">
                <div>
                  <p className="eyebrow">Séries</p>
                  <p className="display mt-2 text-[2.1rem] leading-none">{attempts.length}</p>
                </div>
                <div className="border-l border-hairline pl-5 sm:pl-8">
                  <p className="eyebrow">Moyenne</p>
                  <p className="display mt-2 text-[2.1rem] leading-none">
                    {average.toFixed(1).replace('.', ',')}
                  </p>
                </div>
                <div className="border-l border-hairline pl-5 sm:pl-8">
                  <p className="eyebrow">Record</p>
                  <p className="display mt-2 text-[2.1rem] leading-none">{best}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-12 lg:px-12">
          {attempts.length === 0 ? (
            <div className="border-y border-hairline py-14 sm:py-20">
              <div className="max-w-xl">
                <div className="grid size-12 place-items-center bg-cloud">
                  <History className="size-5 text-ash" strokeWidth={1.5} aria-hidden="true" />
                </div>
                <h2 className="display mt-6 text-[clamp(2.4rem,5vw,3.4rem)]">
                  Rien à relire pour l’instant.
                </h2>
                <p className="mt-3 text-[14px] leading-relaxed text-mute">
                  Terminez votre première série de 20 QCM pour retrouver ici votre score et le
                  corrigé médical complet.
                </p>
                {activeSubject ? (
                  <ButtonLink to="/app/entrainement" variant="primary" className="mt-6 gap-2">
                    Démarrer une série de 20 QCM
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </ButtonLink>
                ) : (
                  <p className="mt-6 text-[12px] text-mute">
                    Aucun sujet ne vous est attribué pour le moment.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    aria-pressed={filter === 'all'}
                    className={cn(
                      'h-9 rounded-full border px-4 text-[12px] font-medium transition-colors',
                      filter === 'all'
                        ? 'border-ink bg-ink text-white'
                        : 'border-hairline bg-white text-charcoal hover:border-stone',
                    )}
                  >
                    Toutes les séries
                  </button>
                  {subjects.map((subject) => (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => setFilter(subject.id)}
                      aria-pressed={filter === subject.id}
                      className={cn(
                        'h-9 rounded-full border px-4 text-[12px] font-medium transition-colors',
                        filter === subject.id
                          ? 'border-ink bg-ink text-white'
                          : 'border-hairline bg-white text-charcoal hover:border-stone',
                      )}
                    >
                      {subject.monthLabel}
                    </button>
                  ))}
                </div>
                {activeSubject && (
                  <ButtonLink
                    to="/app/entrainement"
                    variant="primary"
                    size="sm"
                    className="gap-2"
                  >
                    Nouvelle série
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </ButtonLink>
                )}
              </div>

              <div className="hidden grid-cols-12 gap-4 border-b border-hairline-soft py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-mute sm:grid">
                <p className="col-span-3">Date</p>
                <p className="col-span-5">Sujet</p>
                <p className="col-span-2">Score</p>
                <p className="col-span-2 text-right">Corrigé</p>
              </div>

              <div>
                {visible.map((attempt) => {
                  const subject = db.subjects.find((item) => item.id === attempt.subjectId)
                  const percent = Math.round((attempt.score / attempt.total) * 100)
                  const tone = scoreTone(attempt.score, attempt.total)
                  return (
                    <Link
                      key={attempt.id}
                      to={`/app/resultat/${attempt.id}`}
                      className="group grid grid-cols-12 items-center gap-3 border-b border-hairline py-4 transition-colors hover:bg-cloud sm:gap-4 sm:px-2"
                    >
                      <div className="col-span-8 sm:col-span-3">
                        <p className="text-[13px] font-medium text-ink">
                          {formatDate(attempt.createdAt, {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="mt-0.5 text-[10px] text-mute">
                          {relativeDate(attempt.createdAt)}
                        </p>
                      </div>

                      <div className="col-span-12 order-last min-w-0 sm:order-none sm:col-span-5">
                        <p className="truncate text-[13px] text-charcoal">
                          {subject?.title ?? 'Sujet archivé'}
                        </p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-mute">
                          {subject?.monthLabel ?? '—'} · {attempt.total} questions
                        </p>
                      </div>

                      <div className="col-span-4 flex items-center justify-end gap-3 sm:col-span-2 sm:block">
                        <p className="flex items-baseline gap-1 sm:justify-start">
                          <span className="text-[17px] font-medium tabular-nums text-ink">
                            {attempt.score}
                          </span>
                          <span className="text-[10px] text-mute">/20</span>
                        </p>
                        <div className="hidden items-center gap-2 sm:mt-1.5 sm:flex">
                          <ProgressBar value={percent} className="h-px w-12" />
                          <span
                            className={cn(
                              'text-[9px] uppercase tracking-[0.08em]',
                              tone === 'excellent' || tone === 'solide'
                                ? 'text-success'
                                : tone === 'à reprendre'
                                  ? 'text-sale'
                                  : 'text-mute',
                            )}
                          >
                            {percent} %
                          </span>
                        </div>
                      </div>

                      <div className="hidden items-center justify-end gap-2 sm:col-span-2 sm:flex">
                        <span className="text-[11px] font-medium text-ink">Voir</span>
                        <ArrowUpRight
                          className="size-4 text-stone transition-colors group-hover:text-ink"
                          aria-hidden="true"
                        />
                      </div>
                    </Link>
                  )
                })}
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-[11px] text-mute">
                <p className="flex items-center gap-2">
                  <Target className="size-3.5" aria-hidden="true" />
                  {visible.length} série{visible.length > 1 ? 's' : ''} affichée
                  {visible.length > 1 ? 's' : ''} · {totalQuestions} questions travaillées au
                  total
                </p>
                <p>
                  Dernière activité :{' '}
                  {attempts[0] ? formatDateTime(attempts[0].createdAt) : '—'}
                </p>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
