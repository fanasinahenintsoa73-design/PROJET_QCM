import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'dark' | 'success' | 'warning' | 'error' | 'info'

const tones: Record<Tone, { wrap: string; dot: string }> = {
  neutral: { wrap: 'bg-cloud text-charcoal', dot: 'bg-stone' },
  dark: { wrap: 'bg-ink text-white', dot: 'bg-white' },
  success: { wrap: 'bg-[#e9f5ee] text-success', dot: 'bg-success' },
  warning: { wrap: 'bg-[#fdf3e2] text-[#8a5300]', dot: 'bg-[#b7770b]' },
  error: { wrap: 'bg-[#fdecec] text-sale', dot: 'bg-sale' },
  info: { wrap: 'bg-[#edf2ff] text-info', dot: 'bg-info' },
}

export function StatusPill({
  children,
  tone = 'neutral',
  dot = true,
  className,
}: {
  children: React.ReactNode
  tone?: Tone
  dot?: boolean
  className?: string
}) {
  const styles = tones[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-[5px] text-[10px] font-semibold uppercase tracking-[0.14em]',
        styles.wrap,
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} />}
      {children}
    </span>
  )
}

export function requestStatus(status: 'pending' | 'approved' | 'rejected') {
  if (status === 'approved') return { tone: 'success' as const, label: 'Validée' }
  if (status === 'rejected') return { tone: 'error' as const, label: 'Refusée' }
  return { tone: 'warning' as const, label: 'En attente' }
}

export function userStatusLabel(status: string) {
  if (status === 'active') return { tone: 'success' as const, label: 'Actif' }
  if (status === 'pending') return { tone: 'warning' as const, label: 'En attente' }
  return { tone: 'error' as const, label: 'Suspendu' }
}
