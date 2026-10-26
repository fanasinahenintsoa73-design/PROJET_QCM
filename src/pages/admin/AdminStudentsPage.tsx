import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getActiveAssignment, getLatestAssignment, revokeAccess } from '@/lib/db'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Field'
import { StatusPill } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/Toast'
import { usePageTitle } from '@/components/Layouts'
import {
  cn,
  daysLeft,
  formatDate,
  formatDateLong,
  fullName,
  initials,
  isExpired,
} from '@/lib/utils'
import type { User } from '@/types'

type StudentFilter = 'all' | 'active' | 'expiring' | 'expired' | 'pending' | 'rejected'

function getStudentState(student: User): Exclude<StudentFilter, 'all'> {
  if (student.status === 'pending') return 'pending'
  if (student.status === 'rejected') return 'rejected'
  if (isExpired(student.expiresAt)) return 'expired'
  if (daysLeft(student.expiresAt) <= 7) return 'expiring'
  return 'active'
}

function stateLabel(state: Exclude<StudentFilter, 'all'>) {
  switch (state) {
    case 'active':
      return { tone: 'success' as const, label: 'Actif' }
    case 'expiring':
      return { tone: 'warning' as const, label: 'Expire bientôt' }
    case 'expired':
      return { tone: 'error' as const, label: 'Expiré' }
    case 'pending':
      return { tone: 'warning' as const, label: 'En attente' }
    case 'rejected':
      return { tone: 'error' as const, label: 'Suspendu' }
  }
}

const filters: { value: StudentFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'expiring', label: 'Bientôt expirés' },
  { value: 'expired', label: 'Expirés' },
  { value: 'pending', label: 'En attente' },
  { value: 'rejected', label: 'Suspendus' },
]

export default function AdminStudentsPage() {
  usePageTitle('Étudiants — Espace docteur')
  const { db } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const filterParam = searchParams.get('statut')
  const filter: StudentFilter = filters.some((item) => item.value === filterParam)
    ? (filterParam as StudentFilter)
    : 'all'
  const setFilter = (next: StudentFilter) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'all') params.delete('statut')
    else params.set('statut', next)
    setSearchParams(params, { replace: true })
  }
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<User | null>(null)
  const [suspending, setSuspending] = useState<User | null>(null)
  const [reason, setReason] = useState('')

  const subjectForStudent = (studentId: string) => {
    const assignment =
      getActiveAssignment(studentId, db) ?? getLatestAssignment(studentId, db)
    return assignment
      ? db.subjects.find((subject) => subject.id === assignment.subjectId)
      : undefined
  }

  const students = useMemo(
    () => db.users.filter((candidate) => candidate.role === 'student'),
    [db.users],
  )

  const counts = useMemo(() => {
    const result: Record<StudentFilter, number> = {
      all: students.length,
      active: 0,
      expiring: 0,
      expired: 0,
      pending: 0,
      rejected: 0,
    }
    students.forEach((student) => {
      const state = getStudentState(student)
      result[state] += 1
    })
    return result
  }, [students])

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return students
      .filter((student) => {
        if (filter === 'all') return true
        return getStudentState(student) === filter
      })
      .filter(
        (student) =>
          !term ||
          fullName(student.firstName, student.lastName).toLowerCase().includes(term) ||
          student.email.toLowerCase().includes(term),
      )
      .sort((a, b) => {
        const order: Record<string, number> = {
          pending: 0,
          expiring: 1,
          active: 2,
          expired: 3,
          rejected: 4,
        }
        const diff = order[getStudentState(a)] - order[getStudentState(b)]
        if (diff !== 0) return diff
        return a.lastName.localeCompare(b.lastName, 'fr')
      })
  }, [filter, query, students])

  const handleSuspend = () => {
    if (!suspending) return
    try {
      revokeAccess(suspending.id, reason.trim() || 'Accès suspendu par le docteur.')
      toast(`L’accès de ${suspending.firstName} a été suspendu.`, 'info')
      setSuspending(null)
      setSelected(null)
      setReason('')
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Suspension impossible.', 'error')
    }
  }

  return (
    <div className="bg-canvas">
      <section className="border-b border-hairline-soft">
        <div className="mx-auto max-w-content px-4 py-8 sm:px-8 sm:py-9 lg:px-12">
          <h1 className="display text-[clamp(2.8rem,6vw,4.5rem)]">Étudiants.</h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-mute">
            Filtrez par état d’accès, ouvrez une fiche et gérez les comptes. Une validation ouvre
            30 jours à compter du jour du traitement.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-content px-4 py-7 sm:px-8 sm:py-9 lg:px-12">
          <div className="mb-3">
            <p className="text-[11px] font-medium text-charcoal">Filtrer par statut</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="no-scrollbar flex max-w-full flex-wrap items-center gap-2">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  aria-pressed={filter === item.value}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[12px] font-medium transition-colors',
                    filter === item.value
                      ? 'border-ink bg-ink text-white'
                      : 'border-hairline bg-white text-charcoal hover:border-stone',
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      'text-[10px]',
                      filter === item.value ? 'text-white/50' : 'text-stone',
                    )}
                  >
                    {counts[item.value]}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-auto">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-mute"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nom ou email…"
                aria-label="Rechercher un étudiant"
                className="h-10 w-full rounded-full border border-hairline bg-white pl-10 pr-4 text-[12px] text-ink outline-none transition focus:border-ink focus:ring-4 focus:ring-cloud sm:w-[250px]"
              />
            </div>
          </div>

          <div className="mt-5 border-t border-hairline lg:hidden">
            {rows.map((student) => {
              const state = getStudentState(student)
              const status = stateLabel(state)
              const attempts = db.attempts.filter((attempt) => attempt.userId === student.id)
              const average = attempts.length
                ? attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length
                : 0
              const pendingRequest = db.requests.find(
                (request) =>
                  request.userId === student.id && request.status === 'pending',
              )
              const assignedSubject = subjectForStudent(student.id)
              return (
                <article key={student.id} className="border-b border-hairline py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cloud text-[10px] font-semibold text-ink">
                        {initials(student.firstName, student.lastName)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-ink">
                          {fullName(student.firstName, student.lastName)}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-mute">{student.email}</p>
                        {pendingRequest && (
                          <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-[#8a5300]">
                            {pendingRequest.type === 'renewal'
                              ? 'Renouvellement à traiter'
                              : 'Première demande à traiter'}
                          </p>
                        )}
                      </div>
                    </div>
                    <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-hairline-soft pt-4">
                    <div>
                      <dt className="text-[9px] uppercase tracking-[0.12em] text-mute">
                        Période d’accès
                      </dt>
                      <dd className="mt-1 text-[11px] text-charcoal">
                        {student.activatedAt && student.expiresAt ? (
                          <>
                            {formatDate(student.activatedAt)} → {formatDate(student.expiresAt)}
                            <span
                              className={cn(
                                'mt-0.5 block text-[10px]',
                                state === 'expired'
                                  ? 'text-sale'
                                  : state === 'expiring'
                                    ? 'text-[#8a5300]'
                                    : 'text-mute',
                              )}
                            >
                              {state === 'expired'
                                ? `Expiré depuis le ${formatDate(student.expiresAt)}`
                                : `${daysLeft(student.expiresAt)} jours restants`}
                            </span>
                          </>
                        ) : (
                          <span className="text-mute">Pas encore activé</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[9px] uppercase tracking-[0.12em] text-mute">Séries</dt>
                      <dd className="mt-1 text-[11px] text-charcoal">
                        {attempts.length ? (
                          <>
                            {attempts.length} série{attempts.length > 1 ? 's' : ''}
                            <span className="mt-0.5 block text-[10px] text-mute">
                              Moy. {average.toFixed(1).replace('.', ',')}/20
                            </span>
                          </>
                        ) : (
                          <span className="text-mute">—</span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-hairline-soft pt-3">
                    <span className="text-[9px] uppercase tracking-[0.12em] text-mute">
                      Sujet
                    </span>
                    <span className="min-w-0 truncate text-[11px] font-medium text-charcoal">
                      {assignedSubject?.title ?? 'Aucun sujet attribué'}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    {pendingRequest ? (
                      <Link
                        to={`/admin/demandes?request=${pendingRequest.id}`}
                        className="text-[11px] font-medium underline decoration-1 underline-offset-4"
                      >
                        Voir la demande
                      </Link>
                    ) : (
                      <span className="text-[10px] text-stone">
                        Inscrit le {formatDate(student.createdAt)}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-hairline text-[11px]"
                      onClick={() => setSelected(student)}
                    >
                      Gérer
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="mt-5 hidden overflow-x-auto border-t border-hairline lg:block">
            <table className="w-full min-w-[1000px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline">
                  {[
                    'Étudiant',
                    'Email',
                    'Inscription',
                    'Période d’accès',
                    'Sujet',
                    'Statut',
                    'Séries',
                    'Actions',
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className={cn(
                        'py-3 pr-4 text-[9px] font-semibold uppercase tracking-[0.14em] text-mute',
                        heading === 'Actions' && 'pr-0 text-right',
                      )}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((student) => {
                  const state = getStudentState(student)
                  const status = stateLabel(state)
                  const attempts = db.attempts.filter((attempt) => attempt.userId === student.id)
                  const average = attempts.length
                    ? attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length
                    : 0
                  const pendingRequest = db.requests.find(
                    (request) =>
                      request.userId === student.id && request.status === 'pending',
                  )
                  const assignedSubject = subjectForStudent(student.id)
                  return (
                    <tr
                      key={student.id}
                      className="border-b border-hairline transition-colors hover:bg-cloud/70"
                    >
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cloud text-[10px] font-semibold text-ink">
                            {initials(student.firstName, student.lastName)}
                          </span>
                          <div className="min-w-0">
                            <p className="whitespace-nowrap text-[13px] font-medium text-ink">
                              {fullName(student.firstName, student.lastName)}
                            </p>
                            {pendingRequest && (
                              <p className="mt-0.5 text-[9px] uppercase tracking-[0.08em] text-[#8a5300]">
                                {pendingRequest.type === 'renewal'
                                  ? 'Renouvellement à traiter'
                                  : 'Première demande à traiter'}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <p className="max-w-[210px] truncate text-[12px] text-charcoal">
                          {student.email}
                        </p>
                      </td>
                      <td className="whitespace-nowrap py-4 pr-4 text-[11px] text-charcoal">
                        {formatDate(student.createdAt)}
                      </td>
                      <td className="whitespace-nowrap py-4 pr-4">
                        {student.activatedAt && student.expiresAt ? (
                          <>
                            <p className="text-[11px] text-charcoal">
                              {formatDate(student.activatedAt)} → {formatDate(student.expiresAt)}
                            </p>
                            <p
                              className={cn(
                                'mt-0.5 text-[10px]',
                                state === 'expired'
                                  ? 'text-sale'
                                  : state === 'expiring'
                                    ? 'text-[#8a5300]'
                                    : 'text-mute',
                              )}
                            >
                              {state === 'expired'
                                ? `Expiré depuis le ${formatDate(student.expiresAt)}`
                                : `${daysLeft(student.expiresAt)} jours restants`}
                            </p>
                          </>
                        ) : (
                          <p className="text-[11px] text-mute">Pas encore activé</p>
                        )}
                      </td>
                      <td className="py-4 pr-4">
                        <p className="max-w-[180px] truncate text-[11px] font-medium text-charcoal">
                          {assignedSubject?.title ?? 'Aucun sujet'}
                        </p>
                        {assignedSubject && (
                          <p className="mt-0.5 text-[10px] text-mute">
                            {assignedSubject.monthLabel}
                          </p>
                        )}
                      </td>
                      <td className="py-4 pr-4">
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      </td>
                      <td className="whitespace-nowrap py-4 pr-4">
                        {attempts.length ? (
                          <>
                            <p className="text-[12px] font-medium">{attempts.length}</p>
                            <p className="mt-0.5 text-[10px] text-mute">
                              Moy. {average.toFixed(1).replace('.', ',')}/20
                            </p>
                          </>
                        ) : (
                          <p className="text-[11px] text-mute">—</p>
                        )}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {pendingRequest && (
                            <Link
                              to={`/admin/demandes?request=${pendingRequest.id}`}
                              className="text-[11px] font-medium underline decoration-1 underline-offset-4"
                            >
                              Demande
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelected(student)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-mute transition-colors hover:text-ink"
                          >
                            Gérer
                            <ArrowUpRight className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center border-t border-hairline py-16 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-cloud">
                <Search className="size-4 text-ash" strokeWidth={1.5} />
              </span>
              <p className="mt-4 text-[15px] font-medium">Aucun étudiant trouvé.</p>
              <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-mute">
                Modifiez le filtre ou la recherche pour retrouver un compte.
              </p>
            </div>
          )}

          <p className="mt-5 flex items-start gap-2 text-[10px] leading-relaxed text-mute">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Les comptes expirés ne peuvent plus charger de questions. Leur renouvellement passe
            obligatoirement par un nouveau justificatif et une validation manuelle.
          </p>
        </div>
      </section>

      {/* Student detail */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        size="md"
        eyebrow="Fiche étudiant"
        title={
          selected ? fullName(selected.firstName, selected.lastName) : 'Fiche étudiant'
        }
        footer={
          selected ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelected(null)}
              >
                Fermer
              </Button>
              {(getStudentState(selected) === 'active' ||
                getStudentState(selected) === 'expiring') && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 border-hairline hover:border-sale hover:bg-[#fdecec] hover:text-sale"
                  onClick={() => {
                    setSuspending(selected)
                    setReason('')
                    setSelected(null)
                  }}
                >
                  <Ban className="size-3.5" aria-hidden="true" />
                  Suspendre l’accès
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {selected && (
          <StudentDetails
            student={selected}
            subjectTitle={subjectForStudent(selected.id)?.title}
            attempts={db.attempts.filter((attempt) => attempt.userId === selected.id).length}
            pendingRequestId={
              db.requests.find(
                (request) =>
                  request.userId === selected.id && request.status === 'pending',
              )?.id
            }
          />
        )}
      </Modal>

      {/* Suspension */}
      <Modal
        open={Boolean(suspending)}
        onClose={() => setSuspending(null)}
        size="sm"
        eyebrow="Suspension"
        title={
          suspending
            ? `Suspendre ${suspending.firstName} ?`
            : 'Suspendre cet accès'
        }
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSuspending(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleSuspend}
              className="gap-2"
            >
              <Ban className="size-3.5" aria-hidden="true" />
              Suspendre
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-[#fff5f5] px-3.5 py-3 text-[11px] leading-relaxed text-charcoal">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-sale" aria-hidden="true" />
            <p>
              L’accès au QCM sera coupé immédiatement. L’étudiant devra transmettre un nouveau
              justificatif pour être réactivé.
            </p>
          </div>
          <div>
            <label htmlFor="suspension-reason" className="form-label mb-2 block">
              Motif (facultatif)
            </label>
            <Textarea
              id="suspension-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex. Justificatif non conforme ou accès partagé."
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

function StudentDetails({
  student,
  subjectTitle,
  attempts,
  pendingRequestId,
}: {
  student: User
  subjectTitle?: string
  attempts: number
  pendingRequestId?: string
}) {
  const state = getStudentState(student)
  const status = stateLabel(state)
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] text-charcoal">{student.email}</p>
          <p className="mt-1 text-[11px] text-mute">
            Inscrit le {formatDateLong(student.createdAt)}
          </p>
        </div>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </div>

      <dl className="grid grid-cols-2 gap-px border border-hairline-soft bg-hairline-soft text-[11px]">
        <div className="bg-white p-3">
          <dt className="text-mute">Activation</dt>
          <dd className="mt-1 font-medium">
            {student.activatedAt ? formatDateLong(student.activatedAt) : '—'}
          </dd>
        </div>
        <div className="bg-white p-3">
          <dt className="text-mute">Fin d’accès</dt>
          <dd className="mt-1 font-medium">
            {student.expiresAt ? formatDateLong(student.expiresAt) : '—'}
          </dd>
        </div>
        <div className="bg-white p-3">
          <dt className="text-mute">Séries réalisées</dt>
          <dd className="mt-1 font-medium">{attempts}</dd>
        </div>
        <div className="bg-white p-3">
          <dt className="text-mute">Jours restants</dt>
          <dd className="mt-1 font-medium">
            {state === 'expired' || state === 'pending' || state === 'rejected'
              ? '0'
              : daysLeft(student.expiresAt)}
          </dd>
        </div>
        <div className="col-span-2 bg-white p-3">
          <dt className="text-mute">Sujet attribué</dt>
          <dd className="mt-1 font-medium">{subjectTitle ?? 'Aucun sujet'}</dd>
        </div>
      </dl>

      {student.rejectionReason && (
        <div className="border-l-2 border-sale bg-[#fff5f5] px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sale">
            Motif de suspension
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-charcoal">
            {student.rejectionReason}
          </p>
        </div>
      )}

      {pendingRequestId && (
        <div className="flex items-center justify-between gap-3 bg-cloud px-3.5 py-3">
          <p className="text-[11px] leading-relaxed text-charcoal">
            Une demande de renouvellement attend une vérification.
          </p>
          <Link
            to={`/admin/demandes?request=${pendingRequestId}`}
            className="shrink-0 text-[11px] font-medium underline decoration-1 underline-offset-4"
          >
            Examiner
          </Link>
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-mute">
        Les décisions d’activation et de refus se prennent depuis la page Demandes, après
        vérification du justificatif.
      </p>
    </div>
  )
}
