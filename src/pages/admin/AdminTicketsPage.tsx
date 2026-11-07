import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Ban, Copy, Play, RefreshCw, Ticket, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { usePageTitle } from '@/components/Layouts'
import { Field, Input } from '@/components/ui/Field'
import { Button, ButtonLink, buttonClasses } from '@/components/ui/Button'
import { StatusPill } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/Toast'
import { copyText } from '@/lib/downloadTickets'
import { getGeneratedTickets, setGeneratedTickets } from '@/lib/generatedTicketsSession'
import { usePressAndHold } from '@/lib/usePressAndHold'
import { formatDateLong, formatDateTime } from '@/lib/utils'
import type { TicketItem } from '@/types'

const MAX_TICKETS_PER_BATCH = 500
const ROW_HOLD_MS = 2000
const DELETE_HOLD_MS = 3000
/** Tolérance de déplacement du doigt pendant l'appui (en pixels). */
const HOLD_MOVE_TOLERANCE = 18

type Tone = 'success' | 'info' | 'neutral' | 'error'

function ticketDisplay(item: TicketItem): { label: string; tone: Tone } {
  if (item.status === 'suspended') return { label: 'Suspendu', tone: 'error' }
  if (item.seriesUsed >= 30) return { label: 'Terminé', tone: 'neutral' }
  if (item.status === 'used' || item.usedAt) return { label: `En cours · ${item.seriesUsed}/30`, tone: 'info' }
  return { label: 'Disponible', tone: 'success' }
}

const TICKET_FILTERS = ['available', 'inProgress', 'finished', 'suspended'] as const
type TicketFilter = (typeof TICKET_FILTERS)[number]

const FILTER_LABELS: Record<TicketFilter, string> = {
  available: 'Disponibles',
  inProgress: 'En cours',
  finished: 'Terminés',
  suspended: 'Suspendus',
}

const FILTER_TITLES: Record<TicketFilter, string> = {
  available: 'Tickets disponibles',
  inProgress: 'Tickets en cours',
  finished: 'Tickets terminés',
  suspended: 'Tickets suspendus',
}

function isTicketFilter(value: string | null): value is TicketFilter {
  return value !== null && (TICKET_FILTERS as readonly string[]).includes(value)
}

function matchesTicketFilter(item: TicketItem, filter: TicketFilter): boolean {
  if (filter === 'suspended') return item.status === 'suspended'
  if (item.status === 'suspended') return false
  if (filter === 'finished') return item.seriesUsed >= 30
  const started = item.status === 'used' || item.usedAt !== null
  if (filter === 'inProgress') return item.seriesUsed < 30 && started
  return item.seriesUsed < 30 && !started
}

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('button, a, input, select, textarea') !== null
}

export default function AdminTicketsPage() {
  usePageTitle('Tickets — Espace docteur')
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [count, setCount] = useState('50')
  const [generating, setGenerating] = useState(false)
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [holdCode, setHoldCode] = useState<string | null>(null)
  const holdCodeRef = useRef<string | null>(null)
  const touchStartRef = useRef<{ id: number; x: number; y: number } | null>(null)
  const rowHold = usePressAndHold(ROW_HOLD_MS)
  const deleteHold = usePressAndHold(DELETE_HOLD_MS)
  const suppressClickRef = useRef(false)
  const selectedRef = useRef(selected)
  const lastBatch = getGeneratedTickets()
  const batchSecrets = new Map(lastBatch.map((ticket) => [ticket.code, ticket.secret]))
  const filterParam = searchParams.get('statut')
  const activeFilter = isTicketFilter(filterParam) ? filterParam : null
  const filteredTickets = activeFilter
    ? tickets.filter((item) => matchesTicketFilter(item, activeFilter))
    : tickets

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    setSelected(new Set())
  }, [activeFilter])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await api.listTickets()
      setTickets(list)
      setSelected((previous) => {
        if (previous.size === 0) return previous
        const codes = new Set(list.map((item) => item.code))
        return new Set([...previous].filter((code) => codes.has(code)))
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Les tickets n’ont pas pu être chargés.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleGenerate() {
    const n = Number.parseInt(count, 10)
    if (!Number.isInteger(n) || n < 1 || n > MAX_TICKETS_PER_BATCH) {
      toast(`Indique un nombre entre 1 et ${MAX_TICKETS_PER_BATCH}.`, 'error')
      return
    }
    setGenerating(true)
    try {
      const created = await api.generateTickets(n)
      setGeneratedTickets(created)
      toast(`${created.length} ticket${created.length > 1 ? 's' : ''} généré${created.length > 1 ? 's' : ''}.`)
      navigate('/admin/tickets/generes')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'La génération a échoué.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleStatus(item: TicketItem, status: 'suspended' | 'active') {
    setBusyCode(item.code)
    try {
      await api.setTicketStatus(item.code, status)
      toast(status === 'suspended' ? `Ticket ${item.code} suspendu.` : `Ticket ${item.code} réactivé.`)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action impossible.', 'error')
    } finally {
      setBusyCode(null)
    }
  }

  function toggleSelected(code: string) {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  async function handleCopyId(code: string) {
    const ok = await copyText(code)
    toast(ok ? 'ID copié !' : 'Copie impossible sur cet appareil.', ok ? 'success' : 'error')
  }

  async function handleCopySecret(secret: string) {
    const ok = await copyText(secret)
    toast(ok ? 'Numéro copié !' : 'Copie impossible sur cet appareil.', ok ? 'success' : 'error')
  }

  function beginRowHold(item: TicketItem, event?: ReactPointerEvent<HTMLTableRowElement>) {
    if (holdCodeRef.current !== null) return
    holdCodeRef.current = item.code
    suppressClickRef.current = false
    setHoldCode(item.code)
    rowHold.start(() => {
      suppressClickRef.current = true
      holdCodeRef.current = null
      setHoldCode(null)
      setSelected((previous) => {
        const next = new Set(previous)
        next.add(item.code)
        return next
      })
    }, event)
  }

  function startRowHold(event: ReactPointerEvent<HTMLTableRowElement>, item: TicketItem) {
    // Le tactile passe par les événements touch, plus fiables que les
    // événements pointer : le navigateur peut annuler un pointer pendant un
    // défilement ou un menu contextuel, ce qui faisait échouer l'appui long.
    if (event.pointerType === 'touch') return
    if (isInteractive(event.target) || holdCodeRef.current !== null) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    beginRowHold(item, event)
  }

  function handleTouchStart(event: ReactTouchEvent<HTMLTableRowElement>, item: TicketItem) {
    if (isInteractive(event.target) || holdCodeRef.current !== null) return
    if (event.touches.length !== 1) return
    const touch = event.touches[0]
    touchStartRef.current = { id: touch.identifier, x: touch.clientX, y: touch.clientY }
    beginRowHold(item)
  }

  function handleTouchMove(event: ReactTouchEvent<HTMLTableRowElement>) {
    const start = touchStartRef.current
    if (!start || holdCodeRef.current === null) return
    const touch = Array.from(event.touches).find((candidate) => candidate.identifier === start.id)
    if (!touch) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.hypot(dx, dy) > HOLD_MOVE_TOLERANCE) cancelRowHold()
  }

  function handleTouchEnd() {
    touchStartRef.current = null
    cancelRowHold()
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLTableRowElement>) {
    if (event.pointerType === 'touch') return
    cancelRowHold()
  }

  function cancelRowHold() {
    rowHold.cancel()
    holdCodeRef.current = null
    touchStartRef.current = null
    setHoldCode(null)
  }

  function handleRowClick(event: ReactMouseEvent<HTMLTableRowElement>, item: TicketItem) {
    if (isInteractive(event.target)) return
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (selected.size === 0) return
    toggleSelected(item.code)
  }

  async function handleDeleteSelected() {
    const codes = [...selectedRef.current]
    if (codes.length === 0) return
    setDeleting(true)
    try {
      await api.deleteTickets(codes)
      toast(`${codes.length} ticket${codes.length > 1 ? 's' : ''} supprimé${codes.length > 1 ? 's' : ''}.`)
      setSelected(new Set())
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'La suppression a échoué.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-content px-5 py-8 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(1.9rem,4vw,2.6rem)] leading-[1.05] tracking-[-0.02em] text-ink">
            Tickets d’accès.
          </h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-mute">
            Un ticket = un étudiant = 30 séries. Génère les tickets, donne les ID et numéros en
            main propre. Après 30 séries, l’étudiant rachète un nouveau ticket.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} loading={loading}>
          <RefreshCw size={14} /> Actualiser
        </Button>
      </div>

      {/* Génération */}
      <section className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Nombre de tickets" htmlFor="ticket-count" className="w-40">
            <Input
              id="ticket-count"
              type="number"
              min={1}
              max={MAX_TICKETS_PER_BATCH}
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
          </Field>
          <Button onClick={() => void handleGenerate()} loading={generating}>
            <Ticket size={15} /> Générer
          </Button>
        </div>
        <p className="mt-3 text-[12px] text-mute">
          Après génération, tu arrives sur une nouvelle page avec les ID et numéros, pour les
          télécharger en Excel ou en PDF.
        </p>
      </section>

      {lastBatch.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent/20 bg-accent-soft/40 px-4 py-3">
          <p className="text-[13px] text-ink">
            Dernier lot généré : <strong>{lastBatch.length}</strong> ticket
            {lastBatch.length > 1 ? 's' : ''}.
          </p>
          <ButtonLink to="/admin/tickets/generes" variant="outline" size="sm" className="ml-auto">
            Voir les ID et numéros
          </ButtonLink>
        </div>
      ) : null}

      {/* Liste des tickets */}
      <section className="mt-8">
        <div className="flex items-end justify-between gap-4 border-b border-line pb-4">
          <div>
            <h2 className="text-[22px] font-medium tracking-[-0.01em] text-ink">
              {activeFilter ? FILTER_TITLES[activeFilter] : 'Tous les tickets'}
            </h2>
            <p className="mt-1 text-[11px] text-mute">
              Disponible · En cours (séries faites) · Terminé (30 séries) · Suspendu
            </p>
            <p className="mt-1 text-[11px] text-mute">
              {selected.size === 0
                ? 'Maintiens 2 secondes sur un ticket (pas sur les boutons) pour le sélectionner, puis touche les autres.'
                : 'Touche un ticket pour l’ajouter ou le retirer de la sélection.'}
            </p>
          </div>
          <span className="font-display text-[1.6rem] leading-none text-ink">{filteredTickets.length}</span>
        </div>

        {activeFilter ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent/20 bg-accent-soft/40 px-4 py-3">
            <p className="text-[13px] text-ink">
              Filtre : <strong>{FILTER_LABELS[activeFilter]}</strong> · {filteredTickets.length} ticket
              {filteredTickets.length > 1 ? 's' : ''}
            </p>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setSearchParams({})}>
              Tout afficher
            </Button>
          </div>
        ) : null}

        {selected.size > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-sale/20 bg-danger-soft px-4 py-3">
            <p className="text-[13px] font-medium text-ink">
              {selected.size} ticket{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
            </p>
            <p className="text-[11px] text-mute">
              Maintiens le bouton 3 secondes sans relâcher pour supprimer.
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={deleting}>
                Annuler
              </Button>
              <button
                type="button"
                onPointerDown={(event) => deleteHold.start(() => void handleDeleteSelected(), event)}
                onPointerUp={deleteHold.cancel}
                onPointerCancel={deleteHold.cancel}
                onKeyDown={(event) => {
                  if ((event.key === 'Enter' || event.key === ' ') && !deleting) {
                    event.preventDefault()
                    deleteHold.start(() => void handleDeleteSelected())
                  }
                }}
                onKeyUp={deleteHold.cancel}
                onContextMenu={(event) => event.preventDefault()}
                disabled={deleting}
                aria-label={`Supprimer ${selected.size} ticket${selected.size > 1 ? 's' : ''} sélectionnés (maintenir 3 secondes)`}
                className={buttonClasses('danger', 'sm', 'relative select-none overflow-hidden')}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-white/25"
                  style={{ width: `${deleteHold.progress * 100}%` }}
                />
                {deleteHold.progress > 0 ? (
                  <span aria-hidden className="text-[13px] font-bold tabular-nums">
                    {Math.ceil((1 - deleteHold.progress) * (DELETE_HOLD_MS / 1000))}
                  </span>
                ) : (
                  <Trash2 size={13} />
                )}
                Supprimer
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-sale/20 bg-danger-soft px-4 py-3 text-[13px] text-sale" role="alert">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="py-10 text-center text-[13px] text-mute">Chargement des tickets…</p>
        ) : tickets.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[14px] font-medium text-ink">Aucun ticket pour le moment.</p>
            <p className="mt-1 text-[12px] text-mute">Génère un premier lot ci-dessus.</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[14px] font-medium text-ink">
              {activeFilter
                ? `Aucun ticket ${FILTER_LABELS[activeFilter].toLowerCase()}.`
                : 'Aucun ticket dans cette catégorie.'}
            </p>
            <p className="mt-1 text-[12px] text-mute">
              {activeFilter
                ? 'Change de filtre pour voir les autres tickets.'
                : 'Génère un premier lot ci-dessus.'}
            </p>
            {activeFilter ? (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearchParams({})}>
                Tout afficher
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-mute">
                  <th className="py-3 pr-4 font-semibold">Ticket</th>
                  <th className="py-3 pr-4 font-semibold">Numéro d’enregistrement</th>
                  <th className="py-3 pr-4 font-semibold">Statut</th>
                  <th className="py-3 pr-4 font-semibold">Créé</th>
                  <th className="py-3 pr-4 font-semibold">1ʳᵉ connexion</th>
                  <th className="py-3 pr-4 font-semibold">Dernière connexion</th>
                  <th className="py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((item) => {
                  const display = ticketDisplay(item)
                  const isSelected = selected.has(item.code)
                  const isHolding = holdCode === item.code
                  const secret = item.secret ?? batchSecrets.get(item.code) ?? null
                  return (
                    <Fragment key={item.code}>
                      <tr
                        tabIndex={0}
                        aria-selected={isSelected}
                        onPointerDown={(event) => startRowHold(event, item)}
                        onPointerUp={handlePointerEnd}
                        onPointerCancel={handlePointerEnd}
                        onTouchStart={(event) => handleTouchStart(event, item)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onTouchCancel={handleTouchEnd}
                        onClick={(event) => handleRowClick(event, item)}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget || event.repeat) return
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            toggleSelected(item.code)
                          }
                        }}
                        onContextMenu={(event) => {
                          if (!isInteractive(event.target)) event.preventDefault()
                        }}
                        style={
                          isHolding
                            ? {
                                background: `linear-gradient(to right, rgba(11, 107, 79, 0.26) ${rowHold.progress * 100}%, transparent ${rowHold.progress * 100}%)`,
                                boxShadow:
                                  rowHold.progress > 0.05 ? 'inset 3px 0 0 #0B6B4F' : undefined,
                              }
                            : undefined
                        }
                        className={`select-none border-b border-line/60 align-middle transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                          isSelected
                            ? 'bg-accent-soft/60'
                            : selected.size > 0
                              ? 'cursor-pointer hover:bg-cloud/50'
                              : 'hover:bg-cloud/30'
                        }`}
                      >
                        <td className="py-3 pr-4 font-semibold tracking-wide text-ink">
                          <span className="inline-flex items-center gap-1.5">
                            {item.code}
                            <button
                              type="button"
                              onClick={() => void handleCopyId(item.code)}
                              aria-label={`Copier l’ID ${item.code}`}
                              title="Copier l’ID"
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-mute transition hover:bg-cloud hover:text-accent"
                            >
                              <Copy size={13} />
                            </button>
                            {isHolding && rowHold.progress > 0.08 ? (
                              <span
                                aria-hidden
                                className="inline-flex items-center rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-accent"
                              >
                                {Math.max(1, Math.ceil((1 - rowHold.progress) * (ROW_HOLD_MS / 1000)))} s
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {secret ? (
                            <span className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleCopySecret(secret)}
                                aria-label={`Copier le numéro de ${item.code}`}
                                title="Copier le numéro"
                                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-mute transition hover:bg-cloud hover:text-accent"
                              >
                                <Copy size={13} />
                              </button>
                              <span className="font-mono text-[12px] tracking-widest text-ink">{secret}</span>
                            </span>
                          ) : (
                            <span className="text-mute">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusPill tone={display.tone}>{display.label}</StatusPill>
                        </td>
                        <td className="py-3 pr-4 text-mute">{formatDateLong(item.createdAt)}</td>
                        <td className="py-3 pr-4 text-mute">{item.usedAt ? formatDateLong(item.usedAt) : '—'}</td>
                        <td className="py-3 pr-4 text-mute">{item.lastLoginAt ? formatDateTime(item.lastLoginAt) : '—'}</td>
                        <td className="py-3 text-right">
                          {item.status === 'suspended' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              loading={busyCode === item.code}
                              onClick={() => void handleStatus(item, 'active')}
                            >
                              <Play size={13} /> Réactiver
                            </Button>
                          ) : (
                            <Button
                              variant="danger"
                              size="sm"
                              loading={busyCode === item.code}
                              onClick={() => void handleStatus(item, 'suspended')}
                            >
                              <Ban size={13} /> Suspendre
                            </Button>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
