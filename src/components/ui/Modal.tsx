import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const sizes: Record<Size, string> = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-lg',
  lg: 'md:max-w-2xl',
  xl: 'md:max-w-4xl',
}

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  size = 'md',
  footer,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  eyebrow?: string
  size?: Size
  footer?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, open])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Fenêtre'}
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-ink/30 backdrop-blur-sm"
      />
      <div
        className={cn(
          'relative flex max-h-[calc(100dvh-1rem)] w-full animate-fade-up flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-soft md:max-h-[calc(100dvh-3rem)] md:rounded-2xl',
          sizes[size],
        )}
      >
        {(title || eyebrow) && (
          <div className="flex items-start justify-between gap-5 border-b border-line px-5 py-5 sm:px-7">
            <div>
              {eyebrow && <p className="text-[11px] text-mute">{eyebrow}</p>}
              {title && (
                <h2 className="mt-1 font-display text-[24px] leading-tight tracking-[-0.02em] text-ink">
                  {title}
                </h2>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-mute transition hover:bg-cloud hover:text-ink"
              aria-label="Fermer"
            >
              <X size={17} />
            </button>
          </div>
        )}

        <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">{children}</div>

        {footer && (
          <div className="border-t border-line px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-7">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
