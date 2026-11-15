import { cn } from '@/lib/utils'

export function ProgressBar({
  value,
  max = 100,
  className,
  barClassName,
  trackClassName,
}: {
  value: number
  max?: number
  className?: string
  barClassName?: string
  trackClassName?: string
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full',
        trackClassName ?? 'bg-line',
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500 ease-out',
          barClassName ?? 'bg-accent',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
