import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  tone: Tone
}

interface ToastContextValue {
  toast: (message: string, tone?: Tone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timers = useRef(new Map<number, number>())
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) window.clearTimeout(timer)
    timers.current.delete(id)
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, tone: Tone = 'success') => {
      const id = ++nextId.current
      setItems((current) => [...current.slice(-1), { id, message, tone }])
      const timer = window.setTimeout(() => dismiss(id), 3800)
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach((timer) => window.clearTimeout(timer))
      map.clear()
    }
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 left-1/2 z-[200] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-2"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role={item.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex animate-fade-up items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-[13px] font-medium text-ink shadow-soft"
          >
            <span
              className={cn(
                'grid h-7 w-7 shrink-0 place-items-center rounded-full',
                item.tone === 'error'
                  ? 'bg-danger-soft text-sale'
                  : 'bg-accent-soft text-accent',
              )}
            >
              {item.tone === 'error' ? (
                <AlertTriangle size={14} strokeWidth={2} aria-hidden />
              ) : (
                <Check size={14} strokeWidth={2.5} aria-hidden />
              )}
            </span>
            <span className="min-w-0 flex-1 leading-snug">{item.message}</span>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="shrink-0 text-[11px] text-mute transition hover:text-ink"
            >
              Fermer
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast doit être utilisé dans ToastProvider.')
  return context
}
