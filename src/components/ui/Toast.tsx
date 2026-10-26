import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { cn, uid } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

const ToastContext = createContext<{ toast: (message: string, tone?: ToastTone) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timers = useRef<Record<string, number>>({})

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = uid('toast')
    setItems((current) => [...current.slice(-2), { id, message, tone }])
    timers.current[id] = window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
    }, 3800)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 left-1/2 z-[200] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col items-center gap-2"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex w-full animate-fade-up items-center gap-3 rounded-full px-5 py-3.5 text-[13px] font-medium text-white',
              item.tone === 'error' ? 'bg-sale' : 'bg-ink',
            )}
          >
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15">
              {item.tone === 'error' ? <AlertTriangle size={12} /> : <Check size={12} />}
            </span>
            <span className="min-w-0 flex-1">{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
