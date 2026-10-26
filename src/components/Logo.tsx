import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Logo({
  dark = false,
  to = '/',
  compact = false,
  className,
}: {
  dark?: boolean
  to?: string
  compact?: boolean
  className?: string
}) {
  return (
    <Link
      to={to}
      aria-label="MEDQCM L1 — accueil"
      className={cn('inline-flex items-center gap-2.5', className)}
    >
      <span
        className={cn(
          'grid place-items-center',
          compact ? 'h-8 w-8' : 'h-9 w-9',
          dark ? 'bg-white text-ink' : 'bg-ink text-white',
        )}
      >
        <Plus size={compact ? 16 : 18} strokeWidth={2.5} aria-hidden />
      </span>
      <span className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'font-display leading-none tracking-[0.03em]',
            compact ? 'text-[24px]' : 'text-[28px]',
            dark ? 'text-white' : 'text-ink',
          )}
        >
          MEDQCM
        </span>
        <span
          className={cn(
            'text-[9px] font-semibold tracking-[0.18em]',
            dark ? 'text-stone' : 'text-mute',
          )}
        >
          L1
        </span>
      </span>
    </Link>
  )
}
