import type { GeneratedTicket } from '@/types'

/**
 * Lot de tickets fraîchement générés, conservé en mémoire pour être affiché
 * sur la page dédiée (les numéros ne sont visibles qu'une fois, jamais dans
 * l'URL). Une actualisation de la page efface le lot : les numéros ne
 * pourront alors plus être récupérés.
 */
let batch: GeneratedTicket[] = []

export function setGeneratedTickets(tickets: GeneratedTicket[]) {
  batch = tickets
}

export function getGeneratedTickets(): GeneratedTicket[] {
  return batch
}

export function clearGeneratedTickets() {
  batch = []
}
