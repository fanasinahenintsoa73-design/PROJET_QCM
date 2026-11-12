import { Check, Lock } from 'lucide-react'
import type { AnkiLevel } from '@/types'
import { cn } from '@/lib/utils'

/**
 * Les fonds manga d'un niveau. L'ordre suit la maquette validée : les images
 * ne sont pas rangées dans l'ordre de leur nom de fichier.
 */
const LEVEL_IMAGES = [
  '/medgame/level-01.jpg',
  '/medgame/level-04.jpg',
  '/medgame/level-03.jpg',
  '/medgame/level-07.jpg',
  '/medgame/level-05.jpg',
  '/medgame/level-06.jpg',
  '/medgame/level-08.jpg',
  '/medgame/level-02.jpg',
] as const

const GOLD = '#C79A3C'
const STAR_OFF = 'rgba(255,255,255,.28)'
const STAR_OPEN = 'rgba(255,255,255,.62)'

function imageForLevel(level: number): string {
  return LEVEL_IMAGES[(Math.max(1, level) - 1) % LEVEL_IMAGES.length]
}

function shadeFor(status: AnkiLevel['status']): string {
  if (status === 'passed') {
    return 'linear-gradient(180deg, rgba(4,38,27,.04) 0%, rgba(4,38,27,.30) 45%, rgba(3,26,19,.93) 100%)'
  }
  if (status === 'unlocked') {
    return 'linear-gradient(180deg, rgba(8,12,10,0) 0%, rgba(8,12,10,.06) 38%, rgba(8,12,10,.28) 62%, rgba(8,12,10,.82) 100%)'
  }
  return 'linear-gradient(180deg, rgba(5,9,7,.55) 0%, rgba(5,9,7,.82) 55%, rgba(5,9,7,.96) 100%)'
}

/**
 * Les étoiles d'un niveau : 5 emplacements, or quand la réponse est juste.
 * - `gold` : les étoiles gagnées sont or, les autres restent grises.
 * - `open` : les étoiles gagnées sont or, les autres sont des contours.
 */
export function Stars({ count, tone = 'gold' }: { count: number; tone?: 'gold' | 'open' }) {
  return (
    <span className="text-[9px] leading-none tracking-[0.12em]">
      {Array.from({ length: 5 }, (_, index) => {
        const earned = index < count
        return (
          <span
            key={index}
            style={{ color: earned ? GOLD : tone === 'open' ? STAR_OPEN : STAR_OFF }}
          >
            {earned || tone === 'gold' ? '★' : '☆'}
          </span>
        )
      })}
    </span>
  )
}

/**
 * La planche des niveaux d'un chapitre : les grands cadres sur fond manga.
 * Chaque cadre est un bouton : cliquer un niveau ouvert le lance.
 */
export function LevelGrid({
  levels,
  onSelect,
  chapterTitle,
  planche,
}: {
  levels: AnkiLevel[]
  onSelect?: (level: number) => void
  chapterTitle?: string
  planche?: number
}) {
  if (levels.length === 0) return null

  const plancheLabel = planche ? `Planche ${String(planche).padStart(2, '0')}` : 'Planche'

  return (
    <div
      className="mt-3.5 rounded-[13px] p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]"
      style={{
        backgroundColor: '#15201B',
        backgroundImage: 'radial-gradient(rgba(255,255,255,.055) .55px, transparent .6px)',
        backgroundSize: '5px 5px',
      }}
    >
      <div className="flex items-center justify-between gap-3 px-[3px] pb-[7px] pt-[1px] text-[6px] font-bold uppercase tracking-[0.18em] text-white/40">
        <span className="min-w-0 truncate">
          {plancheLabel}
          {chapterTitle ? ` · ${chapterTitle}` : ''}
        </span>
        <span className="shrink-0">{levels.length} cadres</span>
      </div>

      <div className="grid grid-cols-2 gap-[7px] sm:grid-cols-4">
        {levels.map((level) => {
          const locked = level.status === 'locked'
          const passed = level.status === 'passed'
          const unlocked = level.status === 'unlocked'
          const number = String(level.level).padStart(2, '0')
          const score = `${level.bestStars}/5`
          const title = locked
            ? level.level > 1
              ? `Termine le niveau ${level.level - 1} pour ouvrir celui-ci.`
              : 'Ce niveau est verrouillé.'
            : passed
              ? `Rejouer le niveau ${level.level}`
              : `Jouer le niveau ${level.level}`

          return (
            <button
              key={level.level}
              type="button"
              disabled={locked}
              onClick={() => onSelect?.(level.level)}
              title={title}
              aria-label={`Niveau ${level.level}${
                passed
                  ? ` réussi, ${level.bestStars} étoiles sur 5`
                  : locked
                    ? ' verrouillé'
                    : ' ouvert, à jouer'
              }`}
              className={cn(
                'relative isolate aspect-[3/4] w-full overflow-hidden rounded-[7px] border-2 bg-[#0c1210] text-left transition duration-200',
                passed && 'border-white/80',
                unlocked &&
                  'border-accent shadow-[0_0_0_3px_rgba(11,107,79,.26),0_6px_18px_rgba(0,0,0,.32)] hover:border-accent-deep',
                locked && 'cursor-not-allowed border-white/20',
              )}
            >
              <img
                src={imageForLevel(level.level)}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                className={cn(
                  'absolute inset-0 h-full w-full object-cover object-[center_22%]',
                  passed && 'grayscale contrast-[1.14] brightness-[.94]',
                  unlocked && 'grayscale contrast-[1.18] brightness-[1.02]',
                  locked && 'grayscale contrast-[1.08] brightness-[.32] blur-[1px]',
                )}
              />

              {passed ? (
                <span className="pointer-events-none absolute inset-0 z-[1] bg-accent opacity-[.92] mix-blend-color" />
              ) : null}

              <span
                className="pointer-events-none absolute inset-0 z-[2]"
                style={{ background: shadeFor(level.status) }}
              />

              {locked ? (
                <span
                  className="pointer-events-none absolute inset-0 z-[3] opacity-50"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(45deg, rgba(255,255,255,.05) 0 1px, transparent 1px 6px)',
                  }}
                />
              ) : null}

              <span className="relative z-10 flex h-full flex-col justify-between p-[7px] pb-[6px]">
                <span className="flex items-start justify-between gap-1">
                  <span className="flex min-w-0 flex-col gap-px leading-none">
                    <span className="text-[6px] font-bold uppercase tracking-[0.2em] text-white/70">
                      Niveau
                    </span>
                    <span className="font-display text-[28px] leading-[0.82] tracking-[-0.03em] text-white [text-shadow:0_1px_10px_rgba(0,0,0,.55)]">
                      {number}
                    </span>
                  </span>

                  {passed ? (
                    <span className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border border-white/60 bg-accent text-white shadow-[0_2px_6px_rgba(0,0,0,.35)]">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  ) : unlocked ? (
                    <span className="inline-flex h-4 shrink-0 items-center rounded-full border border-white/40 bg-accent px-1.5 text-[5.5px] font-extrabold tracking-[0.1em] text-white shadow-[0_2px_6px_rgba(0,0,0,.35)]">
                      À TOI
                    </span>
                  ) : (
                    <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center text-white/50">
                      <Lock size={13} strokeWidth={1.8} />
                    </span>
                  )}
                </span>

                {locked ? (
                  <span />
                ) : (
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <span className="flex items-center gap-[5px] leading-none">
                      <Stars count={level.bestStars} tone={unlocked ? 'open' : 'gold'} />
                      <span
                        className={cn(
                          'text-[6.5px] tracking-[0.02em]',
                          passed ? 'text-[#F0CE8C]' : 'text-white/60',
                        )}
                      >
                        {score}
                      </span>
                    </span>
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** La légende des trois états, sous la planche. */
export function LevelLegend() {
  return (
    <div className="mt-5 grid grid-cols-1 gap-3 text-[10px] leading-snug text-mute sm:grid-cols-3">
      <div className="flex items-start gap-2">
        <span className="mt-[3px] h-2 w-2 shrink-0 rounded-full bg-accent" />
        <span>
          <b className="block text-[10px] font-semibold text-ink">Réussi</b>
          5/5 · le cadre suivant s’ouvre
        </span>
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-[3px] h-2 w-2 shrink-0 rounded-full border border-accent bg-transparent" />
        <span>
          <b className="block text-[10px] font-semibold text-ink">Ouvert</b>
          5 questions · 5 étoiles à prendre
        </span>
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-[3px] h-2 w-2 shrink-0 rounded-full bg-line" />
        <span>
          <b className="block text-[10px] font-semibold text-ink">Verrouillé</b>
          réussis le cadre précédent
        </span>
      </div>
    </div>
  )
}
