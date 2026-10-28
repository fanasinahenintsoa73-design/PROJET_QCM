import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, LockKeyhole, ShieldCheck } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ReceiptDropzone } from '@/components/ui/Receipt'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { makeDemoReceipt } from '@/lib/demoReceipt'
import { usePageTitle } from '@/components/Layouts'
import type { Receipt } from '@/types'

type Errors = Partial<
  Record<
    'firstName' | 'lastName' | 'email' | 'password' | 'confirm' | 'receipt' | 'attestation' | 'form',
    string
  >
>

export function SignupPage() {
  usePageTitle('Créer un compte — MEDQCM L1')
  const { toast } = useToast()
  const { refresh } = useAuth()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [attestation, setAttestation] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)

  function validate(): Errors {
    const next: Errors = {}
    if (firstName.trim().length < 2) next.firstName = 'Indiquez votre prénom.'
    if (lastName.trim().length < 2) next.lastName = 'Indiquez votre nom.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Saisissez une adresse email valide.'
    }
    if (password.length < 8) next.password = 'Le mot de passe doit contenir au moins 8 caractères.'
    if (confirm !== password) next.confirm = 'Les deux mots de passe ne correspondent pas.'
    if (!receipt) next.receipt = 'Ajoutez votre reçu de paiement.'
    if (!attestation) next.attestation = 'Confirmez que le reçu correspond à votre paiement.'
    return next
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    try {
      await api.registerStudent({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        receipt: receipt!,
      })
      await refresh()
      toast('Votre demande a été transmise au docteur.')
      window.location.replace('/en-attente')
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'La demande n’a pas pu être enregistrée.',
      })
      setSubmitting(false)
    }
  }

  function useDemoReceipt() {
    setReceipt(makeDemoReceipt(`${firstName || 'etudiant'}-${lastName || 'demo'}`))
    setErrors((current) => ({ ...current, receipt: undefined }))
  }

  return (
    <AuthShell>
      <div className="pb-4">
        <h1 className="font-display text-[2.65rem] leading-[1.02] tracking-[-0.03em] text-ink sm:text-[3rem]">
          Créer un compte.
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-mute">
          Votre demande est vérifiée par le docteur. Le QCM s’ouvrira après validation de votre
          reçu de paiement.
        </p>

        <form className="mt-8 space-y-7" onSubmit={handleSubmit} noValidate>
          {errors.form && (
            <div className="rounded-lg border border-sale/20 bg-danger-soft px-4 py-3 text-[13px] leading-relaxed text-sale" role="alert">
              {errors.form}
            </div>
          )}

          <section>
            <div className="mb-4 flex items-baseline gap-2.5">
              <span className="text-[11px] font-semibold text-accent">01</span>
              <h2 className="text-[15px] font-medium text-ink">Votre identité</h2>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prénom" htmlFor="signup-first-name" required error={errors.firstName}>
                  <Input
                    id="signup-first-name"
                    autoComplete="given-name"
                    placeholder="Jean"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </Field>
                <Field label="Nom" htmlFor="signup-last-name" required error={errors.lastName}>
                  <Input
                    id="signup-last-name"
                    autoComplete="family-name"
                    placeholder="Dupont"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </Field>
              </div>
              <Field label="Adresse email" htmlFor="signup-email" required error={errors.email}>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="votre.email@exemple.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
            </div>
          </section>

          <section className="border-t border-line pt-6">
            <div className="mb-4 flex items-baseline gap-2.5">
              <span className="text-[11px] font-semibold text-accent">02</span>
              <h2 className="text-[15px] font-medium text-ink">Votre accès personnel</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Mot de passe"
                htmlFor="signup-password"
                required
                hint="8 caractères minimum."
                error={errors.password}
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
              <Field
                label="Confirmer"
                htmlFor="signup-confirm"
                required
                error={errors.confirm}
              >
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
            <p className="mt-3 text-[12px] leading-relaxed text-mute">
              Ce mot de passe est celui de votre compte MedicineQCM, pas celui de votre adresse
              e-mail. Il vous servira uniquement à vous connecter à la plateforme.
            </p>
          </section>

          <section className="border-t border-line pt-6">
            <div className="mb-2 flex items-baseline gap-2.5">
              <span className="text-[11px] font-semibold text-accent">03</span>
              <h2 className="text-[15px] font-medium text-ink">Votre justificatif</h2>
            </div>
            <p className="mb-4 text-[12px] leading-relaxed text-mute">
              Photo, capture d’écran ou PDF · 3 Mo maximum. Le reçu doit être lisible et complet.
            </p>
            <ReceiptDropzone
              value={receipt}
              onChange={(next) => {
                setReceipt(next)
                setErrors((current) => ({ ...current, receipt: undefined }))
              }}
              compact
            />
            {errors.receipt && (
              <p className="mt-2 text-[12px] text-sale" role="alert">
                {errors.receipt}
              </p>
            )}
            {!isSupabaseConfigured && (
              <button
                type="button"
                onClick={useDemoReceipt}
                className="mt-2 text-[11px] text-mute underline decoration-line underline-offset-4 transition hover:text-accent"
              >
                Utiliser un reçu de démonstration
              </button>
            )}
          </section>

          <section className="border-t border-line pt-5">
            <label className="flex cursor-pointer items-start gap-3 text-[12px] leading-relaxed text-ash">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                checked={attestation}
                onChange={(event) => {
                  setAttestation(event.target.checked)
                  setErrors((current) => ({ ...current, attestation: undefined }))
                }}
              />
              <span>
                Je certifie que ce reçu correspond à mon paiement et j’accepte que le docteur
                vérifie ces informations avant d’ouvrir mon accès.
              </span>
            </label>
            {errors.attestation && (
              <p className="mt-2 text-[12px] text-sale" role="alert">
                {errors.attestation}
              </p>
            )}
          </section>

          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Envoyer ma demande <ArrowRight size={16} />
          </Button>
        </form>

        <div className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-mute">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" />
          Validation humaine · le QCM reste fermé avant l’accord du docteur.
        </div>

        <p className="mt-5 border-t border-line pt-4 text-[12px] text-mute">
          Vous avez déjà un compte ?{' '}
          <Link to="/connexion" className="font-medium text-accent underline decoration-1 underline-offset-4">
            Me connecter
          </Link>
        </p>

        <div className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-mute">
          <LockKeyhole size={13} className="mt-0.5 shrink-0" />
          En production, le reçu est stocké dans un espace privé sécurisé.
        </div>
      </div>
    </AuthShell>
  )
}
