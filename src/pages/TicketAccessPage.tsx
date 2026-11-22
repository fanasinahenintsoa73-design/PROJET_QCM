import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole, LogOut, Phone, X } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { Logo } from '@/components/Logo'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/Toast'
import { usePageTitle } from '@/components/Layouts'
import { doctorContactLine } from '@/lib/contact'

const DOCTOR_PHOTO = '/docteur.jpg'

// Le message long est partagé entre le panneau desktop et la fenêtre
// plein écran ouverte depuis le en-tête compact sur mobile.
function DoctorMessage() {
  return (
    <div className="space-y-4 font-display text-[15px] leading-[1.75] text-white/90 sm:text-[16px] sm:leading-[1.8]">
      <p className="text-[17px] italic text-white sm:text-[18px]">Chers PACES,</p>

      <p>
        Cette application est conçue pour vous accompagner dans vos révisions et vous aider
        à réussir le concours de passage en L2. Nous espérons qu’elle vous sera d’une grande
        aide tout au long de votre préparation.
      </p>

      <p>
        Ne cherchez pas seulement à retenir les bonnes réponses, cherchez avant tout à
        comprendre le pourquoi de chaque affirmation, qu’elle soit juste ou fausse !
      </p>

      <blockquote className="relative rounded-xl border-l-2 border-white/70 bg-white/10 px-5 py-4 italic text-white">
        <span className="absolute -top-2 left-3 font-display text-4xl leading-none text-white/40">
          “
        </span>
        La clé de la réussite en PACES : avoir suivi tous les cours en classe, comprendre
        les cours, les mémoriser, s’entraîner avec des QCM, puis réviser tous les jours.
      </blockquote>

      <p>
        Gardez confiance en vous, soyez persévérants et ne baissez jamais les bras. Chaque
        effort compte et chaque jour de révision vous rapproche de votre objectif !
      </p>

      <p>
        Des QCM à votre rythme : 30 séries de dix questions, ou le mode MEDGAME, chapitre par
        chapitre.
      </p>

      <p>
        Retrouvez également les supports de cours et les sujets de concours, pour réviser et
        vous entraîner dans les meilleures conditions.
      </p>

      <p className="text-white">Je vous souhaite beaucoup de courage et surtout une excellente réussite !</p>
    </div>
  )
}

export function TicketAccessPage() {
  usePageTitle('Accès ticket — MEDQCM mada')
  const { user, access, ticketBlocked, ticketLogin, logout } = useAuth()
  const { toast } = useToast()
  const [code, setCode] = useState('')
  const [secret, setSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [photoError, setPhotoError] = useState(false)
  const [messageOpen, setMessageOpen] = useState(false)

  // Fermeture des fenêtres plein écran avec la touche Échap, et blocage
  // du défilement de la page derrière.
  useEffect(() => {
    if (!photoOpen && !messageOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPhotoOpen(false)
        setMessageOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [photoOpen, messageOpen])

  // Une session déjà ouverte : on redirige selon l'état d'accès.
  if (user) {
    if (ticketBlocked || access === 'expired' || access === 'rejected') {
      return <Navigate to="/expiration" replace />
    }
    if (access === 'active') return <Navigate to="/app" replace />
    // Ancien compte e-mail (le parcours par ticket a remplacé l'inscription).
    return (
      <AuthShell>
        <div>
          <h1 className="font-display text-[2.65rem] leading-[1.02] tracking-[-0.03em] text-ink sm:text-[3rem]">
            Ce compte n’est plus utilisé.
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-mute">
            L’accès se fait maintenant par ticket : achète un ticket au docteur (ID +
            numéro d’enregistrement), puis reviens ici pour entrer.
          </p>
          <Button className="mt-8" variant="outline" onClick={() => void logout()}>
            <LogOut size={15} /> Se déconnecter
          </Button>
        </div>
      </AuthShell>
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const result = await ticketLogin(code, secret)
    if (!result.ok) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    toast('Bonjour ! Ton accès est actif.')
    window.location.replace(result.homePath)
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Panneau vert de base : la photo et le message du docteur */}
        <section className="relative overflow-hidden bg-accent px-6 py-10 text-white sm:px-10 lg:px-14 lg:py-14">
          {/* Décor discret pour donner de la profondeur sans distraire */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-accent-deep/50" />
          <div className="pointer-events-none absolute right-10 top-1/3 hidden h-40 w-40 rounded-full border border-white/10 lg:block" />

          <div className="relative mx-auto flex h-full max-w-[34rem] flex-col">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white/60">
              MEDQCM MADA — L1 SANTÉ
            </p>

            <div className="mt-8 flex items-center gap-4 sm:gap-5">
              <button
                type="button"
                onClick={() => {
                  setMessageOpen(false)
                  setPhotoOpen(true)
                }}
                aria-label="Voir la photo du docteur en entier"
                className="relative shrink-0 overflow-hidden rounded-full border-2 border-white/70 bg-white/10 shadow-lg transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-accent"
              >
                {photoError ? (
                  <span className="flex h-24 w-24 items-center justify-center font-display text-2xl text-white sm:h-28 sm:w-28 sm:text-3xl">
                    Dr
                  </span>
                ) : (
                  <img
                    src={DOCTOR_PHOTO}
                    alt="Docteur RAZAFIMANDIMBY J."
                    onError={() => setPhotoError(true)}
                    className="h-24 w-24 object-cover object-top sm:h-28 sm:w-28"
                  />
                )}
              </button>
              <div>
                <h2 className="font-display text-[clamp(1.35rem,4vw,1.9rem)] leading-[1.1] tracking-[-0.02em]">
                  Docteur RAZAFIMANDIMBY J.
                </h2>
              </div>
            </div>

            {/* Sur mobile : en-tête compact et bouton pour lire le message long en plein écran */}
            <div className="mt-6 lg:hidden">
              <p className="font-display text-[17px] italic text-white">Chers PACES,</p>
              <p className="mt-2 text-[14px] leading-relaxed text-white/85">
                Cette application est conçue pour vous accompagner dans vos révisions et vous aider
                à réussir le concours de passage en L2.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPhotoOpen(false)
                  setMessageOpen(true)
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Lire le message du docteur <ArrowRight size={15} />
              </button>
            </div>

            {/* Sur desktop : le message long reste affiché directement dans le panneau */}
            <div className="mt-8 hidden lg:block">
              <DoctorMessage />
            </div>

            <div className="mt-7 hidden items-center gap-2 text-[12px] text-white/60 lg:flex">
              <span className="h-px w-8 bg-white/40" />
              Prépare ton concours, une série à la fois.
            </div>
          </div>
        </section>

        {/* Panneau formulaire : le login étudiant actuel, placé dans la mise en page */}
        <section className="flex flex-col bg-surface px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
          <div className="flex items-center justify-between gap-3">
            <Logo />
          </div>

          <main className="flex flex-1 items-center justify-center py-10 sm:py-14">
            <div className="w-full max-w-[440px]">
              <h1 className="font-display text-[2.65rem] leading-[1.02] tracking-[-0.03em] text-ink sm:text-[3rem]">
                Accède à tes séries.
              </h1>
              <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-mute">
                Entre l’ID et le numéro d’enregistrement de ton ticket pour retrouver
                les neuf thèmes PACES et tes corrections détaillées.
              </p>

              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                {error && (
                  <div
                    className="rounded-lg border border-sale/20 bg-danger-soft px-4 py-3 text-[13px] leading-relaxed text-sale"
                    role="alert"
                  >
                    {error}
                  </div>
                )}

                <Field label="ID du ticket" htmlFor="ticket-access-code" required>
                  <Input
                    id="ticket-access-code"
                    type="text"
                    autoComplete="username"
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    required
                  />
                </Field>

                <Field label="Numéro d’enregistrement" htmlFor="ticket-access-secret" required>
                  <div className="relative">
                    <Input
                      id="ticket-access-secret"
                      type={showSecret ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Numéro sur ton ticket"
                      value={secret}
                      onChange={(event) => setSecret(event.target.value.toUpperCase())}
                      className="pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((value) => !value)}
                      className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-mute transition hover:bg-cloud hover:text-ink"
                      aria-label={showSecret ? 'Masquer le numéro' : 'Afficher le numéro'}
                    >
                      {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>

                <Button type="submit" size="lg" className="w-full" loading={submitting}>
                  Accéder <ArrowRight size={16} />
                </Button>
              </form>

              <div className="mt-7 flex items-start gap-2 border-t border-line pt-4 text-[12px] leading-relaxed text-mute">
                <Phone size={13} className="mt-0.5 shrink-0" />
                <span>{doctorContactLine()}</span>
              </div>

              <div className="mt-3 flex items-center gap-2 text-[12px] text-mute">
                <LockKeyhole size={13} /> Un ticket correspond à une seule personne et à 30 séries.
              </div>
            </div>
          </main>

          <div className="flex items-center justify-between gap-3 border-t border-line pt-4 text-[11px] text-mute">
            <span>© {new Date().getFullYear()} MEDQCM mada</span>
            <span>L1 santé</span>
          </div>
        </section>
      </div>

      {/* Message long du docteur, en plein écran depuis le en-tête mobile */}
      {messageOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Message du docteur"
          className="fixed inset-0 z-50 overflow-y-auto bg-accent text-white"
        >
          <button
            type="button"
            onClick={() => setMessageOpen(false)}
            aria-label="Fermer le message"
            className="fixed right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X size={22} />
          </button>
          <div className="relative mx-auto max-w-[42rem] px-6 py-10 sm:px-10 sm:py-14">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white/60">
              MEDQCM MADA — L1 SANTÉ
            </p>
            <div className="mt-6 flex items-center gap-4">
              <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/70 bg-white/10 font-display text-xl">
                {photoError ? 'Dr' : <img src={DOCTOR_PHOTO} alt="Docteur RAZAFIMANDIMBY J." onError={() => setPhotoError(true)} className="h-full w-full object-cover object-top" />}
              </span>
              <div>
                <h2 className="font-display text-[clamp(1.35rem,4vw,1.9rem)] leading-[1.1] tracking-[-0.02em]">
                  Docteur RAZAFIMANDIMBY J.
                </h2>
              </div>
            </div>
            <div className="mt-8">
              <DoctorMessage />
            </div>
          </div>
        </div>
      ) : null}

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
    </div>
  )
}
