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
  usePageTitle('Connexion administrateur — MEDQCM L1')
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
      setError('Identifiants administrateur incorrects.')
      return
    }

    const result = login(email, password)
    if (!result.ok) {
      setError(result.error)
      return
    }

    toast(`Bonjour ${account.firstName}. Espace administrateur ouvert.`)
    navigate('/admin/sujet#importer', { replace: true })
  }

  return (
    <AuthShell>
      <div>
        <p className="eyebrow">Espace administrateur</p>
        <h1 className="display mt-4 text-[clamp(3.2rem,8vw,4.3rem)]">
          Connexion
          <br />
          administrateur.
        </h1>
        <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-ash">
          Cet accès est réservé à l’administrateur. Identifiez-vous avec votre adresse email et
          votre mot de passe.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div
              className="border-l-2 border-sale bg-[#fdecec] px-4 py-3 text-[12px] leading-relaxed text-sale"
              role="alert"
            >
              {error}
            </div>
          )}

          <Field label="Identifiant" htmlFor="login-email" required>
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="Adresse email administrateur"
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
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-mute transition hover:bg-white hover:text-ink"
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

        <div className="mt-6 text-[10px] text-mute">
          <span className="inline-flex items-center gap-1.5">
            <LockKeyhole size={11} /> Accès réservé — identifiants administrateur requis
          </span>
        </div>
      </div>
    </AuthShell>
  )
}
