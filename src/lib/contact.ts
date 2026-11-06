/**
 * Numéro du docteur affiché aux étudiants qui n'ont pas encore de ticket.
 *
 * Remplacer la valeur par le vrai numéro dès qu'il est connu
 * (ex. '+261 34 00 000 00'). Si la valeur est vide, le message
 * « contacte le docteur » est affiché sans numéro.
 */
export const DOCTOR_PHONE: string | null = null

export function doctorContactLine(): string {
  return DOCTOR_PHONE
    ? `Si tu n’as pas encore l’ID et le numéro d’enregistrement, contacte le docteur à ce numéro : ${DOCTOR_PHONE}`
    : 'Si tu n’as pas encore l’ID et le numéro d’enregistrement, contacte le docteur pour en obtenir.'
}
