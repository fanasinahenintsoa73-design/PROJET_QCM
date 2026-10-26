import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-content px-5 py-8 lg:px-10 lg:py-10">
        <div>
          <Logo />
          <span className="mt-3 block text-[11px] text-mute">MEDQCM L1 — Entraînement mensuel.</span>
        </div>

        <div className="mt-8 border-t border-line pt-5 text-[11px] text-mute">
          <span>© {new Date().getFullYear()} MEDQCM L1</span>
          <span>Conçu pour la 1ʳᵉ année de médecine</span>
        </div>
      </div>
    </footer>
  )
}

export function StudentFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto max-w-content px-5 py-2 lg:px-10" />
    </footer>
  )
}
