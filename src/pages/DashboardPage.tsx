import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
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
    title: 'Supports de cours',
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

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [visible, setVisible] = useState<boolean[]>(() =>
    entries.map(() => prefersReducedMotion),
  )
  const blockRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    if (prefersReducedMotion) return
    const observer = new IntersectionObserver(
      (observed) => {
        observed.forEach((item) => {
          if (!item.isIntersecting) return
          const index = Number((item.target as HTMLElement).dataset.index)
          setVisible((current) => {
            const next = [...current]
            next[index] = true
            return next
          })
          observer.unobserve(item.target)
        })
      },
      { threshold: 0.18 },
    )
    blockRefs.current.forEach((element) => {
      if (element) observer.observe(element)
    })
    return () => observer.disconnect()
  }, [prefersReducedMotion])

  return (
    <div className="bg-canvas">
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

        <p className="mt-8 text-center text-[12px] text-mute">
          Fais défiler pour découvrir les quatre options
        </p>

        <div className="mt-4 space-y-[18px]">
          {entries.map((entry, entryIndex) => {
            const Icon = entry.icon
            return (
              <article
                key={entry.to}
                ref={(element) => {
                  blockRefs.current[entryIndex] = element
                }}
                data-index={entryIndex}
                className={`flex min-h-[300px] flex-col justify-between rounded-[18px] bg-accent p-6 text-white shadow-[0_8px_20px_rgba(11,107,79,0.16)] transition-all duration-500 ease-out motion-reduce:transition-none sm:p-7 ${
                  visible[entryIndex] ? 'translate-y-0 opacity-100' : 'translate-y-[22px] opacity-0'
                }`}
              >
                <div>
                  <span className="grid h-[44px] w-[44px] place-items-center rounded-[13px] bg-white/15">
                    <Icon size={22} />
                  </span>
                  <p className="mt-3.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-white/75">
                    Option {entryIndex + 1} sur {entries.length}
                  </p>
                  <h2 className="mt-1.5 font-display text-[25px] leading-[1.1] tracking-[-0.02em]">
                    {entry.title}
                  </h2>
                  <p className="mt-2 max-w-prose text-[11.5px] leading-[1.45] text-white/85">
                    {entry.description}
                  </p>
                </div>
                <Link
                  to={entry.to}
                  className="mt-4 flex h-10 items-center justify-center rounded-[20px] bg-white text-[12px] font-semibold text-accent transition hover:bg-white/90"
                >
                  Continuer
                </Link>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
