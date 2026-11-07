import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole, LogOut, Phone } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/Toast'
import { usePageTitle } from '@/components/Layouts'
import { doctorContactLine } from '@/lib/contact'

export function TicketAccessPage() {
  usePageTitle('Accès ticket — MEDQCM mada')
  const { user, access, ticketBlocked, ticketLogin, logout } = useAuth()
  const { toast } = useToast()
  const [code, setCode] = useState('')
  const [secret, setSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
    <AuthShell>
      <div>
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
              placeholder="PACES0001"
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
    </AuthShell>
  )
}
