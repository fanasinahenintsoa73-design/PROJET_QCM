import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldCheck, TimerReset } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { usePageTitle } from '@/components/Layouts'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { StatusPill } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/Toast'
import { SERIES_LIMIT, SERIES_SIZE } from '@/lib/utils'

export function RenewalPage() {
  usePageTitle('Renouveler mon accès — MEDQCM L1')
  const { user, access, latestRequest, refresh } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState(() =>
    user ? `${user.firstName} ${user.lastName}`.trim() : '',
  )
  const [email, setEmail] = useState(user?.email ?? '')
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; form?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  if (!user) return null

  const studentId = user.id
  const rejected = access === 'rejected'
  const reason = user.rejectionReason || latestRequest?.note

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const next: typeof errors = {}
    if (!fullName.trim()) next.fullName = 'Indiquez votre nom et prénom.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Saisissez une adresse email valide.'
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    try {
      await api.renewNow(studentId, fullName.trim(), email.trim())
      await refresh()
      toast('Votre nouveau cycle de 30 séries est ouvert.')
      navigate('/app', { replace: true })
    } catch (caught) {
      setErrors({
        form: caught instanceof Error ? caught.message : 'Le renouvellement n’a pas pu être ouvert.',
      })
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-10 sm:px-8 lg:px-10 lg:py-16">
        <div className="flex flex-col justify-between gap-3 border-b border-line pb-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent">
              Renouvellement · Cycle de 30 séries
            </p>
            <h1 className="mt-1 font-display text-[2.2rem] leading-[1.05] tracking-[-0.03em] text-ink">
              Un nouveau cycle commence.
            </h1>
          </div>
          <StatusPill tone={rejected ? 'error' : 'warning'}>
            {rejected ? 'Dossier non accepté' : 'Cycle terminé'}
          </StatusPill>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:gap-16">
          <div>
            <p className="max-w-xl text-[14px] leading-relaxed text-ash">
              {rejected
                ? 'Le renouvellement ouvre immédiatement un nouveau cycle de 30 séries, avec les neuf thèmes et un compteur remis à zéro.'
                : 'Vérifiez vos informations puis ouvrez immédiatement votre prochain cycle de 30 séries.'}
            </p>
            {rejected && reason ? (
              <div className="mt-5 rounded-xl border border-sale/20 bg-danger-soft p-4">
                <p className="text-[11px] font-medium text-sale">Motif du refus</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ash">{reason}</p>
              </div>
            ) : null}

            <form className="mt-7 space-y-6" onSubmit={handleSubmit} noValidate>
              {errors.form && (
                <div
                  className="rounded-lg border border-sale/20 bg-danger-soft px-4 py-3 text-[13px] text-sale"
                  role="alert"
                >
                  {errors.form}
                </div>
              )}

              <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
                <h2 className="text-[15px] font-medium text-ink">Vos informations</h2>
                <div className="mt-4 space-y-4">
                  <Field
                    label="Nom et prénom"
                    htmlFor="renewal-full-name"
                    required
                    error={errors.fullName}
                  >
                    <Input
                      id="renewal-full-name"
                      autoComplete="name"
                      placeholder="Clara Fontaine"
                      value={fullName}
                      onChange={(event) => {
                        setFullName(event.target.value)
                        setErrors((current) => ({ ...current, fullName: undefined }))
                      }}
                    />
                  </Field>
                  <Field label="Email" htmlFor="renewal-email" required error={errors.email}>
                    <Input
                      id="renewal-email"
                      type="email"
                      autoComplete="email"
                      placeholder="votre.email@exemple.com"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value)
                        setErrors((current) => ({ ...current, email: undefined }))
                      }}
                    />
                  </Field>
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full sm:w-auto" loading={submitting}>
                Prêt à payer <ArrowRight size={16} />
              </Button>

              <p className="text-[11px] leading-relaxed text-mute">
                Paiement simulé pour le moment. Le nouveau cycle s’ouvre immédiatement.
              </p>
            </form>
          </div>

          <aside className="rounded-2xl border border-line bg-accent-soft p-6 sm:p-8">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-white">
                <TimerReset size={16} />
              </span>
              <div>
                <p className="text-[13px] font-medium text-ink">Votre prochain cycle</p>
                <p className="text-[11px] text-mute">Ouverture immédiate</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[11px] text-mute">Thèmes accessibles</span>
                <span className="max-w-[62%] text-right text-[13px] font-medium text-ink">
                  Les 9 thèmes PACES
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[11px] text-mute">Séries incluses</span>
                <span className="max-w-[62%] text-right text-[13px] font-medium text-ink">
                  {SERIES_LIMIT} séries
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-mute">Questions par série</span>
                <span className="text-[14px] font-medium text-ink">{SERIES_SIZE}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-mute">Corrections</span>
                <span className="text-[14px] font-medium text-ink">Après envoi</span>
              </div>
            </div>
            <div className="mt-6 rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-start gap-2.5">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" />
                <p className="text-[11px] leading-relaxed text-ash">
                  Le renouvellement ne crée pas de nouveau compte. Le compteur repart à zéro et
                  l’historique du cycle précédent n’est plus affiché. Aucun résultat n’est supprimé.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
