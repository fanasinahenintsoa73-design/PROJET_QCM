import { useAuth } from '@/lib/auth'
import { isDoctorPortal } from '@/lib/portal'
import { ButtonLink } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import { Logo } from '@/components/Logo'

export default function NotFoundPage() {
  usePageTitle('Page introuvable — MEDQCM L1')
  const { user, homePath } = useAuth()
  const fallback = isDoctorPortal ? '/' : '/'
  const target = user ? homePath : fallback

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-[68px] max-w-content items-center justify-between px-5 lg:px-10">
          <Logo to={isDoctorPortal ? '/' : '/'} />
          <span className="text-[11px] font-medium text-mute">
            {isDoctorPortal ? 'Espace docteur' : 'Espace étudiant'}
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-content flex-1 items-center px-5 py-12 sm:px-8 lg:px-10">
        <div className="grid w-full gap-10 lg:grid-cols-[1fr_0.72fr] lg:items-center">
          <div>
            <p className="text-[12px] font-medium text-accent">Erreur 404</p>
            <h1 className="mt-4 max-w-lg font-display text-[clamp(2.7rem,6vw,4.6rem)] leading-[1.02] tracking-[-0.03em] text-ink">
              Cette page n’existe pas.
            </h1>
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-mute">
              Le lien est peut-être incomplet, ou la page a été déplacée. Revenez à votre espace
              pour retrouver votre cycle, vos séries et vos corrections.
            </p>
            <ButtonLink to={target} size="lg" className="mt-7">
              {user ? 'Retour à mon espace' : 'Retour à l’accueil'}
            </ButtonLink>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <p className="font-display text-[5.5rem] leading-none tracking-[-0.04em] text-accent/20">
              404
            </p>
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-[13px] font-medium text-ink">MEDQCM L1</p>
              <p className="mt-1 text-[12px] leading-relaxed text-mute">
                20 questions. 30 jours. Aucune impasse.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
