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
    title: 'Pres Concours',
    description: 'Tes séries de 10 questions, ton historique et tes étoiles.',
    icon: GraduationCap,
  },
  {
    to: '/app/medgame',
    title: 'MEDGAME',
    description: 'Choisis une UE, tes chapitres, et franchis les niveaux de 5 questions.',
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
    title: 'Sujets concours 2014–2026',
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
    <div className="bg-canvas">
      <section className="border-b border-line">
        <div className="mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-14 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12px] text-mute">PACES · Espace étudiant</p>
              <h1 className="mt-3 font-display text-[clamp(2.2rem,4.5vw,3.4rem)] leading-[1.05] tracking-[-0.03em] text-ink">
                Bonjour PACES.
              </h1>
              <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-mute">
                Pres Concours tire une série de 10 questions dans les chapitres que tu choisis.
                MEDGAME reprend ces mêmes questions, mélangées en niveaux de 5 questions à valider
                5/5. Les deux parcours partagent les mêmes 30 séries.
              </p>
            </div>
            <StatusPill tone={reached ? 'warning' : 'success'} dot>
              {reached ? 'Quota atteint' : 'Accès actif'}
            </StatusPill>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-content px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Quota partagé</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-[2.2rem] leading-none tracking-[-0.02em] text-ink">
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

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {entries.map((entry) => {
            const Icon = entry.icon
            return (
              <Link
                key={entry.to}
                to={entry.to}
                className="group flex min-h-[180px] flex-col justify-between rounded-2xl border border-line bg-surface p-5 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-soft sm:p-6"
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
