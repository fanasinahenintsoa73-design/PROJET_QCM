import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const { user, db } = useAuth()
  const usage = user ? getSeriesUsage(user.id, db) : undefined
  const used = usage?.used ?? 0
  const remaining = usage?.remaining ?? SERIES_LIMIT
  const reached = usage?.reached ?? false

  const [index, setIndex] = useState(0)
  const [cycle, setCycle] = useState(0)
  const startX = useRef<number | null>(null)
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (prefersReducedMotion) return
    const id = window.setInterval(() => setIndex((current) => (current + 1) % entries.length), 2000)
    return () => window.clearInterval(id)
  }, [prefersReducedMotion, cycle])

  function showOption(next: number) {
    setIndex(next)
    setCycle((current) => current + 1)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    startX.current = event.clientX
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (startX.current === null) return
    const distance = event.clientX - startX.current
    startX.current = null
    if (Math.abs(distance) < 40) return
    const direction = distance < 0 ? 1 : -1
    setIndex((current) => (current + direction + entries.length) % entries.length)
    setCycle((current) => current + 1)
  }

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

        <div
          className="mx-auto mt-9 w-[300px] touch-pan-y overflow-hidden"
          role="group"
          aria-roledescription="carrousel"
          aria-label="Choisissez une option"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            startX.current = null
          }}
        >
          <div
            className="flex transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${index * 300}px)` }}
          >
            {entries.map((entry, entryIndex) => {
              const Icon = entry.icon
              return (
                <article
                  key={entry.to}
                  className="flex h-[300px] w-[300px] shrink-0 flex-col justify-between rounded-[18px] border border-[#D7DED8] bg-white/75 p-5 shadow-[0_6px_18px_rgba(4,36,20,0.05)] backdrop-blur-[16px]"
                  aria-hidden={entryIndex !== index}
                >
                  <div>
                    <span className="grid h-[42px] w-[42px] place-items-center rounded-[13px] bg-accent-soft text-accent">
                      <Icon size={22} />
                    </span>
                    <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.13em] text-accent">
                      Option {entryIndex + 1} sur {entries.length}
                    </p>
                    <h2 className="mt-1.5 font-display text-[25px] leading-[1.1] tracking-[-0.02em] text-ink">
                      {entry.title}
                    </h2>
                    <p className="mt-2 text-[11.5px] leading-[1.45] text-mute">
                      {entry.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(entry.to)}
                    tabIndex={entryIndex === index ? 0 : -1}
                    aria-label={`Continuer vers ${entry.title}`}
                    className="flex h-[38px] items-center justify-center gap-1.5 rounded-[19px] bg-accent text-[12px] font-semibold text-white transition hover:bg-accent-deep"
                  >
                    Continuer <ArrowRight size={14} />
                  </button>
                </article>
              )
            })}
          </div>
        </div>

        <div className="mt-[18px] flex justify-center gap-[7px]" role="tablist" aria-label="Options">
          {entries.map((entry, entryIndex) => (
            <button
              key={entry.to}
              type="button"
              role="tab"
              aria-selected={entryIndex === index}
              aria-label={`Option ${entryIndex + 1} : ${entry.title}`}
              onClick={() => showOption(entryIndex)}
              className={
                entryIndex === index
                  ? 'h-[7px] w-5 rounded-[6px] bg-accent'
                  : 'h-[7px] w-[7px] rounded-full bg-[#C9D5CD]'
              }
            />
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] text-mute" aria-live="polite">
          {index + 1} / {entries.length}
        </p>
        <p className="mt-3 text-center text-[10px] text-mute">
          Glissez à gauche ou à droite pour changer d’option
        </p>
      </section>
    </div>
  )
}
