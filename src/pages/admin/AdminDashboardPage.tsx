import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FileText,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getPublishedSubjects } from '@/lib/db'
import { ButtonLink } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import { cn, daysLeft, formatDate, formatDateLong, isExpired } from '@/lib/utils'

type StudentState = 'active' | 'expiring' | 'expired' | 'pending' | 'rejected'

function getStudentState(expiresAt?: string, status?: string): StudentState {
  if (status === 'pending') return 'pending'
  if (status === 'rejected') return 'rejected'
  if (isExpired(expiresAt)) return 'expired'
  if (daysLeft(expiresAt) <= 7) return 'expiring'
  return 'active'
}

export default function AdminDashboardPage() {
  const { user, db } = useAuth()
  usePageTitle('Vue d’ensemble — Espace docteur')

  const students = db.users.filter((account) => account.role === 'student')
  const studentCounts = students.reduce(
    (acc, student) => {
      acc[getStudentState(student.expiresAt, student.status)] += 1
      return acc
    },
    { active: 0, expiring: 0, expired: 0, pending: 0, rejected: 0 } as Record<StudentState, number>,
  )

  const pending = db.requests
    .filter((request) => request.status === 'pending')
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))

  const subjects = getPublishedSubjects(db)
  const latestSubject = subjects[subjects.length - 1]
  const questionCount = subjects.reduce((total, item) => total + item.questionCount, 0)
  const openAssignments = db.assignments.filter(
    (assignment) => !isExpired(assignment.expiresAt),
  ).length

  const statusLinks: Array<{ state: StudentState; label: string; note: string; dot: string }> = [
    { state: 'active', label: 'Actifs', note: 'Accès en cours', dot: 'bg-success' },
    { state: 'expiring', label: 'Expirent bientôt', note: '7 jours ou moins', dot: 'bg-warning' },
    { state: 'expired', label: 'Expirés', note: 'Renouvellement requis', dot: 'bg-stone' },
    { state: 'pending', label: 'En attente', note: 'Reçu à vérifier', dot: 'bg-accent' },
    { state: 'rejected', label: 'Suspendus', note: 'Accès fermé', dot: 'bg-sale' },
  ]

  return (
    <>
      <section className="border-b border-hairline-soft">
        <div className="mx-auto max-w-content px-4 py-8 sm:px-8 sm:py-9 lg:px-12">
          <h1 className="display text-[clamp(2.75rem,6vw,4.5rem)]">Vue d’ensemble.</h1>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-mute">
            {user ? `Bonjour ${user.firstName}. ` : ''}
            {pending.length > 0
              ? `${pending.length} dossier${pending.length > 1 ? 's attendent' : ' attend'} votre vérification.`
              : 'Aucun dossier en attente.'}{' '}
            Suivez aussi les accès étudiants.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-content gap-10 px-4 py-9 sm:px-8 sm:py-11 lg:grid-cols-12 lg:gap-12 lg:px-12">
        <section className="lg:col-span-8">
          <div className="flex items-end justify-between gap-4 border-b border-hairline pb-4">
            <div>
              <h2 className="text-[22px] font-medium tracking-[-0.01em]">Demandes à traiter</h2>
              <p className="mt-1 text-[11px] text-mute">
                Ouvrez le reçu avant d’accepter ou de refuser un dossier.
              </p>
            </div>
            <Link
              to="/admin/demandes"
              className="group inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-charcoal hover:text-ink"
            >
              Tout voir
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {pending.length > 0 ? (
            <div>
              {pending.slice(0, 5).map((request) => (
                <Link
                  key={request.id}
                  to={`/admin/demandes?request=${request.id}`}
                  className="group flex items-center gap-3 border-b border-hairline py-4 transition-colors hover:bg-cloud sm:gap-4 sm:px-2"
                >
                  <div className="h-12 w-9 shrink-0 overflow-hidden bg-cloud">
                    {request.receipt.mime === 'application/pdf' ? (
                      <div className="grid h-full place-items-center bg-accent text-white">
                        <FileText className="size-4" strokeWidth={1.5} />
                      </div>
                    ) : (
                      <img
                        src={request.receipt.dataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">{request.userName}</p>
                    <p className="mt-0.5 truncate text-[10px] text-mute">{request.userEmail}</p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-[10px] font-medium text-charcoal">
                      {request.type === 'renewal' ? 'Renouvellement' : 'Premier accès'}
                    </p>
                    <p className="mt-0.5 text-[10px] text-mute">
                      {formatDate(request.createdAt, { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                  <span className="hidden shrink-0 items-center gap-1.5 border border-hairline px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-charcoal sm:inline-flex">
                    <span className="size-1.5 rounded-full bg-warning" />
                    À vérifier
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-stone transition-colors group-hover:text-ink" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-3 border-b border-hairline py-10">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e9f5ee] text-success">
                <ShieldAlert className="size-4" strokeWidth={1.8} />
              </span>
              <div>
                <p className="text-[14px] font-medium">Aucune demande en attente.</p>
                <p className="mt-1 text-[12px] text-mute">
                  Les nouveaux justificatifs apparaîtront ici automatiquement.
                </p>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-6 lg:col-span-4">
          <section>
            <div className="flex items-end justify-between gap-3 border-b border-hairline pb-4">
              <div>
                <h2 className="text-[18px] font-medium tracking-[-0.01em]">Suivi des étudiants</h2>
                <p className="mt-1 text-[10px] text-mute">Filtrer par état d’accès</p>
              </div>
            </div>
            <div>
              {statusLinks.map((item) => (
                <Link
                  key={item.state}
                  to={`/admin/etudiants?statut=${item.state}`}
                  className="group flex items-center gap-3 border-b border-hairline py-3.5 transition-colors hover:bg-cloud sm:px-2"
                >
                  <span className={cn('size-1.5 shrink-0 rounded-full', item.dot)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium text-ink">{item.label}</span>
                    <span className="mt-0.5 block text-[9px] text-mute">{item.note}</span>
                  </span>
                  <span className="display text-[1.35rem] leading-none">
                    {studentCounts[item.state]}
                  </span>
                  <ArrowRight className="size-3 text-stone transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              ))}
            </div>
            <Link
              to="/admin/etudiants"
              className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-medium text-charcoal hover:text-ink"
            >
              Tous les étudiants
              <ArrowRight className="size-3" />
            </Link>
          </section>

          <section className="bg-accent p-6 text-white">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/50">
                Parcours QCM
              </p>
              <BookOpen className="size-4 text-white/50" strokeWidth={1.5} aria-hidden="true" />
            </div>
            {subjects.length > 0 ? (
              <>
                <p className="mt-4 text-[15px] font-medium leading-snug">
                  {subjects.length} sujet{subjects.length > 1 ? 's' : ''} en file
                </p>
                <p className="mt-1 text-[10px] text-white/50">
                  Le prochain sujet non fait est attribué automatiquement.
                </p>
                <dl className="mt-5 space-y-2 border-t border-white/15 pt-4 text-[10px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-white/50">Questions disponibles</dt>
                    <dd>{questionCount}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-white/50">Cycles ouverts</dt>
                    <dd>{openAssignments}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-white/50">Dernier ajout</dt>
                    <dd>{formatDate(latestSubject.publishedAt)}</dd>
                  </div>
                </dl>
                <ButtonLink to="/admin/sujet" variant="white" size="sm" className="mt-5 w-full">
                  Gérer la file
                </ButtonLink>
              </>
            ) : (
              <>
                <p className="mt-4 text-[15px] font-medium leading-snug">
                  La file de sujets est vide.
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-white/60">
                  Ajoutez un premier sujet avant d’accepter une demande.
                </p>
                <ButtonLink to="/admin/sujet" variant="white" size="sm" className="mt-5 w-full">
                  Ajouter un sujet
                </ButtonLink>
              </>
            )}
          </section>

          <p className="text-[10px] leading-relaxed text-mute">
            Dernier ajout&nbsp;:{' '}
            {latestSubject ? formatDateLong(latestSubject.publishedAt) : 'aucun pour le moment'}.
          </p>
        </aside>
      </div>
    </>
  )
}
