import { useState } from 'react'
import {
  ArrowUpRight,
  Check,
  Clock3,
  FileText,
  Hourglass,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { usePageTitle } from '@/components/Layouts'
import { StatusPill } from '@/components/ui/StatusPill'
import { Modal } from '@/components/ui/Modal'
import type { Receipt } from '@/types'
import { formatBytes, formatDateTime, formatDateLong } from '@/lib/utils'

export function PendingPage() {
  usePageTitle('Dossier en vérification — MEDQCM L1')
  const { user, latestRequest, pendingRequest } = useAuth()
  const [receiptOpen, setReceiptOpen] = useState(false)
  if (!user) return null
  const request = pendingRequest ?? latestRequest

  return (
    <section className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-12 sm:px-10 lg:px-10 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <StatusPill tone="warning">En attente de validation</StatusPill>
            <h1 className="display mt-6 text-[clamp(3.4rem,8.5vw,6.4rem)]">
              Dossier
              <br />
              sous
              <br />
              vérification.
            </h1>

            <div className="mt-7 max-w-xl border-l-2 border-ink pl-5">
              <p className="text-[15px] leading-[1.7] text-ash">
                Merci {user.firstName}. Votre justificatif a bien été transmis au docteur. Votre
                compte sera activé sous 24 h après vérification.
              </p>
            </div>

            <div className="mt-7 flex items-start gap-3 bg-cloud p-4">
              <LockKeyhole size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-[12px] font-medium">Le QCM reste inaccessible jusqu’à activation.</p>
                <p className="mt-1 text-[11px] leading-relaxed text-mute">
                  Cette protection garantit que seuls les étudiants dont le paiement a été vérifié
                  accèdent au sujet qui leur est attribué.
                </p>
              </div>
            </div>

            <div className="mt-10 border-t border-ink">
              {[
                {
                  title: 'Demande transmise',
                  detail: `Reçue le ${formatDateTime(request?.createdAt ?? user.createdAt)}`,
                  state: 'done' as const,
                },
                {
                  title: 'Vérification du justificatif',
                  detail: 'Votre docteur contrôle le reçu et l’identité du dossier.',
                  state: 'current' as const,
                },
                {
                  title: 'Ouverture des 30 jours',
                  detail: 'Le QCM et le corrigé se débloquent automatiquement après validation.',
                  state: 'next' as const,
                },
              ].map((step) => (
                <div
                  key={step.title}
                  className={`flex items-start gap-4 border-b border-hairline-soft py-5 ${
                    step.state === 'next' ? 'opacity-45' : ''
                  }`}
                >
                  <span
                    className={
                      step.state === 'done'
                        ? 'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-white'
                        : step.state === 'current'
                          ? 'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ink bg-white'
                          : 'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cloud text-mute'
                    }
                  >
                    {step.state === 'done' ? (
                      <Check size={13} strokeWidth={2.5} />
                    ) : step.state === 'current' ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <LockKeyhole size={12} />
                    )}
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-medium">{step.title}</p>
                      {step.state === 'current' && (
                        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mute">
                          En cours
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-mute">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
                  <Clock3 size={13} /> Délai habituel
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-ash">
                  Moins de 24 heures. Les demandes sont vérifiées manuellement, généralement dans la
                  journée.
                </p>
              </div>
              <div>
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
                  <ShieldCheck size={13} /> Reçu vérifié
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-ash">
                  Montant, date et lisibilité sont contrôlés. Un justificatif incomplet entraîne un refus
                  avec motif.
                </p>
              </div>
            </div>

            <div className="mt-8 border border-dashed border-hairline p-4 text-[10px] leading-relaxed text-mute">
              <span className="font-semibold uppercase tracking-[0.14em] text-ink">Validation —</span>{' '}
              votre demande est examinée par le docteur. Dès qu’elle est acceptée, votre espace se
              met à jour automatiquement.
            </div>
          </div>

          <aside className="lg:col-span-5">
            <div className="bg-ink p-6 text-white sm:p-8">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  Votre demande
                </p>
                <Hourglass size={15} className="text-white/40" />
              </div>
              <p className="mt-6 font-display text-[clamp(4rem,8vw,6rem)] leading-[0.8]">24 h</p>
              <p className="mt-3 text-[12px] text-white/55">Délai indicatif de vérification</p>

              <div className="mt-8 border-t border-white/15">
                {[
                  ['Titulaire', `${user.firstName} ${user.lastName}`],
                  ['Email', user.email],
                  ['Type', request?.type === 'renewal' ? 'Renouvellement' : 'Première demande'],
                  ['Demande envoyée', formatDateLong(request?.createdAt ?? user.createdAt)],
                  ['Statut', 'Reçu à vérifier'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-start justify-between gap-5 border-b border-white/10 py-3.5"
                  >
                    <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      {label}
                    </span>
                    <span className="max-w-[230px] text-right text-[11px] leading-snug text-white/85">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {request?.receipt ? (
                <button
                  type="button"
                  onClick={() => setReceiptOpen(true)}
                  className="mt-5 flex w-full items-center gap-3 border border-white/15 p-2 text-left transition hover:border-white/40"
                >
                  <span className="grid h-14 w-11 shrink-0 place-items-center overflow-hidden bg-white/10">
                    {request.receipt.mime === 'application/pdf' ? (
                      <FileText size={18} />
                    ) : (
                      <img
                        src={request.receipt.dataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      Justificatif joint
                    </span>
                    <span className="mt-0.5 block truncate text-[11px]">{request.receipt.name}</span>
                    <span className="block text-[9px] text-white/40">
                      {formatBytes(request.receipt.size)}
                    </span>
                  </span>
                  <ArrowUpRight size={14} className="shrink-0 text-white/60" />
                </button>
              ) : (
                <div className="mt-5 border border-white/15 p-3 text-[11px] text-white/50">
                  Aucun reçu n’est attaché à ce dossier.
                </div>
              )}

              <p className="mt-5 flex items-start gap-2 text-[10px] leading-relaxed text-white/40">
                <Mail size={11} className="mt-0.5 shrink-0" />
                Votre reçu est visible uniquement par vous et votre docteur.
              </p>
            </div>

          </aside>
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
      footer={<button type="button" onClick={onClose} className="text-[12px] font-medium underline underline-offset-4">Fermer</button>}
    >
      {!receipt ? (
        <p className="text-[13px] text-mute">Aucun justificatif disponible.</p>
      ) : receipt.mime === 'application/pdf' ? (
        <div className="flex flex-col items-center justify-center border border-hairline-soft bg-cloud py-16 text-center">
          <FileText size={32} strokeWidth={1.3} />
          <p className="mt-4 text-[14px] font-medium">{receipt.name}</p>
          <p className="mt-1 text-[12px] text-mute">PDF · {formatBytes(receipt.size)}</p>
          <a
            href={receipt.dataUrl}
            download={receipt.name}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[12px] font-medium text-white"
          >
            Télécharger le justificatif
          </a>
        </div>
      ) : (
        <figure>
          <div className="bg-cloud p-2">
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
