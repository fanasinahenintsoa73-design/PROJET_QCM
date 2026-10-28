import { useEffect, useState } from 'react'
import { Check, CheckCheck, Download, FileText, X } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { AccessRequest } from '@/types'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Field'
import { StatusPill, requestStatus } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/Toast'
import { formatBytes, formatDateTime } from '@/lib/utils'

type Mode = 'preview' | 'reject'

/**
 * Boîte de réception unique du docteur : aperçu du reçu et décision.
 * Le même composant est utilisé depuis le tableau de bord et les liens email.
 */
export function RequestReview({
  request,
  onClose,
}: {
  request: AccessRequest | null
  onClose: () => void
}) {
  const { refresh } = useAuth()
  const { toast } = useToast()
  const [current, setCurrent] = useState<AccessRequest | null>(request)
  const [mode, setMode] = useState<Mode>('preview')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setCurrent(request)
    setMode('preview')
    setNote('')
    setBusy(false)
  }, [request])

  useEffect(() => {
    if (!request || request.receipt.dataUrl || !request.receipt.path) return
    let cancelled = false

    void (async () => {
      try {
        const url = await api.resolveReceiptUrl(request.receipt.path as string)
        if (!cancelled && url) {
          setCurrent((value) =>
            value && value.id === request.id
              ? { ...value, receipt: { ...value.receipt, dataUrl: url } }
              : value,
          )
        }
      } catch (caught) {
        if (!cancelled) {
          toast(
            caught instanceof Error ? caught.message : 'Le justificatif n’a pas pu être ouvert.',
            'error',
          )
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [request, toast])

  if (!current) return null

  const status = requestStatus(current.status)
  const isPending = current.status === 'pending'
  const isRenewal = current.type === 'renewal'
  const userName = current.userName
  const typeLabel = isRenewal ? 'Renouvellement' : 'Première demande'

  const handleApprove = async () => {
    if (busy || !isPending) return
    setBusy(true)
    try {
      await api.approveRequest(current.id)
      await refresh()
      toast(
        isRenewal
          ? `${userName} doit maintenant choisir son sujet.`
          : `${userName} est activé pour 30 jours.`,
        'success',
      )
      onClose()
    } catch (caught) {
      toast(
        caught instanceof Error ? caught.message : 'Validation impossible.',
        'error',
      )
      setBusy(false)
    }
  }

  const handleReject = async () => {
    if (busy || !isPending) return
    setBusy(true)
    try {
      await api.rejectRequest(current.id, note)
      await refresh()
      toast(`La demande de ${userName} a été refusée.`, 'info')
      onClose()
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Refus impossible.', 'error')
      setBusy(false)
    }
  }

  return (
    <>
      <Modal
        open={mode === 'preview'}
        onClose={onClose}
        size="lg"
        eyebrow={`${userName} · ${typeLabel}`}
        title="Justificatif de paiement"
        footer={
          isPending ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-hairline hover:border-sale hover:bg-[#fdecec] hover:text-sale"
                onClick={() => setMode('reject')}
                disabled={busy}
              >
                Refuser
              </Button>
              <Button type="button" size="sm" onClick={handleApprove} loading={busy} className="gap-2">
                <Check className="size-3.5" strokeWidth={2.2} />
                {isRenewal ? 'Valider le renouvellement' : 'Accepter pour 1 mois'}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Fermer
              </Button>
            </div>
          )
        }
      >
        <div className="grid gap-6 sm:grid-cols-[1fr_220px]">
          <div className="bg-cloud p-2">
            {current.receipt.mime === 'application/pdf' ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
                <span className="grid size-12 place-items-center bg-accent text-white">
                  <FileText className="size-5" strokeWidth={1.5} />
                </span>
                <p className="mt-4 max-w-[240px] truncate text-[13px] font-medium">
                  {current.receipt.name}
                </p>
                <p className="mt-1 text-[11px] text-mute">
                  PDF · {formatBytes(current.receipt.size)}
                </p>
                {current.receipt.dataUrl ? (
                  <a
                    href={current.receipt.dataUrl}
                    download={current.receipt.name}
                    className={buttonClasses('secondary', 'sm', 'mt-5 gap-2')}
                  >
                    <Download className="size-3.5" />
                    Télécharger le reçu
                  </a>
                ) : (
                  <p className="mt-5 text-[11px] text-mute">Reçu non disponible.</p>
                )}
              </div>
            ) : current.receipt.dataUrl ? (
              <img
                src={current.receipt.dataUrl}
                alt={`Justificatif de ${userName}`}
                className="mx-auto max-h-[58vh] w-full object-contain"
              />
            ) : (
              <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
                <span className="grid size-12 place-items-center bg-accent text-white">
                  <FileText className="size-5" strokeWidth={1.5} />
                </span>
                <p className="mt-4 text-[13px] font-medium">Reçu non disponible.</p>
                <p className="mt-1 text-[11px] text-mute">
                  Le fichier n’a pas pu être chargé.
                </p>
              </div>
            )}
          </div>

          <div>
            <p className="eyebrow">Détails de la demande</p>
            <dl className="mt-3 border-t border-hairline text-[11px]">
              <div className="border-b border-hairline py-2.5">
                <dt className="text-mute">Étudiant</dt>
                <dd className="mt-0.5 font-medium text-ink">{userName}</dd>
              </div>
              <div className="border-b border-hairline py-2.5">
                <dt className="text-mute">Email</dt>
                <dd className="mt-0.5 break-all text-ink">{current.userEmail}</dd>
              </div>
              <div className="border-b border-hairline py-2.5">
                <dt className="text-mute">Reçue le</dt>
                <dd className="mt-0.5 text-ink">{formatDateTime(current.createdAt)}</dd>
              </div>
              <div className="border-b border-hairline py-2.5">
                <dt className="text-mute">Statut</dt>
                <dd className="mt-1">
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </dd>
              </div>
              <div className="py-2.5">
                <dt className="text-mute">Fichier</dt>
                <dd className="mt-0.5 break-all text-ink">
                  {current.receipt.name} · {formatBytes(current.receipt.size)}
                </dd>
              </div>
            </dl>

            {current.status === 'approved' && (
              <p className="mt-4 flex items-start gap-2 bg-[#e9f5ee] px-3 py-2.5 text-[10px] leading-relaxed text-success">
                <CheckCheck className="mt-0.5 size-3.5 shrink-0" />
                {isRenewal
                  ? 'Renouvellement validé. L’étudiant doit choisir son sujet pour ouvrir son cycle.'
                  : 'Demande validée. L’accès court sur 30 jours.'}
              </p>
            )}
            {current.status === 'rejected' && (
              <p className="mt-4 bg-[#fdecec] px-3 py-2.5 text-[10px] leading-relaxed text-sale">
                Demande refusée. {current.note || 'Aucun motif précisé.'}
              </p>
            )}

            <p className="mt-4 text-[10px] leading-relaxed text-mute">
              Vérifiez le montant, la date et l’identité du bénéficiaire avant validation.
            </p>

            {isPending && isRenewal && (
              <p className="mt-3 bg-cloud px-3 py-2.5 text-[10px] leading-relaxed text-charcoal">
                Après validation, l’étudiant choisira de reprendre son sujet ou de passer au
                suivant. Son accès ne s’ouvrira qu’après ce choix.
              </p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={mode === 'reject'}
        onClose={() => {
          if (!busy) setMode('preview')
        }}
        size="md"
        eyebrow="Refus de la demande"
        title={`Refuser ${userName} ?`}
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode('preview')}
              disabled={busy}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleReject}
              loading={busy}
              className="gap-2"
            >
              <X className="size-3.5" strokeWidth={2.2} />
              Confirmer le refus
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-charcoal">
            L’étudiant sera prévenu que son justificatif n’a pas été accepté. Il pourra
            transmettre un nouveau document.
          </p>
          <div>
            <label htmlFor="rejection-note" className="form-label mb-2 block">
              Motif communiqué à l’étudiant (facultatif)
            </label>
            <Textarea
              id="rejection-note"
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex. Justificatif illisible ou montant manquant. Merci de transmettre une photo nette."
            />
          </div>
          <p className="text-[10px] leading-relaxed text-mute">
            Sans motif, le message par défaut invite l’étudiant à envoyer un reçu lisible.
          </p>
        </div>
      </Modal>
    </>
  )
}
