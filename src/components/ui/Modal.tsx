import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title?: string
  eyebrow?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 30)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      window.clearTimeout(focusTimer)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center md:p-6">
      <div
        className="absolute inset-0 animate-fade-in bg-ink/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex max-h-[calc(100dvh-1rem)] w-full animate-fade-up flex-col overflow-hidden rounded-t-[24px] bg-canvas outline-none md:max-h-[calc(100dvh-3rem)] md:rounded-none',
          size === 'sm' && 'md:max-w-md',
          size === 'md' && 'md:max-w-2xl',
          size === 'lg' && 'md:max-w-4xl',
          size === 'xl' && 'md:max-w-6xl',
        )}
      >
        <div className="flex items-start justify-between gap-6 border-b border-hairline-soft px-6 py-5 md:px-8">
          <div>
            {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
            {title && <h2 className="text-[22px] font-medium leading-tight tracking-[-0.01em]">{title}</h2>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cloud transition hover:bg-hairline-soft"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-8">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-hairline-soft px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 md:px-8 md:pb-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
