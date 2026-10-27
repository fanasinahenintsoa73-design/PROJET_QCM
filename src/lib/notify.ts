import { supabase } from '@/lib/supabase'

export type NotificationPayload =
  | { type: 'new_request' }
  | { type: 'access_activated'; requestId?: string; userId?: string }

/**
 * Déclenche un email transactionnel depuis une fonction Vercel.
 * L'appel est volontairement silencieux : une panne d'email ne doit pas
 * annuler une inscription ou une validation déjà enregistrée.
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  if (!supabase) return

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12_000)

  try {
    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      keepalive: true,
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error || `Notification impossible (${response.status}).`)
    }
  } finally {
    window.clearTimeout(timeout)
  }
}
