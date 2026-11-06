import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Ticket } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { getPublishedSubjects } from '@/lib/db'
import { usePageTitle } from '@/components/Layouts'
import { cn } from '@/lib/utils'
import type { TicketItem } from '@/types'

export default function AdminDashboardPage() {
  const { user, db } = useAuth()
  usePageTitle('Page d’accueil — Espace docteur')

  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [ticketsError, setTicketsError] = useState('')

  useEffect(() => {
    api
      .listTickets()
      .then(setTickets)
      .catch((err) => {
        setTicketsError(err instanceof Error ? err.message : 'Les tickets n’ont pas pu être chargés.')
      })
  }, [])

  const subjects = getPublishedSubjects(db)
  const questionCount = subjects.reduce((total, item) => total + item.questionCount, 0)

  const counts = {
    available: tickets.filter((item) => item.status === 'available' && item.seriesUsed < 30).length,
    inProgress: tickets.filter(
      (item) => item.status !== 'suspended' && item.seriesUsed < 30 && (item.status === 'used' || item.usedAt),
    ).length,
    finished: tickets.filter((item) => item.seriesUsed >= 30).length,
    suspended: tickets.filter((item) => item.status === 'suspended').length,
  }

  const ticketLinks = [
    { key: 'available', label: 'Disponibles', note: 'Pas encore utilisés', dot: 'bg-success', count: counts.available },
    { key: 'inProgress', label: 'En cours', note: 'Séries en cours', dot: 'bg-info', count: counts.inProgress },
    { key: 'finished', label: 'Terminés', note: '30 séries terminées', dot: 'bg-stone', count: counts.finished },
    { key: 'suspended', label: 'Suspendus', note: 'Accès fermé', dot: 'bg-sale', count: counts.suspended },
  ] as const

  return (
    <>
      <section className="border-b border-hairline-soft">
        <div className="mx-auto max-w-content px-4 py-8 sm:px-8 sm:py-9 lg:px-12">
          <h1 className="display text-[clamp(2.75rem,6vw,4.5rem)]">Page d’accueil.</h1>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-mute">
            {user ? `Bonjour ${user.firstName}. ` : ''}
            {tickets.length > 0
              ? `${tickets.length} ticket${tickets.length > 1 ? 's' : ''} créé${tickets.length > 1 ? 's' : ''} au total. `
              : 'Générez vos premiers tickets d’accès. '}
            Suivez aussi les sujets publiés.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-content gap-10 px-4 py-9 sm:px-8 sm:py-11 lg:grid-cols-12 lg:gap-12 lg:px-12">
        <section className="lg:col-span-8">
          <div className="flex items-end justify-between gap-4 border-b border-hairline pb-4">
            <div>
              <h2 className="text-[22px] font-medium tracking-[-0.01em]">Tickets quotidiens</h2>
              <p className="mt-1 text-[11px] text-mute">
                Un ticket = un étudiant = 30 séries. Génère, donne en main propre, suspend si besoin.
              </p>
            </div>
            <span className="display shrink-0 text-[1.6rem] leading-none">{tickets.length}</span>
          </div>

          {ticketsError ? (
            <div className="mt-4 rounded-lg border border-sale/20 bg-danger-soft px-4 py-3 text-[13px] text-sale" role="alert">
              {ticketsError}
            </div>
          ) : null}

          <div>
            {ticketLinks.map((item) => (
              <Link
                key={item.key}
                to="/admin/tickets"
                className="group flex items-center gap-3 border-b border-hairline py-3.5 transition-colors hover:bg-cloud sm:px-2"
              >
                <span className={cn('size-1.5 shrink-0 rounded-full', item.dot)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-medium text-ink">{item.label}</span>
                  <span className="mt-0.5 block text-[9px] text-mute">{item.note}</span>
                </span>
                <span className="display text-[1.35rem] leading-none">{item.count}</span>
                <ArrowRight className="size-3 text-stone transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
              </Link>
            ))}
          </div>

          <Link
            to="/admin/tickets"
            className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-medium text-charcoal hover:text-ink"
          >
            <Ticket className="size-3" />
            Gérer les tickets
          </Link>
        </section>

        <aside className="space-y-6 lg:col-span-4">
          <section>
            <div className="flex items-end justify-between gap-3 border-b border-hairline pb-4">
              <div>
                <h2 className="text-[18px] font-medium tracking-[-0.01em]">Sujets publiés</h2>
                <p className="mt-1 text-[10px] text-mute">Catalogue PACES</p>
              </div>
            </div>
            <dl className="space-y-3 py-5 text-[12px]">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-mute">Thèmes publiés</dt>
                <dd className="font-display text-[1.35rem] leading-none text-ink">{subjects.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-mute">Questions</dt>
                <dd className="font-display text-[1.35rem] leading-none text-ink">{questionCount}</dd>
              </div>
            </dl>
            <Link
              to="/admin/themes"
              className="inline-flex items-center gap-1.5 text-[10px] font-medium text-charcoal hover:text-ink"
            >
              Ouvrir les sujets
              <ArrowRight className="size-3" />
            </Link>
          </section>
        </aside>
      </div>
    </>
  )
}
