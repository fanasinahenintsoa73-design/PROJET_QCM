import type { GeneratedTicket } from '@/types'

const STORAGE_KEY = 'medqcm.generatedTickets.v1'

/**
 * Lot de tickets fraîchement générés, conservé pour être affiché sur la page
 * dédiée (les numéros ne sont visibles qu'une fois, jamais dans l'URL).
 *
 * sessionStorage : le lot survit à une actualisation de la page dans le même
 * onglet, mais disparaît à la fermeture de l'onglet. Les numéros ne sont pas
 * stockés en clair côté base (hash bcrypt) : une fois le lot perdu, ils ne
 * peuvent plus être récupérés.
 */
function readBatch(): GeneratedTicket[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is GeneratedTicket =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as GeneratedTicket).code === 'string' &&
        typeof (item as GeneratedTicket).secret === 'string',
    )
  } catch {
    return []
  }
}

function writeBatch(tickets: GeneratedTicket[]) {
  if (typeof window === 'undefined') return
  try {
    if (tickets.length === 0) {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } else {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tickets))
    }
  } catch {
    /* stockage indisponible : le lot reste en mémoire */
  }
}

let batch: GeneratedTicket[] = readBatch()

export function setGeneratedTickets(tickets: GeneratedTicket[]) {
  batch = tickets
  writeBatch(batch)
}

export function getGeneratedTickets(): GeneratedTicket[] {
  return batch
}

export function clearGeneratedTickets() {
  batch = []
  writeBatch(batch)
}
