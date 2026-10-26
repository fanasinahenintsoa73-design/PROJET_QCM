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
          'grid place-items-center rounded-[7px]',
          compact ? 'h-7 w-7' : 'h-8 w-8',
          dark ? 'bg-white text-accent' : 'bg-accent text-white',
        )}
      >
        <Plus size={compact ? 15 : 17} strokeWidth={2.4} aria-hidden />
      </span>
      <span className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'font-display leading-none tracking-[-0.02em]',
            compact ? 'text-[22px]' : 'text-[25px]',
            dark ? 'text-white' : 'text-ink',
          )}
        >
          MEDQCM
        </span>
        <span
          className={cn(
            'text-[9px] font-semibold tracking-[0.14em]',
            dark ? 'text-white/60' : 'text-accent',
          )}
        >
          L1
        </span>
      </span>
    </Link>
  )
}
