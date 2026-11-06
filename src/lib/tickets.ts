/**
 * Conventions des tickets d'accès.
 *
 * - ID (code) : PACES0001, PACES0002, ...
 * - Numéro d'enregistrement : 6 chiffres + 3 lettres mélangés
 *   (9 caractères, imprévisible). C'est le mot de passe du compte
 *   Auth créé pour le ticket.
 *
 * L'e-mail interne d'un ticket est dérivé du code : il ne se montre
 * jamais dans l'interface, l'étudiant ne tape que l'ID et le numéro.
 */

export const TICKET_EMAIL_DOMAIN = 'ticket.medqcm'

export function ticketLoginEmail(code: string): string {
  return `${code.trim().toLowerCase()}@${TICKET_EMAIL_DOMAIN}`
}

export function ticketCodeFromInput(code: string): string {
  return code.trim().toUpperCase()
}

/** 6 chiffres + 3 lettres mélangés (utilisé en mode démonstration). */
export function makeTicketSecret(): string {
  const chars: string[] = []
  for (let i = 0; i < 6; i += 1) {
    chars.push(String(Math.floor(Math.random() * 10)))
  }
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (let i = 0; i < 3; i += 1) {
    chars.push(letters[Math.floor(Math.random() * 26)])
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
