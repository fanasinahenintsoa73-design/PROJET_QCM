import { useState } from 'react'
import { ArrowRight, Check, LockKeyhole, ShieldCheck, TimerReset } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getNextSubjectForUser, submitRenewal } from '@/lib/db'
import { makeDemoReceipt } from '@/lib/demoReceipt'
import { usePageTitle } from '@/components/Layouts'
import { ReceiptDropzone } from '@/components/ui/Receipt'
import { Button } from '@/components/ui/Button'
import { StatusPill } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/Toast'
import type { Receipt } from '@/types'
import { cn, formatDateLong } from '@/lib/utils'

export function RenewalPage() {
  usePageTitle('Renouveler mon accès — MEDQCM L1')
  const { user, access, latestRequest, db } = useAuth()
  const { toast } = useToast()
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [attestation, setAttestation] = useState(false)
  const [errors, setErrors] = useState<{ receipt?: string; attestation?: string; form?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  if (!user) return null
  const studentId = user.id
  const rejected = access === 'rejected'
  const reason = user.rejectionReason || latestRequest?.note
  const nextSubject = getNextSubjectForUser(user.id, db)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const next: typeof errors = {}
    if (!receipt) next.receipt = 'Joignez votre nouveau reçu de paiement.'
    if (!attestation) next.attestation = 'Confirmez que ce justificatif correspond à votre paiement.'
    setErrors(next)
    if (Object.keys(next).length > 0 || !receipt) return
    setSubmitting(true)
    try {
      submitRenewal(studentId, receipt)
      toast('Votre demande de renouvellement a été transmise.')
      window.location.href = '/en-attente'
    } catch (caught) {
      setErrors({ form: caught instanceof Error ? caught.message : 'Impossible d’envoyer la demande.' })
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-10 sm:px-8 lg:px-10 lg:py-16">
        <div className="flex flex-col justify-between gap-3 border-b border-line pb-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-medium text-accent uppercase tracking-[0.14em]">Renouvellement · Accès mensuel</p>
            <h1 className="mt-1 font-display text-[2.2rem] leading-[1.05] tracking-[-0.03em] text-ink">Un nouveau mois commence.</h1>
          </div>
          <StatusPill tone={rejected ? 'error' : 'warning'}>
            {rejected ? 'Nouveau justificatif requis' : 'Accès à renouveler'}
          </StatusPill>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:gap-16">
          <div>
            <p className="text-[14px] leading-relaxed text-ash">
              {rejected
                ? 'Le justificatif précédent n’a pas été accepté. Vous pouvez déposer un nouveau reçu pour faire valoir un renouvellement. Le docteur vérifiera votre demande sous 24 heures.'
                : `Votre cycle s’est achevé le ${formatDateLong(user.expiresAt)}. Un nouveau sujet de la file vous est attribué automatiquement après validation du docteur.`}
            </p>
            {rejected && reason ? (
              <div className="mt-5 rounded-xl border border-sale/20 bg-danger-soft p-4">
                <p className="text-[11px] font-medium text-sale">Motif du refus</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ash">{reason}</p>
              </div>
            ) : null}

            <form className="mt-7 space-y-6" onSubmit={handleSubmit} noValidate>
              {errors.form && (
                <div className="rounded-lg border border-sale/20 bg-danger-soft px-4 py-3 text-[13px] text-sale" role="alert">{errors.form}</div>
              )}

              <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
                <h2 className="text-[15px] font-medium text-ink">Votre nouveau justificatif</h2>
                <p className="mt-2 text-[12px] leading-relaxed text-mute">Photo, capture ou PDF · 3 Mo maximum. Le reçu doit être lisible et complet.</p>
                <ReceiptDropzone value={receipt} onChange={(next) => { setReceipt(next); setErrors((c) => ({ ...c, receipt: undefined })); }} compact />
                <button type="button" onClick={() => setReceipt(makeDemoReceipt(`${user.firstName||'etudiant'}-${user.lastName||'demo'}`))} className="mt-2 text-[11px] text-mute underline decoration-line underline-offset-4 hover:text-accent">Utiliser un reçu de démonstration</button>
                {errors.receipt && <p className="mt-2 text-[12px] text-sale" role="alert">{errors.receipt}</p>}
              </div>

              <label className="flex cursor-pointer items-start gap-3 text-[12px] leading-relaxed text-ash">
                <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-accent" checked={attestation} onChange={(e) => { setAttestation(e.target.checked); setErrors((c) => ({ ...c, attestation: undefined })); }} />
                <span>Je certifie que ce reçu correspond à mon paiement et j’accepte que le docteur vérifie ces informations.</span>
              </label>
              {errors.attestation && <p className="text-[12px] text-sale" role="alert">{errors.attestation}</p>}

              <Button type="submit" size="lg" className="w-full sm:w-auto" loading={submitting}>
                Envoyer mon renouvellement <ArrowRight size={16} />
              </Button>

              <div className="flex flex-wrap items-center gap-4 text-[11px] leading-relaxed text-mute">
                <span className="inline-flex items-center gap-1.5"><LockKeyhole size={13} /> Démo locale : synchronisation avec l’espace docteur.</span>
                <a href="/app" className="text-mute underline decoration-line underline-offset-4 hover:text-accent">Retour au tableau de bord</a>
              </div>
            </form>
          </div>

          <aside className="rounded-2xl border border-line bg-accent-soft p-6 sm:p-8">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-white"><TimerReset size={16} /></span>
              <div>
                <p className="text-[13px] font-medium text-ink">Votre prochain cycle</p>
                <p className="text-[11px] text-mute">30 jours après validation</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-mute">Prochain sujet</span>
                <span className="text-[14px] font-medium text-ink">{nextSubject ? nextSubject.title : 'Attribué après validation'}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-mute">Durée</span>
                <span className="text-[14px] font-medium text-ink">30 jours</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-mute">Questions</span>
                <span className="text-[14px] font-medium text-ink">20</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-mute">Corrections</span>
                <span className="text-[14px] font-medium text-ink">Après envoi</span>
              </div>
            </div>
            <div className="mt-6 rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-start gap-2.5">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" />
                <p className="text-[11px] leading-relaxed text-ash">Le renouvellement ne crée pas de nouveau compte. Vous conservez vos résultats et votre historique. Le prochain sujet est choisi automatiquement parmi ceux jamais assignés.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
