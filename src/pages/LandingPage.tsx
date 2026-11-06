import { ArrowRight, Maximize2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ButtonLink } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import { useAuth } from '@/lib/auth'

const DOCTOR_PHOTO = '/docteur.jpg'

export function LandingPage() {
  usePageTitle('MEDQCM mada — Chers PACES')
  const { user, homePath } = useAuth()
  const studentUser = user?.role === 'student' ? user : null
  const startHref = studentUser ? homePath : '/inscription'
  const [photoOpen, setPhotoOpen] = useState(false)
  const [photoError, setPhotoError] = useState(false)

  // Fermeture de la photo en plein écran avec la touche Échap, et blocage
  // du défilement de la page derrière.
  useEffect(() => {
    if (!photoOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPhotoOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [photoOpen])

  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto max-w-[42rem] px-5 py-12 sm:px-8 lg:py-16">
        <p className="eyebrow">Le mot du docteur</p>

        {/* Photo ronde à gauche, nom à droite */}
        <div className="mt-6 flex items-center gap-4 sm:gap-5">
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            aria-label="Voir la photo du docteur en entier"
            className="relative shrink-0 overflow-hidden rounded-full border border-line bg-accent-soft shadow-soft transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {photoError ? (
              <span className="flex h-20 w-20 items-center justify-center font-display text-[22px] text-accent-deep sm:h-24 sm:w-24 sm:text-[26px]">
                Dr
              </span>
            ) : (
              <img
                src={DOCTOR_PHOTO}
                alt="Docteur RAZAFIMANDIMBY J."
                onError={() => setPhotoError(true)}
                className="h-20 w-20 object-cover object-top sm:h-24 sm:w-24"
              />
            )}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-ink/55 py-1 text-[10px] font-medium text-white">
              <Maximize2 size={11} />
              Agrandir
            </span>
          </button>
          <div>
            <h1 className="font-display text-[clamp(1.6rem,5vw,2.4rem)] leading-[1.05] tracking-[-0.02em] text-ink">
              Docteur RAZAFIMANDIMBY J.
            </h1>
            <p className="mt-1.5 text-[13px] text-mute">
              Touchez la photo pour la voir en entier.
            </p>
          </div>
        </div>

        {/* Long message, même police et même style que
            « Des séries de dix questions… » */}
        <div className="mt-8 space-y-5">
          <p className="text-[16px] leading-[1.65] text-mute">Chers PACES,</p>

          <p className="text-[16px] leading-[1.65] text-mute">
            Cette application est conçue pour vous accompagner dans vos révisions et vous aider
            à réussir le concours de passage en L2. Nous espérons qu’elle vous sera d’une grande
            aide tout au long de votre préparation.
          </p>

          <p className="text-[16px] leading-[1.65] text-mute">
            Ne cherchez pas seulement à retenir les bonnes réponses, cherchez avant tout à
            comprendre le pourquoi de chaque affirmation, qu’elle soit juste ou fausse !
          </p>

          <p className="text-[16px] leading-[1.65] text-mute">
            « La clé de la réussite en PACES : avoir suivi tous les cours en classe, comprendre
            les cours, les mémoriser, s’entraîner avec des QCM, puis réviser tous les jours. »
          </p>

          <p className="text-[16px] leading-[1.65] text-mute">
            Gardez confiance en vous, soyez persévérants et ne baissez jamais les bras. Chaque
            effort compte et chaque jour de révision vous rapproche de votre objectif !
          </p>

          <p className="text-[16px] leading-[1.65] text-mute">
            Des séries de dix questions, à votre rythme. Trente séries par cycle, avec la
            correction détaillée après chaque envoi.
          </p>

          <p className="text-[16px] leading-[1.65] text-mute">
            Je vous souhaite beaucoup de courage et surtout une excellente réussite !
          </p>
        </div>

        <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
          <ButtonLink to={startHref} size="lg" className="w-full sm:w-auto">
            {studentUser ? 'Ouvrir mon espace' : 'Créer compte'} <ArrowRight size={16} />
          </ButtonLink>
          <Link
            to="/connexion"
            className="inline-flex h-11 items-center text-[14px] font-medium text-ink underline decoration-line underline-offset-4 transition hover:text-accent hover:decoration-accent"
          >
            J’ai déjà un compte
          </Link>
        </div>
      </div>

      {/* Photo en entier, en plein écran */}
      {photoOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo du docteur en entier"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4"
          onClick={() => setPhotoOpen(false)}
        >
          <button
            type="button"
            aria-label="Fermer la photo"
            onClick={() => setPhotoOpen(false)}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X size={22} />
          </button>
          {photoError ? (
            <p className="max-w-sm text-center text-[15px] leading-relaxed text-white">
              La photo du docteur n’est pas encore ajoutée.
              <span className="mt-2 block text-[13px] text-white/70">
                Placez le fichier original sous le nom <code>docteur.jpg</code> dans le dossier{' '}
                <code>public/</code>.
              </span>
            </p>
          ) : (
            <img
              src={DOCTOR_PHOTO}
              alt="Docteur RAZAFIMANDIMBY J."
              onError={() => setPhotoError(true)}
              onClick={(event) => event.stopPropagation()}
              className="max-h-[90vh] w-auto max-w-full rounded-lg object-contain shadow-soft"
            />
          )}
        </div>
      ) : null}
    </section>
  )
}
