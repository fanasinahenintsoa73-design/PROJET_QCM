import { Plus } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { ButtonLink } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'

export default function NotFoundPage() {
  usePageTitle('Page introuvable — MEDQCM L1')
  const { user, homePath } = useAuth()

  return (
    <section className="bg-cloud">
      <div className="mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="grid gap-14 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="eyebrow">Erreur 404 · Hors programme</p>
            <h1 className="display mt-6 text-[clamp(4rem,10vw,8rem)]">
              Page
              <br />
              introuvable.
            </h1>
            <p className="mt-8 max-w-md text-[15px] leading-relaxed text-mute">
              La page que vous cherchez a peut-être été déplacée, archivée, ou n’a jamais
              figuré au programme. Revenez sur un terrain connu.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink to={user ? homePath : '/connexion'} size="lg">
                {user ? 'Retour à mon espace' : 'Se connecter'}
              </ButtonLink>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative aspect-[4/3] bg-canvas p-8 sm:p-10">
              <span className="absolute right-7 top-6 font-display text-5xl leading-none text-hairline">
                404
              </span>
              <div className="flex h-full flex-col justify-between">
                <span className="grid h-11 w-11 place-items-center bg-ink text-white">
                  <Plus size={22} strokeWidth={2.5} aria-hidden />
                </span>
                <div>
                  <p className="eyebrow">MEDQCM L1</p>
                  <p className="mt-3 max-w-[16rem] text-lg font-medium leading-snug">
                    20 questions. 30 jours. Aucune impasse.
                  </p>
                  <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-stone">
                    Prototype de démonstration
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
