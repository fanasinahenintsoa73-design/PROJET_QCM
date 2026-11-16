import { Check, ListChecks, LockKeyhole } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Liste de chapitres partagée entre Pres Concours et MEDGAME.
 * Une seule grammaire visuelle pour un même geste : choisir des chapitres.
 */
export interface ChapterListEntry {
  id: string
  title: string
  /** Ligne secondaire : nombre de sujets, nombre de questions, etc. */
  meta?: string
  /** Chapitre indisponible : ligne verrouillée, non sélectionnable. */
  disabled?: boolean
  badge?: { label: string; tone: 'cloud' | 'accent' } | null
}

export function ChapterList({
  title = 'Chapitres',
  entries,
  selectedIds,
  onToggle,
  onToggleAll,
  toggleAllLabel,
}: {
  title?: string
  entries: ChapterListEntry[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAll?: () => void
  toggleAllLabel?: string
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
          <ListChecks size={16} className="text-accent" />
          {title}
        </div>
        {onToggleAll && toggleAllLabel ? (
          <button
            type="button"
            onClick={onToggleAll}
            className="text-[12px] font-medium text-accent transition hover:text-accent-deep"
          >
            {toggleAllLabel}
          </button>
        ) : null}
      </div>

      <div className="divide-y divide-line">
        {entries.map((entry) => {
          const checked = selectedIds.has(entry.id)
          const disabled = entry.disabled === true
          return (
            <button
              key={entry.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(entry.id)}
              className={cn(
                'flex w-full items-center gap-4 px-5 py-4 text-left transition sm:px-6',
                checked ? 'bg-accent-soft/60' : 'hover:bg-cloud/50',
                disabled && !checked && 'cursor-not-allowed opacity-55',
              )}
              aria-pressed={checked}
            >
              <span
                className={cn(
                  'grid h-5 w-5 shrink-0 place-items-center rounded border transition',
                  checked
                    ? 'border-accent bg-accent text-white'
                    : disabled
                      ? 'border-line bg-cloud text-mute'
                      : 'border-line bg-surface text-transparent',
                )}
              >
                {disabled ? (
                  <LockKeyhole size={11} />
                ) : (
                  <Check size={13} strokeWidth={3} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">{entry.title}</span>
                {entry.meta ? (
                  <span className="mt-0.5 block text-[11px] text-mute">{entry.meta}</span>
                ) : null}
              </span>
              {entry.badge ? (
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-1 text-[9px] font-medium uppercase tracking-[0.08em]',
                    entry.badge.tone === 'accent'
                      ? 'bg-accent-soft text-accent'
                      : 'bg-cloud text-mute',
                  )}
                >
                  {entry.badge.label}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
