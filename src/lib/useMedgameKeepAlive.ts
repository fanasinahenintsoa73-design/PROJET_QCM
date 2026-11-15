import { useEffect } from 'react'
import { api } from '@/lib/api'

const KEEP_ALIVE_INTERVAL_MS = 25_000

/**
 * Garde les parcours MEDGAME de l'étudiant en vie.
 *
 * Tant que l'étudiant reste dans MEDGAME, toutes ses parties restent
 * jouables : passer d'une UE à l'autre ne doit pas compter comme un abandon.
 * Le battement est rafraîchi côté serveur pour toutes les parties actives.
 */
export function useMedgameKeepAlive(runId: string | null): void {
  useEffect(() => {
    if (!runId) return
    const ping = () => {
      void api.heartbeatMedgameRun(runId).catch(() => undefined)
    }
    ping()
    const timer = window.setInterval(ping, KEEP_ALIVE_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [runId])
}
