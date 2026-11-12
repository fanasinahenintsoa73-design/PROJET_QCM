import { Check, Lock } from 'lucide-react'
import type { AnkiLevel } from '@/types'
import { cn } from '@/lib/utils'

const STAR_GOLD = '#B98A2E'
const STAR_EMPTY = '#DCE2DD'
const STAR_INK = '#15201B'

/**
 * Les étoiles d'un niveau : 5 emplacements, or quand la réponse est juste.
 * - `gold` : les étoiles gagnées sont or, les autres restent grises.
 * - `ink` : les 5 emplacements sont en encre (niveau ouvert, à remplir).
 */
export function Stars({ count, tone = 'gold' }: { count: number; tone?: 'gold' | 'ink' }) {
  return (
    <span className="text-[12px] leading-none tracking-[0.14em]">
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          style={{
            color: tone === 'ink' ? STAR_INK : index < count ? STAR_GOLD : STAR_EMPTY,
          }}
        >
          ★
        </span>
      ))}
    </span>
  )
}

/**
 * La trajectoire des niveaux d'un chapitre : les grands cadres (mot, numéro,
 * étoiles). Chaque cadre est un bouton : cliquer un niveau ouvert le lance.
 */
export function LevelGrid({
  levels,
  onSelect,
}: {
  levels: AnkiLevel[]
  onSelect?: (level: number) => void
}) {
  if (levels.length === 0) return null

  return (
    <div className="grid grid-cols-4 gap-3">
      {levels.map((level) => {
        const locked = level.status === 'locked'
        const passed = level.status === 'passed'
        const unlocked = level.status === 'unlocked'
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
            aria-label={`Niveau ${level.level}${locked ? ' (verrouillé)' : ''}`}
            className={cn(
              'flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 transition',
              passed && 'border-accent bg-accent text-white',
              unlocked && 'border-accent bg-surface ring-4 ring-accent-soft hover:border-accent-deep',
              locked && 'cursor-not-allowed border-line bg-cloud text-mute',
            )}
          >
            <span
              className={cn(
                'flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.12em]',
                passed ? 'text-white/80' : unlocked ? 'text-accent' : 'text-mute',
              )}
            >
              Niveau
              {passed ? <Check size={12} /> : locked ? <Lock size={11} /> : null}
            </span>
            <span
              className={cn(
                'font-display text-[28px] leading-none',
                passed ? 'text-white' : locked ? 'text-mute' : 'text-ink',
              )}
            >
              {level.level}
            </span>
            {locked ? null : (
              <Stars count={level.bestStars} tone={unlocked ? 'ink' : 'gold'} />
            )}
          </button>
        )
      })}
    </div>
  )
}
