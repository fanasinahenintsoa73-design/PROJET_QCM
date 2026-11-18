import { Link } from 'react-router-dom'
import {
  ArrowRight,
  FileText,
  Gamepad2,
  GraduationCap,
  Library,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getSeriesUsage } from '@/lib/db'
import { SERIES_LIMIT } from '@/lib/utils'
import { usePageTitle } from '@/components/Layouts'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusPill } from '@/components/ui/StatusPill'

const entries = [
  {
    to: '/app/pres-concours',
    title: 'Pré-concours',
    description: '10 questions au sort, selon les chapitres ou les matières que tu choisiras',
    icon: GraduationCap,
  },
  {
    to: '/app/medgame',
    title: 'MEDGAME',
    description: 'Choisis une UE ou un chapitre et accède jusqu’au niveau 8.',
    icon: Gamepad2,
  },
  {
    to: '/app/supports',
    title: 'Supports du cours',
    description: 'Les documents de cours déposés par le docteur, à consulter dans l’application.',
    icon: Library,
  },
  {
    to: '/app/sujets',
    title: 'Sujets de concours 2014–2026',
    description: 'Les sujets d’examen classés par année et par UE.',
    icon: FileText,
  },
] as const

export default function DashboardPage() {
  usePageTitle('Mon espace — MEDQCM mada')
  const { user, db } = useAuth()
  const usage = user ? getSeriesUsage(user.id, db) : undefined
  const used = usage?.used ?? 0
  const remaining = usage?.remaining ?? SERIES_LIMIT
  const reached = usage?.reached ?? false

  return (
    <div className="bg-[#f7f8f5]">
      <section className="border-b border-[#e8ece8]">
        <div className="mx-auto max-w-content px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-[clamp(2.4rem,5vw,3.7rem)] leading-[1.02] tracking-[-0.025em] text-ink">
                Bonjour PACES.
              </h1>
            </div>
            <StatusPill tone={reached ? 'warning' : 'success'} dot>
              {reached ? 'Quota atteint' : 'Accès actif'}
            </StatusPill>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-content px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="rounded-[16px] border border-[#e8ece8] bg-surface p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-mute">Quota partagé</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-[1.35rem] leading-none tracking-[-0.02em] text-ink">
                  {used}
                </span>
                <span className="text-[13px] text-mute">/ {SERIES_LIMIT} séries utilisées</span>
              </p>
            </div>
            <p className="text-[12px] text-mute">
              {remaining > 0
                ? `${remaining} série${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`
                : 'Contacte le docteur pour un nouveau ticket'}
            </p>
          </div>
          <ProgressBar
            value={used}
            max={SERIES_LIMIT}
            className="mt-4 h-2"
            trackClassName="bg-cloud"
            barClassName={reached ? 'bg-warning' : 'bg-accent'}
          />
        </div>

        <div className="mt-9 grid gap-5 sm:grid-cols-2">
          {entries.map((entry) => {
            const Icon = entry.icon
            return (
              <Link
                key={entry.to}
                to={entry.to}
                className="group flex min-h-[180px] flex-col justify-between rounded-[16px] border border-[#e8ece8] bg-surface p-6 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-soft sm:p-7"
              >
                <div>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">
                    <Icon size={20} />
                  </span>
                  <h2 className="mt-4 font-display text-[24px] leading-tight tracking-[-0.02em] text-ink">
                    {entry.title}
                  </h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-mute">{entry.description}</p>
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent">
                  Ouvrir <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
