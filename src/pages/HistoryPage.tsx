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
  usePageTitle('Historique — MEDQCM L1')
  const { user, db } = useAuth()
  const [filter, setFilter] = useState('all')

  const assignment = user ? getActiveAssignment(user.id, db) : undefined
  const activeSubject = assignment
    ? db.subjects.find((subject) => subject.id === assignment.subjectId)
    : undefined

  const attempts = useMemo(() => {
    if (!user) return []
    return db.attempts
      .filter((attempt) => attempt.userId === user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [db.attempts, user])

  const subjects = useMemo(() => {
    const ids = new Set(attempts.map((attempt) => attempt.subjectId))
    return db.subjects.filter((subject) => ids.has(subject.id))
  }, [attempts, db.subjects])

  const visible = filter === 'all' ? attempts : attempts.filter((attempt) => attempt.subjectId === filter)
  const totalQuestions = attempts.reduce((sum, attempt) => sum + attempt.total, 0)
  const average = attempts.length
    ? Math.round((attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length) * 10) / 10
    : 0
  const best = attempts.reduce((max, attempt) => Math.max(max, attempt.score), 0)
  const lastActivity = attempts[0]?.createdAt

  return (
    <div className="bg-canvas">
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-12 lg:px-10">
          <p className="text-[12px] text-mute">Historique</p>
          <h1 className="mt-2 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.04] tracking-[-0.03em] text-ink">
            Chaque série compte.
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-mute">
            Vos réponses et les corrigés restent disponibles pendant et après votre cycle.
          </p>

          <dl className="mt-8 grid max-w-2xl grid-cols-3 border-t border-line pt-5">
            {[
              ['Séries', attempts.length],
              ['Moyenne', attempts.length ? `${average.toFixed(1).replace('.', ',')}/20` : '—'],
              ['Record', attempts.length ? `${best}/20` : '—'],
            ].map(([label, value], index) => (
              <div key={label} className={index > 0 ? 'border-l border-line pl-5' : ''}>
                <dt className="text-[11px] text-mute">{label}</dt>
                <dd className="mt-1 text-[16px] font-medium tabular-nums text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-content px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        {attempts.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-7 sm:p-10">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-accent">
              <History size={19} strokeWidth={1.7} />
            </span>
            <h2 className="mt-5 font-display text-[2rem] leading-[1.08] text-ink">
              Rien à relire pour l’instant.
            </h2>
            <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-mute">
              Votre première série apparaîtra ici dès que vous l’aurez terminée. Vous pourrez
              revoir chaque réponse et son explication.
            </p>
            {activeSubject ? (
              <ButtonLink to="/app/entrainement" className="mt-6">
                Démarrer une série <ArrowRight size={15} />
              </ButtonLink>
            ) : (
              <p className="mt-5 text-[12px] text-mute">
                Aucun sujet actif pour le moment. Votre historique restera accessible.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
              <div>
                <h2 className="text-[18px] font-medium text-ink">Vos séries</h2>
                <p className="mt-1 text-[12px] text-mute">
                  {attempts.length} série{attempts.length > 1 ? 's' : ''} · {totalQuestions} questions
                  travaillées
                </p>
              </div>
              {activeSubject && (
                <ButtonLink to="/app/entrainement" size="sm">
                  Nouvelle série <ArrowRight size={14} />
                </ButtonLink>
              )}
            </div>

            <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={cn(
                  'h-8 shrink-0 rounded-full border px-3.5 text-[11px] font-medium transition',
                  filter === 'all'
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface text-mute hover:border-accent hover:text-accent',
                )}
              >
                Tous les sujets
              </button>
              {subjects.map((subject) => (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => setFilter(subject.id)}
                  className={cn(
                    'h-8 max-w-[240px] shrink-0 truncate rounded-full border px-3.5 text-[11px] font-medium transition',
                    filter === subject.id
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line bg-surface text-mute hover:border-accent hover:text-accent',
                  )}
                >
                  {subject.title}
                </button>
              ))}
            </div>

            <div className="mt-4 hidden grid-cols-12 gap-4 border-b border-line px-1 pb-2 text-[10px] text-mute sm:grid">
              <span className="col-span-3">Date</span>
              <span className="col-span-5">Sujet</span>
              <span className="col-span-2">Score</span>
              <span className="col-span-2 text-right">Corrigé</span>
            </div>

            <div>
              {visible.map((attempt) => {
                const subject = subjects.find((item) => item.id === attempt.subjectId)
                const ratio = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0
                const tone = scoreTone(attempt.score, attempt.total)
                return (
                  <Link
                    key={attempt.id}
                    to={`/app/resultat/${attempt.id}`}
                    className="group grid gap-3 border-b border-line py-4 transition-colors hover:bg-surface sm:grid-cols-12 sm:items-center sm:gap-4 sm:px-1"
                  >
                    <div className="sm:col-span-3">
                      <p className="text-[13px] font-medium text-ink">{formatDate(attempt.createdAt)}</p>
                      <p className="mt-0.5 text-[11px] text-mute">{relativeDate(attempt.createdAt)}</p>
                    </div>
                    <div className="sm:col-span-5">
                      <p className="text-[13px] font-medium text-ink">{subject?.title ?? 'Sujet archivé'}</p>
                      <p className="mt-0.5 text-[11px] text-mute">
                        {subject?.monthLabel ?? '—'} · {attempt.total} questions
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:col-span-2">
                      <span className="text-[15px] font-medium tabular-nums text-ink">
                        {attempt.score}
                        <span className="text-[11px] font-normal text-mute">/{attempt.total}</span>
                      </span>
                      <ProgressBar
                        value={attempt.score}
                        max={attempt.total}
                        className="w-14"
                        barClassName={
                          tone === 'excellent' || tone === 'solide'
                            ? 'bg-accent'
                            : tone === 'à consolider'
                              ? 'bg-warning'
                              : 'bg-sale'
                        }
                      />
                      <span className="text-[10px] text-mute">{ratio}%</span>
                    </div>
                    <div className="flex items-center justify-between text-[12px] sm:col-span-2 sm:justify-end">
                      <span className="text-[11px] text-mute sm:hidden">Voir le corrigé</span>
                      <span className="inline-flex items-center gap-1.5 font-medium text-accent">
                        Voir <ArrowUpRight size={13} />
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-mute">
              <p className="inline-flex items-center gap-2">
                <Target size={13} /> {attempts.length} série{attempts.length > 1 ? 's' : ''} ·{' '}
                {totalQuestions} questions
              </p>
              {lastActivity && <p>Dernière activité : {formatDateTime(lastActivity)}</p>}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
