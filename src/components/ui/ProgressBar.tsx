import { cn } from '@/lib/utils'

export function ProgressBar({
  value,
  max = 100,
  className,
  barClassName,
}: {
  value: number
  max?: number
  className?: string
  barClassName?: string
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div
      className={cn('h-1 w-full overflow-hidden bg-hairline-soft', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div
        className={cn('h-full bg-ink transition-[width] duration-500 ease-out', barClassName)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
