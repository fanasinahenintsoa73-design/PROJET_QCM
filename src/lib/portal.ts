export type Portal = 'student' | 'doctor'

/**
 * In production the two portals are separate origins:
 *   etudiant.medqcm.fr  → student
 *   docteur.medqcm.fr   → doctor
 *
 * The local development server uses the same host prefixes:
 *   etudiant.localhost:5173 and docteur.localhost:5173
 */
export function getPortal(): Portal {
  if (typeof window === 'undefined') return 'student'
  const host = window.location.hostname.toLowerCase()
  if (host.startsWith('docteur.') || host.startsWith('docteur-')) return 'doctor'
  if (host.startsWith('prof.') || host.startsWith('admin.')) return 'doctor'
  return 'student'
}

export const portal = getPortal()
export const isDoctorPortal = portal === 'doctor'
export const isStudentPortal = portal === 'student'

export const portalHome = isDoctorPortal ? '/admin' : '/'
export const portalLogin = isDoctorPortal ? '/' : '/connexion'
