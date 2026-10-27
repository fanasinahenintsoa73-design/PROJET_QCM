import { useState } from 'react'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/Toast'
import { usePageTitle } from '@/components/Layouts'

export function LoginPage() {
  usePageTitle('Connexion docteur — MEDQCM L1')
  const { login } = useAuth()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const result = await login(email, password, 'professor')
    if (!result.ok) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    toast(`Bonjour Dr ${result.user.lastName}.`)
    window.location.replace(result.homePath)
  }

  return (
    <AuthShell accessLabel="Espace docteur">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mute">
          Dr Sun RAZAFIMANDIMBY · Docteur
        </p>

        <h1 className="mt-5 font-display text-[2.65rem] leading-[1.02] tracking-[-0.03em] text-ink sm:text-[3rem]">
          Accéder aux dossiers.
        </h1>
        <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-mute">
          Reçus, cycles et sujets du mois.
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

          <Field label="Adresse email" htmlFor="login-email" required>
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="votre.email@exemple.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>

          <Field label="Mot de passe" htmlFor="login-password" required>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Votre mot de passe"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-mute transition hover:bg-cloud hover:text-ink"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Se connecter <ArrowRight size={16} />
          </Button>
        </form>

      </div>
    </AuthShell>
  )
}
