import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { buttonClasses } from '@/components/ui/Button'

const CHECK_INTERVAL = 60_000
const RELOAD_KEY_PREFIX = 'medqcm:reloaded:'

/** Le fichier du bundle actuellement chargé, tel qu'il apparaît dans index.html. */
function currentBundle(): string | null {
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
  if (!script) return null
  try {
    return new URL(script.src, window.location.href).pathname.replace(/^\//, '')
  } catch {
    return null
  }
}

/** Un QCM est en cours : on ne recharge pas la page sous les doigts de l'étudiant. */
function isQuizPath(pathname: string): boolean {
  if (pathname === '/app/entrainement') return true
  return pathname.startsWith('/app/anki/') && pathname !== '/app/anki/choisir'
}

function alreadyReloaded(version: string): boolean {
  try {
    return sessionStorage.getItem(RELOAD_KEY_PREFIX + version) === '1'
  } catch {
    return false
  }
}

function markReloaded(version: string): void {
  try {
    sessionStorage.setItem(RELOAD_KEY_PREFIX + version, '1')
  } catch {
    // Stockage indisponible : on ne bloque pas le rechargement.
  }
}

function hardReload(): void {
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('v', String(Date.now()))
    window.location.replace(url.toString())
  } catch {
    window.location.reload()
  }
}

/**
 * Vérifie régulièrement /version.json. Dès qu'un nouveau bundle est déployé,
 * la page se recharge toute seule. Pendant un QCM, un bandeau propose de le
 * faire sans interrompre la réponse en cours.
 */
export function UpdateWatcher() {
  const location = useLocation()
  const [available, setAvailable] = useState<string | null>(null)

  useEffect(() => {
    if (!import.meta.env.PROD) return

    let cancelled = false
    let timer: number | undefined

    const check = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
        })
        if (!response.ok) return
        const data = (await response.json()) as { version?: unknown }
        const deployed = typeof data.version === 'string' ? data.version : null
        const loaded = currentBundle()
        if (!cancelled && deployed && loaded && deployed !== loaded) {
          setAvailable(deployed)
        }
      } catch {
        // Réseau indisponible : la prochaine vérification réessaiera.
      }
    }

    void check()
    timer = window.setInterval(() => void check(), CHECK_INTERVAL)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    const onFocus = () => void check()
    const onCheckRequest = () => void check()

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onCheckRequest)
    window.addEventListener('medqcm:check-update', onCheckRequest)

    return () => {
      cancelled = true
      if (timer !== undefined) window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onCheckRequest)
      window.removeEventListener('medqcm:check-update', onCheckRequest)
    }
  }, [])

  useEffect(() => {
    if (!available) return
    // En plein QCM, on attend que l'étudiant quitte le quiz.
    if (isQuizPath(location.pathname)) return
    // Après un rechargement, si l'ancien HTML est encore servi, on affiche
    // le bandeau au lieu de recharger en boucle.
    if (alreadyReloaded(available)) return
    markReloaded(available)
    hardReload()
  }, [available, location.pathname])

  if (!available) return null

  return (
    <div className="fixed inset-x-0 bottom-4 z-[60] px-4" role="status" aria-live="polite">
      <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-soft">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <RefreshCw size={15} />
          </span>
          <p className="text-[13px] leading-snug text-ink">
            Une nouvelle version de MEDQCM est disponible.
          </p>
        </div>
        <button type="button" onClick={hardReload} className={buttonClasses('primary', 'sm')}>
          Actualiser
        </button>
      </div>
    </div>
  )
}
