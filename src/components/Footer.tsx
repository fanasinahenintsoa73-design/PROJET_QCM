import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

const columns = [
  {
    title: 'La plateforme',
    links: [
      { label: 'La méthode', href: '/#methode' },
      { label: 'Le parcours', href: '/#sujet' },
      { label: 'Le docteur', href: '/#docteur' },
      { label: 'Questions fréquentes', href: '/#faq' },
    ],
  },
  {
    title: 'Étudiants',
    links: [
      { label: 'Créer ma demande', href: '/inscription' },
      { label: 'Se connecter', href: '/connexion' },
      { label: 'Renouveler mon accès', href: '/reinscription' },
      { label: 'Mon tableau de bord', href: '/app' },
    ],
  },
  {
    title: 'Docteur',
    links: [
      { label: 'Pilotage', href: '/admin' },
      { label: 'Demandes & reçus', href: '/admin/demandes' },
      { label: 'Gérer les sujets', href: '/admin/sujet' },
      { label: 'Étudiants', href: '/admin/etudiants' },
    ],
  },
  {
    title: 'Accès',
    links: [
      { label: 'Téléphone · tablette · ordinateur', href: '/#methode' },
      { label: 'Disponible 24 h / 24', href: '/#methode' },
      { label: 'Validation sous 24 h', href: '/#faq' },
      { label: 'Zéro installation', href: '/#faq' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-hairline-soft bg-white">
      <div className="mx-auto max-w-content px-5 py-12 lg:px-10 lg:py-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="mb-5 text-[12px] font-semibold">{column.title}</h3>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="group inline-flex items-start gap-1 text-[12px] leading-snug text-mute transition hover:text-ink"
                    >
                      {link.label}
                      {column.title === 'Docteur' && (
                        <ArrowUpRight
                          size={11}
                          className="mt-0.5 opacity-0 transition group-hover:opacity-100"
                        />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-hairline-soft pt-6 text-[10px] text-mute md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>© {new Date().getFullYear()} MEDQCM L1</span>
            <span>Prototype de démonstration — les données restent sur cet appareil.</span>
          </div>
          <div className="flex items-center gap-5">
            <span>Conçu pour la 1ʳᵉ année de médecine</span>
            <span className="hidden h-3 w-px bg-hairline sm:block" />
            <span>FR</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export function StudentFooter() {
  return (
    <footer className="mt-16 border-t border-hairline-soft bg-white">
      <div className="mx-auto flex max-w-content flex-col gap-2 px-5 py-6 text-[10px] text-mute md:flex-row md:items-center md:justify-between lg:px-10">
        <span>© {new Date().getFullYear()} MEDQCM L1 — Entraînement mensuel.</span>
        <span>Prototype de démonstration — données locales.</span>
      </div>
    </footer>
  )
}
