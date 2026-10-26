import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth'
import { getDB } from '@/lib/db'
import { studentHomePath } from '@/lib/access'
import { useToast } from '@/components/ui/Toast'
import { usePageTitle } from '@/components/Layouts'

export function StudentLoginPage() {
  usePageTitle('Connexion étudiant — MEDQCM L1')
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

    const db = getDB()
    const account = db.users.find(
      (candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase(),
    )
    if (!account || account.role !== 'student') {
      setError('Email ou mot de passe incorrect.')
      return
    }

    const result = login(email, password)
    if (!result.ok) {
      setError(result.error)
      return
    }

    toast(`Bonjour ${account.firstName}. Votre espace est ouvert.`)
    navigate(studentHomePath(account, getDB()), { replace: true })
  }

  return (
    <AuthShell accessLabel="Espace étudiant">
      <div>
        <p className="eyebrow">Carnet de préparation</p>
        <h1 className="display mt-4 text-[clamp(3.2rem,8vw,4.3rem)]">
          Connexion
          <br />
          étudiant.
        </h1>
        <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-ash">
          Retrouvez votre sujet, vos séries et vos corrections. Votre accès reste personnel et
          limité à votre cycle en cours.
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

          <Field label="Adresse email" htmlFor="student-login-email" required>
            <Input
              id="student-login-email"
              type="email"
              autoComplete="username"
              placeholder="votre.email@exemple.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>

          <Field label="Mot de passe" htmlFor="student-login-password" required>
            <div className="relative">
              <Input
                id="student-login-password"
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
            Ouvrir mon espace <ArrowRight size={16} />
          </Button>
        </form>

        <p className="mt-6 text-center text-[11px] text-mute">
          Pas encore de dossier ?{' '}
          <Link
            to="/etudiant/inscription"
            className="font-medium text-ink underline decoration-1 underline-offset-4"
          >
            Créer ma demande
          </Link>
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-hairline-soft pt-4 text-[10px] text-mute">
          <span className="inline-flex items-center gap-1.5">
            <LockKeyhole size={11} /> Accès personnel étudiant
          </span>
          <Link to="/connexion" className="underline decoration-1 underline-offset-4 hover:text-ink">
            Espace docteur
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
