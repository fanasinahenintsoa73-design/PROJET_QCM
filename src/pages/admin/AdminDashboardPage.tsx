import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getPublishedSubjects } from '@/lib/db'
import { RequestReview } from '@/components/admin/RequestReview'
import { usePageTitle } from '@/components/Layouts'
import { cn, daysLeft, formatDate, isExpired } from '@/lib/utils'
import type { AccessRequest } from '@/types'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const [preview, setPreview] = useState<AccessRequest | null>(null)
  const requestedId = searchParams.get('request')

  useEffect(() => {
    if (!requestedId) return
    const found = db.requests.find((request) => request.id === requestedId)
    if (found) setPreview(found)
  }, [requestedId, db.requests])

  const closePreview = () => {
    setPreview(null)
    if (requestedId) {
      const next = new URLSearchParams(searchParams)
      next.delete('request')
      setSearchParams(next, { replace: true })
    }
  }

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
            {pending.length > 0 && (
              <span className="display shrink-0 text-[1.6rem] leading-none">{pending.length}</span>
            )}
          </div>

          {pending.length > 0 ? (
            <div>
              {pending.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => setPreview(request)}
                  className="group flex w-full items-center gap-3 border-b border-hairline py-4 text-left transition-colors hover:bg-cloud sm:gap-4 sm:px-2"
                >
                  <div className="h-12 w-9 shrink-0 overflow-hidden bg-cloud">
                    {request.receipt.mime === 'application/pdf' || !request.receipt.dataUrl ? (
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
                </button>
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

        </aside>
      </div>

      <RequestReview request={preview} onClose={closePreview} />
    </>
  )
}
