import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth'
import { getDB } from '@/lib/db'
import { useToast } from '@/components/ui/Toast'
import { usePageTitle } from '@/components/Layouts'

export function LoginPage() {
  usePageTitle('Connexion docteur — MEDQCM L1')
  const { login } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    const account = getDB().users.find(
      (candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase(),
    )
    if (!account || account.role !== 'professor') {
      setError('Identifiants docteur incorrects.')
      return
    }

    const result = login(email, password)
    if (!result.ok) {
      setError(result.error)
      return
    }

    toast(`Bonjour Dr ${account.lastName}.`)
    navigate('/admin', { replace: true })
  }

  return (
    <AuthShell accessLabel="Espace docteur">
      <div>
        <div className="mb-9 flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-lg text-accent">
            SR
          </span>
          <div>
            <p className="text-[15px] font-medium text-ink">Dr Sun RAZAFIMANDIMBY</p>
            <p className="mt-0.5 text-[13px] text-mute">Docteur · Espace praticien</p>
          </div>
        </div>

        <h1 className="font-display text-[2.65rem] leading-[1.02] tracking-[-0.03em] text-ink sm:text-[3rem]">
          Accéder aux dossiers.
        </h1>
        <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-mute">
          Vérifiez les reçus, ouvrez les cycles et publiez les sujets du mois.
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
              placeholder="prof@medqcm.fr"
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

          <Button type="submit" size="lg" className="w-full">
            Se connecter <ArrowRight size={16} />
          </Button>
        </form>

        <div className="mt-7 flex items-center gap-2 border-t border-line pt-4 text-[12px] text-mute">
          <LockKeyhole size={13} /> Session séparée de l’espace étudiant.
        </div>
      </div>
    </AuthShell>
  )
}
