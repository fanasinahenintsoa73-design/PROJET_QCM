import { supabase } from '@/lib/supabase'

export type NotificationPayload =
  | { type: 'new_request' }
  | { type: 'access_activated'; requestId?: string; userId?: string }

const TIMEOUT_MS = 12_000
const BACKOFF_MS = [0, 400, 1_200]
const RETRYABLE_STATUS = new Set([502, 503, 504])

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof DOMException && error.name === 'AbortError')
  )
}

async function postOnce(payload: NotificationPayload, token: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      keepalive: true,
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timeout)
  }
}

/**
 * Déclenche un email transactionnel depuis une fonction Vercel.
 * L'appel est volontairement silencieux : une panne d'email ne doit pas
 * annuler une inscription ou une validation déjà enregistrée.
 *
 * Incidents Supabase externes : `new_request` est retenté (3 essais,
 * backoff 400 ms puis 1,2 s) sur 502/503/504, timeout ou erreur réseau.
 * `access_activated` n'est jamais retenté pour éviter un second email.
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  if (!supabase) return

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return

  // Un seul essai pour l'activation : le serveur a déjà envoyé l'email.
  const attempts = payload.type === 'new_request' ? 3 : 1

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await wait(BACKOFF_MS[attempt])

    try {
      const response = await postOnce(payload, token)
      if (response.ok) return

      const body = (await response.json().catch(() => null)) as { error?: string } | null
      const message = body?.error || `Notification impossible (${response.status}).`
      if (attempt + 1 < attempts && RETRYABLE_STATUS.has(response.status)) {
        console.warn(`[notify] nouvelle tentative ${attempt + 1}/${attempts}`, response.status)
        continue
      }
      throw new Error(message)
    } catch (error) {
      if (attempt + 1 < attempts && isNetworkError(error)) {
        console.warn(`[notify] nouvelle tentative ${attempt + 1}/${attempts}`)
        continue
      }
      throw error
    }
  }
}
