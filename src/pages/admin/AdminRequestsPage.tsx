import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Check,
  CheckCheck,
  Download,
  FileText,
  Inbox,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Field'
import { ReceiptThumb } from '@/components/ui/Receipt'
import { StatusPill, requestStatus } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/Toast'
import { usePageTitle } from '@/components/Layouts'
import { cn, formatBytes, formatDate, formatDateTime } from '@/lib/utils'
import type { AccessRequest, RequestStatus } from '@/types'

type Filter = RequestStatus | 'all'

const filters: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'Validées' },
  { value: 'rejected', label: 'Refusées' },
  { value: 'all', label: 'Toutes' },
]

export default function AdminRequestsPage() {
  usePageTitle('Demandes — Espace docteur')
  const { db, refresh } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>('pending')
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<AccessRequest | null>(null)
  const [rejecting, setRejecting] = useState<AccessRequest | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const requestedId = searchParams.get('request')

  async function openPreview(request: AccessRequest) {
    setPreview(request)
    if (request.receipt.dataUrl || !request.receipt.path) return
    try {
      const url = await api.resolveReceiptUrl(request.receipt.path)
      if (!url) return
      setPreview((current) =>
        current && current.id === request.id
          ? { ...current, receipt: { ...current.receipt, dataUrl: url } }
          : current,
      )
    } catch (caught) {
      toast(
        caught instanceof Error ? caught.message : 'Le justificatif n’a pas pu être ouvert.',
        'error',
      )
    }
  }

  useEffect(() => {
    if (!requestedId) return
    const found = db.requests.find((request) => request.id === requestedId)
    if (found) void openPreview(found)
    // Only react to the URL parameter, not to live database updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedId])

  const requests = useMemo(() => {
    const term = query.trim().toLowerCase()
    return db.requests
      .filter((request) => (filter === 'all' ? true : request.status === filter))
      .filter(
        (request) =>
          !term ||
          request.userName.toLowerCase().includes(term) ||
          request.userEmail.toLowerCase().includes(term),
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [db.requests, filter, query])

  const counts = useMemo(
    () => ({
      pending: db.requests.filter((request) => request.status === 'pending').length,
      approved: db.requests.filter((request) => request.status === 'approved').length,
      rejected: db.requests.filter((request) => request.status === 'rejected').length,
      all: db.requests.length,
    }),
    [db.requests],
  )

  const closePreview = () => {
    setPreview(null)
    if (requestedId) {
      const next = new URLSearchParams(searchParams)
      next.delete('request')
      setSearchParams(next, { replace: true })
    }
  }

  const handleApprove = async (request: AccessRequest) => {
    if (busy) return
    setBusy(true)
    try {
      await api.approveRequest(request.id)
      await refresh()
      closePreview()
      toast(`${request.userName} est activé pour 30 jours.`, 'success')
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Activation impossible.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const startReject = (request: AccessRequest) => {
    setPreview(null)
    if (requestedId) {
      const next = new URLSearchParams(searchParams)
      next.delete('request')
      setSearchParams(next, { replace: true })
    }
    setNote('')
    setRejecting(request)
  }

  const handleReject = async () => {
    if (!rejecting || busy) return
    setBusy(true)
    try {
      await api.rejectRequest(rejecting.id, note)
      await refresh()
      toast(`La demande de ${rejecting.userName} a été refusée.`, 'info')
      setRejecting(null)
      setNote('')
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Refus impossible.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-canvas">
      <section className="border-b border-hairline-soft">
        <div className="mx-auto max-w-content px-4 py-8 sm:px-8 sm:py-9 lg:px-12">
          <h1 className="display text-[clamp(2.8rem,6vw,4.5rem)]">Demandes.</h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-mute">
            Vérifiez le justificatif, puis acceptez ou refusez le dossier. Une validation ouvre
            30 jours d’accès à compter du jour du traitement.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-content px-4 py-7 sm:px-8 sm:py-9 lg:px-12">
          <div className="mb-3">
            <p className="text-[11px] font-medium text-charcoal">Filtrer par statut</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  aria-pressed={filter === item.value}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[12px] font-medium transition-colors',
                    filter === item.value
                      ? 'border-accent bg-accent text-white'
                      : 'border-hairline bg-white text-charcoal hover:border-stone',
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      'text-[10px]',
                      filter === item.value ? 'text-white/50' : 'text-stone',
                    )}
                  >
                    {counts[item.value]}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-auto">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-mute"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un étudiant…"
                aria-label="Rechercher un étudiant"
                className="h-10 w-full rounded-full border border-hairline bg-white pl-10 pr-4 text-[12px] text-ink outline-none transition focus:border-ink focus:ring-4 focus:ring-cloud sm:w-[280px]"
              />
            </div>
          </div>

          <div className="mt-5 border-t border-hairline lg:hidden">
            {requests.map((request) => {
              const status = requestStatus(request.status)
              return (
                <article key={request.id} className="border-b border-hairline py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-ink">{request.userName}</p>
                      <p className="mt-0.5 truncate text-[11px] text-mute">{request.userEmail}</p>
                    </div>
                    <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-mute">
                    <span className="font-medium text-charcoal">
                      {request.type === 'renewal' ? 'Renouvellement' : 'Première demande'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDateTime(request.createdAt)}</span>
                  </div>
                  <div className="mt-4">
                    <ReceiptThumb
                      receipt={request.receipt}
                      onClick={() => void openPreview(request)}
                    />
                  </div>
                  {request.status === 'pending' ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full border-hairline text-[11px] hover:border-sale hover:bg-[#fdecec] hover:text-sale"
                        onClick={() => startReject(request)}
                      >
                        Refuser
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="w-full px-3 text-[11px]"
                        onClick={() => handleApprove(request)}
                      >
                        Accepter pour 1 mois
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-4 text-[10px] text-stone">
                      {request.reviewedAt
                        ? `Traitée le ${formatDate(request.reviewedAt)}`
                        : '—'}
                    </p>
                  )}
                </article>
              )
            })}
          </div>

          <div className="mt-5 hidden overflow-x-auto border-t border-hairline lg:block">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline">
                  {[
                    'Nom & Prénom',
                    'Email',
                    'Date de demande',
                    'Justificatif',
                    'Statut',
                    'Actions',
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className={cn(
                        'whitespace-nowrap py-3 pr-4 text-[9px] font-semibold uppercase tracking-[0.14em] text-mute',
                        label === 'Actions' && 'pr-0 text-right',
                      )}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const status = requestStatus(request.status)
                  return (
                    <tr
                      key={request.id}
                      className="border-b border-hairline transition-colors hover:bg-cloud/70"
                    >
                      <td className="py-4 pr-4">
                        <p className="whitespace-nowrap text-[13px] font-medium text-ink">
                          {request.userName}
                        </p>
                        <p className="mt-0.5 text-[10px] text-mute">
                          {request.type === 'renewal' ? 'Renouvellement' : 'Première demande'}
                        </p>
                      </td>
                      <td className="py-4 pr-4">
                        <p className="max-w-[210px] truncate text-[12px] text-charcoal">
                          {request.userEmail}
                        </p>
                      </td>
                      <td className="whitespace-nowrap py-4 pr-4">
                        <p className="text-[12px] text-charcoal">
                          {formatDate(request.createdAt, {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </td>
                      <td className="py-4 pr-4">
                        <ReceiptThumb
                          receipt={request.receipt}
                          onClick={() => void openPreview(request)}
                        />
                      </td>
                      <td className="py-4 pr-4">
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      </td>
                      <td className="py-4 text-right">
                        {request.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-hairline text-[11px] hover:border-sale hover:bg-[#fdecec] hover:text-sale"
                              onClick={() => startReject(request)}
                            >
                              Refuser
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="text-[11px]"
                              onClick={() => handleApprove(request)}
                            >
                              Accepter pour 1 mois
                            </Button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-stone">
                            {request.reviewedAt
                              ? `Traitée le ${formatDate(request.reviewedAt)}`
                              : '—'}
                          </p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {requests.length === 0 && (
            <div className="flex flex-col items-center justify-center border-t border-hairline py-16 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-cloud">
                {query ? (
                  <Search className="size-4 text-ash" strokeWidth={1.5} />
                ) : (
                  <Inbox className="size-4 text-ash" strokeWidth={1.5} />
                )}
              </span>
              <p className="mt-4 text-[15px] font-medium text-ink">
                {query ? 'Aucun résultat.' : 'Aucune demande dans cette catégorie.'}
              </p>
              <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-mute">
                {query
                  ? 'Essayez un autre nom ou une autre adresse email.'
                  : 'Les nouvelles demandes envoyées par les étudiants apparaîtront ici automatiquement.'}
              </p>
              {filter !== 'all' && !query && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={() => setFilter('all')}
                >
                  Voir toutes les demandes
                </Button>
              )}
            </div>
          )}

          <p className="mt-5 flex items-start gap-2 text-[10px] leading-relaxed text-mute">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            L’acceptation remplace automatiquement les autres demandes en attente du même
            étudiant.
          </p>
        </div>
      </section>

      {/* Receipt preview */}
      <Modal
        open={Boolean(preview)}
        onClose={closePreview}
        size="lg"
        eyebrow={preview ? `${preview.userName} · ${preview.type === 'renewal' ? 'Renouvellement' : 'Première demande'}` : undefined}
        title="Justificatif de paiement"
        footer={
          preview?.status === 'pending' ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-hairline hover:border-sale hover:bg-[#fdecec] hover:text-sale"
                onClick={() => startReject(preview)}
              >
                Refuser
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleApprove(preview)}
                className="gap-2"
              >
                <Check className="size-3.5" strokeWidth={2.2} />
                Accepter pour 1 mois
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={closePreview}>
                Fermer
              </Button>
            </div>
          )
        }
      >
        {preview && (
          <div className="grid gap-6 sm:grid-cols-[1fr_220px]">
            <div className="bg-cloud p-2">
              {preview.receipt.mime === 'application/pdf' ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
                  <span className="grid size-12 place-items-center bg-accent text-white">
                    <FileText className="size-5" strokeWidth={1.5} />
                  </span>
                  <p className="mt-4 max-w-[240px] truncate text-[13px] font-medium">
                    {preview.receipt.name}
                  </p>
                  <p className="mt-1 text-[11px] text-mute">
                    PDF · {formatBytes(preview.receipt.size)}
                  </p>
                  <a
                    href={preview.receipt.dataUrl}
                    download={preview.receipt.name}
                    className={buttonClasses('secondary', 'sm', 'mt-5 gap-2')}
                  >
                    <Download className="size-3.5" />
                    Télécharger le reçu
                  </a>
                </div>
              ) : (
                <img
                  src={preview.receipt.dataUrl}
                  alt={`Justificatif de ${preview.userName}`}
                  className="mx-auto max-h-[58vh] w-full object-contain"
                />
              )}
            </div>

            <div>
              <p className="eyebrow">Détails de la demande</p>
              <dl className="mt-3 border-t border-hairline text-[11px]">
                <div className="border-b border-hairline py-2.5">
                  <dt className="text-mute">Étudiant</dt>
                  <dd className="mt-0.5 font-medium text-ink">{preview.userName}</dd>
                </div>
                <div className="border-b border-hairline py-2.5">
                  <dt className="text-mute">Email</dt>
                  <dd className="mt-0.5 break-all text-ink">{preview.userEmail}</dd>
                </div>
                <div className="border-b border-hairline py-2.5">
                  <dt className="text-mute">Reçue le</dt>
                  <dd className="mt-0.5 text-ink">{formatDateTime(preview.createdAt)}</dd>
                </div>
                <div className="border-b border-hairline py-2.5">
                  <dt className="text-mute">Statut</dt>
                  <dd className="mt-1">
                    <StatusPill tone={requestStatus(preview.status).tone}>
                      {requestStatus(preview.status).label}
                    </StatusPill>
                  </dd>
                </div>
                <div className="py-2.5">
                  <dt className="text-mute">Fichier</dt>
                  <dd className="mt-0.5 break-all text-ink">
                    {preview.receipt.name} · {formatBytes(preview.receipt.size)}
                  </dd>
                </div>
              </dl>

              {preview.status === 'approved' && (
                <p className="mt-4 flex items-start gap-2 bg-[#e9f5ee] px-3 py-2.5 text-[10px] leading-relaxed text-success">
                  <CheckCheck className="mt-0.5 size-3.5 shrink-0" />
                  Demande validée. L’accès court sur 30 jours.
                </p>
              )}
              {preview.status === 'rejected' && (
                <p className="mt-4 bg-[#fdecec] px-3 py-2.5 text-[10px] leading-relaxed text-sale">
                  Demande refusée. {preview.note || 'Aucun motif précisé.'}
                </p>
              )}

              <p className="mt-4 text-[10px] leading-relaxed text-mute">
                Vérifiez le montant, la date et l’identité du bénéficiaire avant validation.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Refusal */}
      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        size="md"
        eyebrow="Refus de la demande"
        title={rejecting ? `Refuser ${rejecting.userName} ?` : 'Refuser la demande'}
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRejecting(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleReject}
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
    </div>
  )
}
