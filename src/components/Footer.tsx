import { Logo } from '@/components/Logo'

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-content items-center justify-between gap-6 px-5 py-8 lg:px-10">
        <Logo />
        <p className="text-right text-[11px] leading-relaxed text-mute">
          Entraînement mensuel
          <br />
          1ʳᵉ année de médecine
        </p>
      </div>
    </footer>
  )
}
