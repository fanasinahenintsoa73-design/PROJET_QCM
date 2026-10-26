import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, LockKeyhole, ShieldCheck } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ReceiptDropzone } from '@/components/ui/Receipt'
import { useToast } from '@/components/ui/Toast'
import { registerStudent } from '@/lib/db'
import { makeDemoReceipt } from '@/lib/demoReceipt'
import { usePageTitle } from '@/components/Layouts'
import type { Receipt } from '@/types'
import { cn } from '@/lib/utils'

type Errors = Partial<
  Record<'firstName' | 'lastName' | 'email' | 'password' | 'confirm' | 'receipt' | 'attestation' | 'form', string>
>

export function SignupPage() {
  usePageTitle('Créer ma demande — MEDQCM L1')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [attestation, setAttestation] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)

  function validate(): boolean {
    const next: Errors = {}
    if (firstName.trim().length < 2) next.firstName = 'Indiquez votre prénom.'
    if (lastName.trim().length < 2) next.lastName = 'Indiquez votre nom.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Saisissez une adresse email valide.'
    if (password.length < 8) next.password = 'Choisissez au moins 8 caractères.'
    if (confirm !== password) next.confirm = 'Les deux mots de passe ne correspondent pas.'
    if (!receipt) next.receipt = 'Le reçu de paiement est obligatoire pour transmettre votre demande.'
    if (!attestation) next.attestation = 'Confirmez que le justificatif correspond à votre paiement.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErrors({})
    if (!validate() || !receipt) return
    setSubmitting(true)
    try {
      registerStudent({ firstName, lastName, email, password, receipt })
      toast('Votre demande a été transmise au docteur.')
      navigate('/en-attente', { replace: true })
    } catch (caught) {
      setErrors({
        form: caught instanceof Error ? caught.message : 'Impossible d’enregistrer votre demande.',
      })
      setSubmitting(false)
    }
  }

  function useDemoReceipt() {
    setReceipt(makeDemoReceipt(`${firstName || 'etudiant'}-${lastName || 'demo'}`))
    setErrors((current) => ({ ...current, receipt: undefined }))
  }

  return (
    <AuthShell accessLabel="Espace étudiant">
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Demande d’accès</p>
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mute">01 — Identité & reçu</p>
        </div>
        <h1 className="display mt-4 text-[clamp(3.1rem,7.5vw,4.2rem)]">
          Ouvrir
          <br />
          mon dossier.
        </h1>
        <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-ash">
          Votre place se confirme en deux temps : votre dossier, puis la vérification de votre reçu par
          le docteur. Le QCM s’ouvre dès validation.
        </p>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit} noValidate>
          {errors.form && (
            <div className="border-l-2 border-sale bg-[#fdecec] px-4 py-3 text-[12px] leading-relaxed text-sale" role="alert">
              {errors.form}
            </div>
          )}

          <fieldset>
            <legend className="mb-3 flex w-full items-center gap-2 border-b border-hairline-soft pb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-mute">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-ink text-[9px] text-white">1</span>
              Votre identité
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom" htmlFor="signup-firstname" required error={errors.firstName}>
                <Input
                  id="signup-firstname"
                  autoComplete="given-name"
                  placeholder="Camille"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </Field>
              <Field label="Nom" htmlFor="signup-lastname" required error={errors.lastName}>
                <Input
                  id="signup-lastname"
                  autoComplete="family-name"
                  placeholder="Rousseau"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Adresse email" htmlFor="signup-email" required error={errors.email}>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="camille.rousseau@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 flex w-full items-center gap-2 border-b border-hairline-soft pb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-mute">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-ink text-[9px] text-white">2</span>
              Votre accès personnel
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Mot de passe"
                htmlFor="signup-password"
                required
                error={errors.password}
                hint="8 caractères minimum."
              >
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Choisissez un mot de passe"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              <Field label="Confirmation" htmlFor="signup-confirm" required error={errors.confirm}>
                <Input
                  id="signup-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Répétez le mot de passe"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 flex w-full items-center gap-2 border-b border-hairline-soft pb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-mute">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-ink text-[9px] text-white">3</span>
              Votre justificatif de paiement
            </legend>
            <div className="mb-3 grid grid-cols-2 gap-2 text-[10px] text-mute">
              <div className="bg-cloud px-3 py-2">
                <span className="block font-semibold uppercase tracking-[0.12em] text-ink">Formats</span>
                Photo, capture ou PDF
              </div>
              <div className="bg-cloud px-3 py-2">
                <span className="block font-semibold uppercase tracking-[0.12em] text-ink">Taille max</span>
                3 Mo · lisible et complet
              </div>
            </div>
            <ReceiptDropzone value={receipt} onChange={(value) => setReceipt(value)} compact />
            {errors.receipt && (
              <p className="mt-2 text-[12px] text-sale" role="alert">
                {errors.receipt}
              </p>
            )}
            <button
              type="button"
              onClick={useDemoReceipt}
              className="mt-2.5 text-[10px] font-medium text-mute underline decoration-1 underline-offset-4 transition hover:text-ink"
            >
              Utiliser un reçu de démonstration
            </button>
          </fieldset>

          <div>
            <label className="flex cursor-pointer items-start gap-3">
              <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  checked={attestation}
                  onChange={(event) => setAttestation(event.target.checked)}
                  className="peer h-4 w-4 appearance-none border border-hairline bg-white checked:border-ink checked:bg-ink"
                />
                <Check
                  size={11}
                  strokeWidth={3}
                  className={cn(
                    'pointer-events-none absolute text-white transition',
                    attestation ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </span>
              <span className="text-[11px] leading-relaxed text-ash">
                J’atteste avoir effectué le paiement et que ce justificatif m’appartient. Je comprends que
                l’accès ne sera ouvert qu’après vérification par le docteur.
              </span>
            </label>
            {errors.attestation && (
              <p className="mt-2 text-[12px] text-sale" role="alert">
                {errors.attestation}
              </p>
            )}
          </div>

          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Envoyer ma demande <ArrowRight size={16} />
          </Button>

          <div className="flex items-center justify-center gap-2 text-[10px] text-mute">
            <ShieldCheck size={12} />
            Validation humaine sous 24 h · QCM bloqué avant activation
          </div>

          <p className="text-center text-[11px] text-mute">
            J’ai déjà un dossier ?{' '}
            <Link to="/etudiant/connexion" className="font-medium text-ink underline decoration-1 underline-offset-4">
              Me connecter
            </Link>
          </p>
        </form>

        <p className="mt-6 flex items-start gap-2 border-t border-hairline-soft pt-4 text-[10px] leading-relaxed text-mute">
          <LockKeyhole size={11} className="mt-0.5 shrink-0" />
          Prototype local : votre reçu et vos données restent sur cet appareil. La version de production
          prévoit un stockage privé sécurisé.
        </p>
      </div>
    </AuthShell>
  )
}
