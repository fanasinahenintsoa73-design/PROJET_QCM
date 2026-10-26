import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'

const columns = [
  {
    title: 'La plateforme',
    links: [
      { label: 'La méthode', href: '/#methode' },
      { label: 'Le contenu', href: '/#contenu' },
      { label: 'Le docteur', href: '/#docteur' },
      { label: 'Questions fréquentes', href: '/#faq' },
    ],
  },
  {
    title: 'Étudiants',
    links: [
      { label: 'Créer mon dossier', href: '/inscription' },
      { label: 'Se connecter', href: '/connexion' },
      { label: 'Renouveler mon accès', href: '/reinscription' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-content px-5 py-12 lg:px-10 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-mute">
              L’entraînement QCM mensuel des étudiants en première année de médecine. Un sujet, un
              cycle, une correction expliquée.
            </p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="mb-4 text-[12px] font-medium text-ink">{column.title}</h3>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-[12px] leading-snug text-mute transition hover:text-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-5 text-[11px] text-mute sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} MEDQCM L1</span>
          <span>Deux espaces séparés · données synchronisées</span>
          <span>Conçu pour la 1ʳᵉ année de médecine</span>
        </div>
      </div>
    </footer>
  )
}

export function StudentFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto flex max-w-content flex-col gap-2 px-5 py-6 text-[11px] text-mute sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <span>© {new Date().getFullYear()} MEDQCM L1 — Entraînement mensuel.</span>
        <span>Vos résultats restent personnels.</span>
      </div>
    </footer>
  )
}
