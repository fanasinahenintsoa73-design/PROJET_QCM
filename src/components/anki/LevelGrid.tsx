import { Check, Lock } from 'lucide-react'
import type { AnkiLevel } from '@/types'
import { cn } from '@/lib/utils'

const STAR_GOLD = '#B98A2E'
const STAR_EMPTY = '#DCE2DD'

/** Les étoiles d'un niveau : 5 emplacements, or quand la réponse est juste. */
function Stars({ count }: { count: number }) {
  return (
    <span className="text-[12px] leading-none tracking-[0.14em]">
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} style={{ color: index < count ? STAR_GOLD : STAR_EMPTY }}>
          ★
        </span>
      ))}
    </span>
  )
}

/**
 * La trajectoire des niveaux d'un chapitre.
 * - `full` : les grands cadres de la page du chapitre.
 * - `mini` : la rangée de petits blocs sur la carte du chapitre du tableau de bord.
 * Chaque cadre est un bouton : cliquer un niveau ouvert le lance.
 */
export function LevelGrid({
  levels,
  variant = 'full',
  onSelect,
}: {
  levels: AnkiLevel[]
  variant?: 'full' | 'mini'
  onSelect?: (level: number) => void
}) {
  if (levels.length === 0) return null

  if (variant === 'mini') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {levels.map((level) => {
          const locked = level.status === 'locked'
          return (
            <button
              key={level.level}
              type="button"
              disabled={locked}
              onClick={() => onSelect?.(level.level)}
              title={
                locked
                  ? `Termine le niveau ${level.level - 1} pour ouvrir celui-ci.`
                  : `Niveau ${level.level}`
              }
              aria-label={`Niveau ${level.level}${locked ? ' (verrouillé)' : ''}`}
              className={cn(
                'grid h-7 w-7 place-items-center rounded-lg border text-[11px] font-semibold transition',
                level.status === 'passed' && 'border-accent bg-accent text-white',
                level.status === 'unlocked' &&
                  'border-accent bg-surface text-accent ring-2 ring-accent-soft',
                locked && 'cursor-not-allowed border-line bg-cloud text-mute',
                !locked && 'hover:border-accent/60',
              )}
            >
              {locked ? <Lock size={11} /> : level.level}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {levels.map((level) => {
        const locked = level.status === 'locked'
        const passed = level.status === 'passed'
        return (
          <button
            key={level.level}
            type="button"
            disabled={locked}
            onClick={() => onSelect?.(level.level)}
            title={
              locked
                ? `Termine le niveau ${level.level - 1} pour ouvrir celui-ci.`
                : `Jouer le niveau ${level.level}`
            }
            className={cn(
              'flex flex-col items-start gap-2 rounded-xl border px-3.5 py-3 text-left transition',
              passed && 'border-accent bg-accent text-white',
              !passed && level.status === 'unlocked' && 'border-accent bg-surface ring-4 ring-accent-soft',
              locked && 'cursor-not-allowed border-line bg-cloud text-mute',
              !locked && 'hover:border-accent-deep/60 hover:shadow-sm',
            )}
          >
            <span className="flex w-full items-start justify-between gap-2">
              <span
                className={cn(
                  'text-[9px] font-semibold uppercase tracking-[0.12em]',
                  passed ? 'text-white/70' : 'text-mute',
                )}
              >
                Niveau
              </span>
              {passed ? (
                <Check size={14} className="text-white" />
              ) : locked ? (
                <Lock size={13} />
              ) : null}
            </span>
            <span
              className={cn(
                'font-display text-[26px] leading-none',
                passed ? 'text-white' : locked ? 'text-mute' : 'text-ink',
              )}
            >
              {level.level}
            </span>
            <Stars count={level.bestStars} />
          </button>
        )
      })}
    </div>
  )
}
