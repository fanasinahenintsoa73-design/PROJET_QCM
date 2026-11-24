import { ArrowRight, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ButtonLink } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import { useAuth } from '@/lib/auth'

const DOCTOR_PHOTO = '/docteur.jpg'
const DOCTOR_BG = '/doctor-bg.jpg'

const MESSAGE_LINES = [
  'Chers PACES,',
  'Cette application vous accompagne dans vos révisions de PACES pour réussir le concours de passage en L2, en cherchant avant tout à comprendre le pourquoi de chaque affirmation plutôt qu’à retenir les bonnes réponses.',
  'Suivez et comprenez les cours, mémorisez-les, entraînez-vous avec des QCM et révisez chaque jour avec confiance et persévérance : trente séries de dix questions, le mode MEDGAME, les supports de cours et les sujets de concours sont là pour vous.',
  'Je vous souhaite beaucoup de courage et surtout une excellente réussite !',
]

function TypedParagraph({
  text,
  greeting,
  start,
  onDone,
}: {
  text: string
  greeting?: boolean
  start: boolean
  onDone: () => void
}) {
  const [shown, setShown] = useState('')

  useEffect(() => {
    if (!start) return
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      setShown(text)
      onDone()
      return
    }
    let index = 0
    const timer = window.setInterval(() => {
      index += 1
      setShown(text.slice(0, index))
      if (index >= text.length) {
        window.clearInterval(timer)
        onDone()
      }
    }, 26)
    return () => window.clearInterval(timer)
  }, [start, text, onDone])

  const typing = start && shown.length < text.length

  return (
    <p
      className={`font-display text-[15px] leading-[1.6] text-white [text-shadow:0_1px_5px_rgba(0,0,0,0.55)] sm:text-[17px] ${
        greeting ? 'italic text-[17px] sm:text-[19px]' : ''
      }`}
    >
      {shown}
      {typing ? (
        <span className="ml-0.5 inline-block h-[1em] w-[1.5px] animate-pulse bg-white align-[-2px]" />
      ) : null}
    </p>
  )
}

export function LandingPage() {
  usePageTitle('MEDQCM mada — Chers PACES')
  const { user, homePath } = useAuth()
  const studentUser = user?.role === 'student' ? user : null
  const startHref = studentUser ? homePath : '/acces'
  const [photoOpen, setPhotoOpen] = useState(false)
  const [photoError, setPhotoError] = useState(false)
  const [activeLine, setActiveLine] = useState(0)
  const handleLineDone = useCallback(() => setActiveLine((current) => current + 1), [])

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
    <main className="relative min-h-screen overflow-hidden bg-accent-deep">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${DOCTOR_BG}')`, backgroundPosition: 'center 30%' }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-[#042817]/35 via-[#042817]/15 to-[#042817]/40"
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[540px] flex-col px-5 pb-6 pt-6 sm:px-8 sm:pt-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            aria-label="Voir la photo du docteur en entier"
            className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-full border-2 border-white/85 bg-accent-soft shadow-[0_5px_16px_rgba(0,0,0,0.22)] transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-accent-deep"
          >
            {photoError ? (
              <span className="flex h-full w-full items-center justify-center font-display text-[20px] text-accent-deep">
                Dr
              </span>
            ) : (
              <img
                src={DOCTOR_PHOTO}
                alt="Docteur RAZAFIMANDIMBY J."
                onError={() => setPhotoError(true)}
                className="h-full w-full object-cover object-top"
              />
            )}
          </button>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/75">
              Message du docteur
            </p>
            <h1 className="font-display text-[20px] leading-[1.1] text-white">
              Docteur RAZAFIMANDIMBY J.
            </h1>
          </div>
        </div>

        <div className="mt-11 flex-1 space-y-[17px]">
          {MESSAGE_LINES.map((line, index) => (
            <TypedParagraph
              key={index}
              text={line}
              greeting={index === 0}
              start={index <= activeLine}
              onDone={handleLineDone}
            />
          ))}
        </div>

        <div className="mt-8">
          <ButtonLink to={startHref} size="lg" className="w-full">
            {studentUser ? 'Ouvrir mon espace' : 'Accéder'} <ArrowRight size={16} />
          </ButtonLink>
        </div>

        <footer className="mt-5 flex items-center justify-between text-[10px] text-white/80">
          <span>© 2026 MEDQCM mada</span>
          <span>L1 santé</span>
        </footer>
      </div>

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
    </main>
  )
}
