import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Ticket } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { getPublishedSubjects } from '@/lib/db'
import { usePageTitle } from '@/components/Layouts'
import { cn, isExpired } from '@/lib/utils'
import type { TicketItem, TicketType } from '@/types'

type TicketCounts = {
  available: number
  inProgress: number
  finished: number
  suspended: number
}

function countTickets(tickets: TicketItem[], type: TicketType): TicketCounts {
  const counts: TicketCounts = { available: 0, inProgress: 0, finished: 0, suspended: 0 }
  for (const item of tickets) {
    if (item.type !== type || item.archivedAt) continue
    if (item.status === 'suspended') {
      counts.suspended += 1
      continue
    }
    if (type === 'anki') {
      const expired = isExpired(item.expiresAt ?? undefined)
      const finished = expired || (item.ankiChapters > 0 && item.ankiCompleted >= item.ankiChapters)
      if (finished) counts.finished += 1
      else if (item.ankiChapters > 0) counts.inProgress += 1
      else counts.available += 1
      continue
    }
    if (item.seriesUsed >= 30) counts.finished += 1
    else if (item.status === 'used' || item.usedAt) counts.inProgress += 1
    else counts.available += 1
  }
  return counts
}

function TicketBlock({
  type,
  title,
  description,
  counts,
  activeCount,
  links,
}: {
  type: TicketType
  title: string
  description: string
  counts: TicketCounts
  activeCount: number
  links: readonly { key: keyof TicketCounts; label: string; note: string; dot: string }[]
}) {
  return (
    <section className="border-t border-hairline pt-7 first:border-t-0 first:pt-0">
      <div className="flex items-end justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <h2 className="text-[22px] font-medium tracking-[-0.01em]">{title}</h2>
          <p className="mt-1 max-w-md text-[11px] leading-relaxed text-mute">{description}</p>
        </div>
        <span className="display shrink-0 text-[1.6rem] leading-none">{activeCount}</span>
      </div>

      <div>
        {links.map((item) => (
          <Link
            key={item.key}
            to={`/admin/tickets?type=${type}&statut=${item.key}`}
            className="group flex items-center gap-3 border-b border-hairline py-3.5 transition-colors hover:bg-cloud sm:px-2"
          >
            <span className={cn('size-1.5 shrink-0 rounded-full', item.dot)} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium text-ink">{item.label}</span>
              <span className="mt-0.5 block text-[9px] text-mute">{item.note}</span>
            </span>
            <span className="display text-[1.35rem] leading-none">{counts[item.key]}</span>
            <ArrowRight className="size-3 text-stone transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
          </Link>
        ))}
      </div>

      <Link
        to={`/admin/tickets?type=${type}`}
        className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-medium text-charcoal hover:text-ink"
      >
        <Ticket className="size-3" />
        Gérer les tickets {type === 'series' ? '30 séries' : 'Anki'}
      </Link>
    </section>
  )
}

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

  const seriesCounts = countTickets(tickets, 'series')
  const ankiCounts = countTickets(tickets, 'anki')
  const seriesActive = seriesCounts.available + seriesCounts.inProgress + seriesCounts.finished + seriesCounts.suspended
  const ankiActive = ankiCounts.available + ankiCounts.inProgress + ankiCounts.finished + ankiCounts.suspended

  const seriesLinks = [
    { key: 'available', label: 'Disponibles', note: 'Pas encore utilisés', dot: 'bg-success' },
    { key: 'inProgress', label: 'En cours', note: 'Séries en cours', dot: 'bg-info' },
    { key: 'finished', label: 'Terminés', note: '30 séries terminées', dot: 'bg-stone' },
    { key: 'suspended', label: 'Suspendus', note: 'Accès fermé', dot: 'bg-sale' },
  ] as const

  const ankiLinks = [
    { key: 'available', label: 'Disponibles', note: 'Aucun chapitre choisi', dot: 'bg-success' },
    { key: 'inProgress', label: 'En cours', note: 'Chapitres en cours', dot: 'bg-info' },
    { key: 'finished', label: 'Terminés', note: 'Tous les chapitres terminés', dot: 'bg-stone' },
    { key: 'suspended', label: 'Suspendus', note: 'Accès fermé', dot: 'bg-sale' },
  ] as const

  return (
    <>
      <section className="border-b border-hairline-soft">
        <div className="mx-auto max-w-content px-4 py-8 sm:px-8 sm:py-9 lg:px-12">
          <h1 className="display text-[clamp(2.75rem,6vw,4.5rem)]">Page d’accueil.</h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-mute">
            {user ? `Bonjour ${user.firstName}. ` : ''}
            Deux parcours séparés : 30 séries et Anki. Chaque ticket est un étudiant. Un ticket
            utilisé ne se supprime pas : il s’archive.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-content gap-10 px-4 py-9 sm:px-8 sm:py-11 lg:grid-cols-12 lg:gap-12 lg:px-12">
        <div className="space-y-9 lg:col-span-8">
          {ticketsError ? (
            <div className="rounded-lg border border-sale/20 bg-danger-soft px-4 py-3 text-[13px] text-sale" role="alert">
              {ticketsError}
            </div>
          ) : null}

          <TicketBlock
            type="series"
            title="30 séries"
            description="Le parcours historique : un ticket, un étudiant, jusqu’à 30 séries. Disponible, en cours, terminé ou suspendu."
            counts={seriesCounts}
            activeCount={seriesActive}
            links={seriesLinks}
          />

          <TicketBlock
            type="anki"
            title="Anki"
            description="Le parcours de révision : jusqu’à 5 chapitres choisis un par un. Le ticket suit les chapitres terminés, pas les séries."
            counts={ankiCounts}
            activeCount={ankiActive}
            links={ankiLinks}
          />
        </div>

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
