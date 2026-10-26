import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, FileCheck2, LockKeyhole, ShieldCheck, TimerReset } from 'lucide-react'
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
  const navigate = useNavigate()
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
      navigate('/en-attente', { replace: true })
    } catch (caught) {
      setErrors({ form: caught instanceof Error ? caught.message : 'Impossible d’envoyer la demande.' })
      setSubmitting(false)
    }
  }

  return (
    <section className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-10 sm:px-10 lg:px-10 lg:py-16">
        <div className="flex flex-col justify-between gap-3 border-b border-hairline-soft pb-5 sm:flex-row sm:items-center">
          <p className="eyebrow">Renouvellement · Accès mensuel</p>
          <StatusPill tone={rejected ? 'error' : 'warning'}>
            {rejected ? 'Nouveau justificatif requis' : 'Accès à renouveler'}
          </StatusPill>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <h1 className="display text-[clamp(3.2rem,7vw,5.6rem)]">
              Un nouveau
              <br />
              mois commence.
            </h1>
            <p className="mt-5 max-w-xl text-[14px] leading-[1.7] text-ash">
              {rejected
                ? 'Transmettez un nouveau justificatif conforme pour que votre docteur puisse rouvrir votre accès. Aucun paiement n’est encaissé sur cette plateforme.'
                : nextSubject
                  ? 'Le nouveau sujet est en ligne. Joignez votre nouveau reçu de paiement : votre docteur le vérifie sous 24 heures, puis votre accès repart pour 30 jours.'
                  : 'Le prochain sujet n’est pas encore disponible. Vous pouvez tout de même envoyer votre renouvellement : il restera en attente jusqu’à ce que le docteur ajoute un sujet à la file.'}
            </p>

            {rejected && reason && (
              <div className="mt-5 border-l-2 border-sale bg-[#fdecec] px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-sale">
                  Motif du dernier refus
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ash">{reason}</p>
              </div>
            )}

            <form className="mt-8" onSubmit={handleSubmit} noValidate>
              {errors.form && (
                <div className="mb-5 border-l-2 border-sale bg-[#fdecec] px-4 py-3 text-[12px] text-sale" role="alert">
                  {errors.form}
                </div>
              )}

              <div className="border border-hairline-soft">
                <div className="border-b border-hairline-soft bg-cloud px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em]">
                    Compte à renouveler
                  </p>
                </div>
                <div className="grid gap-4 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mute">Titulaire</p>
                    <p className="mt-1 text-[13px]">
                      {user.firstName} {user.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mute">Email</p>
                    <p className="mt-1 break-all text-[13px]">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mute">
                      Dernière échéance
                    </p>
                    <p className="mt-1 text-[13px]">
                      {user.expiresAt ? formatDateLong(user.expiresAt) : 'Aucune période active'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mute">Offre</p>
                    <p className="mt-1 text-[13px]">Accès QCM mensuel — 30 jours</p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <p className="form-label">Nouveau justificatif de paiement *</p>
                <p className="mb-3 text-[11px] leading-relaxed text-mute">
                  Photo, capture d’écran ou PDF. Le document doit être lisible, complet et daté.
                </p>
                <ReceiptDropzone
                  value={receipt}
                  onChange={(value) => {
                    setReceipt(value)
                    setErrors((current) => ({ ...current, receipt: undefined }))
                  }}
                  label="Joindre le nouveau reçu"
                  compact
                />
                {errors.receipt && (
                  <p className="mt-2 text-[12px] text-sale" role="alert">
                    {errors.receipt}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setReceipt(makeDemoReceipt(`renouvellement-${user.firstName}`))
                    setErrors((current) => ({ ...current, receipt: undefined }))
                  }}
                  className="mt-2.5 text-[10px] font-medium text-mute underline decoration-1 underline-offset-4 transition hover:text-ink"
                >
                  Utiliser un reçu de démonstration
                </button>
              </div>

              <div className="mt-6">
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
                    J’atteste que ce justificatif correspond à mon paiement pour le nouveau mois et
                    j’accepte que l’accès soit ouvert après vérification par le docteur.
                  </span>
                </label>
                {errors.attestation && (
                  <p className="mt-2 text-[12px] text-sale" role="alert">
                    {errors.attestation}
                  </p>
                )}
              </div>

              <Button type="submit" size="lg" className="mt-6 w-full sm:w-auto" loading={submitting}>
                Envoyer mon renouvellement <ArrowRight size={16} />
              </Button>

              <p className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-mute">
                <LockKeyhole size={11} className="mt-0.5 shrink-0" />
                Le QCM reste fermé jusqu’à la validation. Vous serez redirigé vers le suivi de votre
                dossier.
              </p>
            </form>

            <div className="mt-8 flex flex-wrap items-center gap-5 border-t border-hairline-soft pt-5 text-[11px] text-mute">
              <Link to="/expiration" className="underline decoration-1 underline-offset-4 hover:text-ink">
                Retour à mon statut
              </Link>
              <Link to="/" className="underline decoration-1 underline-offset-4 hover:text-ink">
                Accueil
              </Link>
            </div>
          </div>

          <aside className="lg:col-span-5">
            <div className="bg-ink p-6 text-white sm:p-8">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  Votre prochain cycle
                </p>
                <TimerReset size={16} className="text-white/40" />
              </div>
              <p className="mt-6 font-display text-[clamp(5rem,10vw,7.5rem)] leading-[0.75]">30</p>
              <p className="mt-3 font-display text-[26px] uppercase leading-none text-white/80">
                jours d’accès
              </p>
              <p className="mt-3 text-[12px] leading-relaxed text-white/45">
                À compter de la validation de votre nouveau reçu, pas de la date d’envoi.
              </p>

              <div className="mt-7 space-y-4 border-t border-white/15 pt-5">
                {[
                  ['01', 'Vous envoyez votre reçu', 'Un seul justificatif suffit.'],
                  ['02', 'Le docteur vérifie', 'Délai habituel : moins de 24 heures.'],
                  [
                    '03',
                    nextSubject ? 'Le QCM se rouvre' : 'Le dossier reste en attente',
                    nextSubject
                      ? 'Nouveau sujet, nouvelles séries illimitées.'
                      : 'L’accès s’ouvrira dès qu’un sujet sera disponible.',
                  ],
                ].map(([number, title, detail]) => (
                  <div key={number} className="flex gap-3">
                    <span className="font-display text-[20px] leading-none text-white/30">{number}</span>
                    <div>
                      <p className="text-[11px] font-medium">{title}</p>
                      <p className="mt-0.5 text-[10px] text-white/40">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ash">
                <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                Vérification humaine et confidentielle. Votre reçu n’est jamais rendu public.
              </p>
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ash">
                <FileCheck2 size={14} className="mt-0.5 shrink-0" />
                Une demande refusée n’efface ni votre compte ni vos séries précédentes.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
