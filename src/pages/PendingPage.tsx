import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowRight, Check, FileText, Hourglass, LockKeyhole, Mail } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { usePageTitle } from '@/components/Layouts'
import { StatusPill } from '@/components/ui/StatusPill'
import { Modal } from '@/components/ui/Modal'
import { ButtonLink } from '@/components/ui/Button'
import type { Receipt } from '@/types'
import { formatBytes, formatDateTime, formatDateLong } from '@/lib/utils'

export function PendingPage() {
  usePageTitle('Dossier en vérification — MEDQCM L1')
  const { user, latestRequest, pendingRequest, access } = useAuth()
  const [receiptOpen, setReceiptOpen] = useState(false)

  if (!user) return null
  if (access === 'rejected' || access === 'expired') return <Navigate to="/expiration" replace />

  const request = pendingRequest ?? latestRequest
  const validated = access === 'active'

  return (
    <section className="bg-canvas">
      <div className="mx-auto flex max-w-content justify-center px-5 py-12 sm:px-8 lg:py-20">
        <div className="w-full max-w-[720px]">
          {validated ? (
            <div className="rounded-2xl border border-line bg-surface p-6 sm:p-10">
              <StatusPill tone="success" dot>
                Inscription validée
              </StatusPill>
              <h1 className="mt-6 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
                Votre inscription est validée.
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mute">
                Votre dossier a été accepté par le docteur. Votre cycle de 30 jours est ouvert :
                les neuf thèmes PACES et vos 30 séries vous attendent dans votre espace.
              </p>

              <div className="mt-7 flex items-start gap-3 rounded-xl bg-accent-soft p-4">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-white">
                  <Check size={13} strokeWidth={2.5} />
                </span>
                <div>
                  <p className="text-[13px] font-medium text-ink">Accès activé</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ash">
                    Votre compte est actif. Choisissez librement un thème et lancez votre
                    première série de dix questions.
                  </p>
                </div>
              </div>

              <ButtonLink to="/app" size="lg" className="mt-7">
                Ouvrir mon espace <ArrowRight size={16} />
              </ButtonLink>
            </div>
          ) : (
            <div>
              <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                <StatusPill tone="warning" dot>
                  En attente de validation
                </StatusPill>
                <h1 className="mt-5 font-display text-[clamp(2.2rem,4.8vw,3.2rem)] leading-[1.06] tracking-[-0.03em] text-ink">
                  Votre dossier est en cours de vérification.
                </h1>
                <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-mute">
                  Merci {user.firstName}. Votre reçu a bien été transmis au docteur. Le QCM
                  s’ouvrira dès que votre paiement sera vérifié.
                </p>

                <div className="mt-6 flex items-start gap-3 rounded-xl bg-cloud p-4">
                  <LockKeyhole size={16} className="mt-0.5 shrink-0 text-mute" />
                  <p className="text-[12px] leading-relaxed text-ash">
                    Le QCM reste fermé jusqu’à la validation. Cette vérification est manuelle et
                    garantit que seuls les dossiers réglés accèdent aux neuf thèmes.
                  </p>
                </div>

                <div className="mt-7 border-t border-line">
                  {[
                    [
                      'Demande transmise',
                      `Reçue le ${formatDateTime(request?.createdAt ?? user.createdAt)}`,
                      'done',
                    ],
                    ['Vérification du reçu', 'Le docteur contrôle le justificatif et l’identité.', 'current'],
                    ['Ouverture du cycle', 'Le QCM se débloque automatiquement après validation.', 'next'],
                  ].map(([title, detail, state]) => (
                    <div key={title} className="flex items-start gap-3 border-b border-line py-4 last:border-b-0">
                      <span
                        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] ${
                          state === 'done'
                            ? 'bg-accent text-white'
                            : state === 'current'
                              ? 'border border-accent bg-accent-soft text-accent'
                              : 'bg-cloud text-mute'
                        }`}
                      >
                        {state === 'done' ? <Check size={12} strokeWidth={2.5} /> : state === 'current' ? <Hourglass size={12} /> : '3'}
                      </span>
                      <div>
                        <p className="text-[13px] font-medium text-ink">{title}</p>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-mute">{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-line bg-surface p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[12px] font-medium text-ink">Votre demande</p>
                    <p className="mt-1 text-[12px] text-mute">
                      {request?.type === 'renewal' ? 'Renouvellement' : 'Première demande'} ·{' '}
                      {formatDateLong(request?.createdAt ?? user.createdAt)}
                    </p>
                  </div>
                  <span className="text-[11px] text-mute">24 h indicatives</span>
                </div>

                <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[12px]">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-mute">Titulaire</dt>
                    <dd className="font-medium text-ink">
                      {user.firstName} {user.lastName}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-mute">Email</dt>
                    <dd className="max-w-[60%] truncate font-medium text-ink">{user.email}</dd>
                  </div>
                </dl>

                {request?.receipt ? (
                  <button
                    type="button"
                    onClick={() => setReceiptOpen(true)}
                    className="mt-4 flex w-full items-center gap-3 rounded-lg border border-line p-2.5 text-left transition hover:border-accent"
                  >
                    <span className="grid h-12 w-10 shrink-0 place-items-center overflow-hidden rounded bg-cloud">
                      {request.receipt.mime === 'application/pdf' ? (
                        <FileText size={17} className="text-mute" />
                      ) : (
                        <img src={request.receipt.dataUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-ink">
                        {request.receipt.name}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-mute">
                        {formatBytes(request.receipt.size)}
                      </span>
                    </span>
                    <span className="text-[11px] font-medium text-accent">Voir</span>
                  </button>
                ) : null}

                <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-mute">
                  <Mail size={12} className="mt-0.5 shrink-0" />
                  Votre reçu n’est visible que par vous et votre docteur.
                </p>
              </div>

              <p className="mt-5 text-center text-[11px] leading-relaxed text-mute">
                Cette page se met à jour automatiquement. Vous n’avez rien à faire.
              </p>
            </div>
          )}
        </div>
      </div>

      <ReceiptModal open={receiptOpen} onClose={() => setReceiptOpen(false)} receipt={request?.receipt} />
    </section>
  )
}

function ReceiptModal({
  open,
  onClose,
  receipt,
}: {
  open: boolean
  onClose: () => void
  receipt?: Receipt
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Justificatif de paiement"
      eyebrow="Visible par vous et le docteur"
      size="md"
      footer={
        <button type="button" onClick={onClose} className="text-[12px] font-medium underline underline-offset-4">
          Fermer
        </button>
      }
    >
      {!receipt ? (
        <p className="text-[13px] text-mute">Aucun justificatif disponible.</p>
      ) : receipt.mime === 'application/pdf' ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-line bg-cloud py-16 text-center">
          <FileText size={32} strokeWidth={1.3} />
          <p className="mt-4 text-[14px] font-medium">{receipt.name}</p>
          <p className="mt-1 text-[12px] text-mute">PDF · {formatBytes(receipt.size)}</p>
          <a
            href={receipt.dataUrl}
            download={receipt.name}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-[10px] bg-accent px-6 text-[12px] font-medium text-white"
          >
            Télécharger le justificatif
          </a>
        </div>
      ) : (
        <figure>
          <div className="rounded-lg bg-cloud p-2">
            <img
              src={receipt.dataUrl}
              alt="Aperçu du reçu de paiement"
              className="mx-auto max-h-[62vh] w-auto max-w-full object-contain"
            />
          </div>
          <figcaption className="mt-3 flex items-center justify-between text-[11px] text-mute">
            <span className="truncate">{receipt.name}</span>
            <span>{formatBytes(receipt.size)}</span>
          </figcaption>
        </figure>
      )}
    </Modal>
  )
}
