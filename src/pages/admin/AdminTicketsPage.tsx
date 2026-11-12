import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Archive,
  ArchiveRestore,
  Ban,
  Copy,
  Eye,
  MoreHorizontal,
  Play,
  RefreshCw,
  Search,
  Ticket,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { usePageTitle } from '@/components/Layouts'
import { Field, Input } from '@/components/ui/Field'
import { Button, ButtonLink } from '@/components/ui/Button'
import { StatusPill } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/Toast'
import { copyText } from '@/lib/downloadTickets'
import { getGeneratedTickets, setGeneratedTickets } from '@/lib/generatedTicketsSession'
import { cn, formatDateLong, formatDateTime } from '@/lib/utils'
import type { TicketItem, TicketType } from '@/types'

const MAX_TICKETS_PER_BATCH = 500

// Largeur du menu d'actions d'un ticket (13rem).
const MENU_WIDTH = 208

type Tone = 'success' | 'info' | 'neutral' | 'error'
type FilterKey = 'available' | 'inProgress' | 'finished' | 'suspended'

const FILTERS: Array<{ key: FilterKey; label: string; note: string; dot: string }> = [
  { key: 'available', label: 'Disponible', note: 'Jamais utilisé', dot: 'bg-success' },
  { key: 'inProgress', label: 'En cours', note: 'Activité commencée', dot: 'bg-info' },
  { key: 'finished', label: 'Terminé', note: 'Parcours terminé ou expiré', dot: 'bg-stone' },
  { key: 'suspended', label: 'Suspendu', note: 'Accès fermé', dot: 'bg-sale' },
]

const FILTER_TITLES: Record<FilterKey, string> = {
  available: 'Tickets disponibles',
  inProgress: 'Tickets en cours',
  finished: 'Tickets terminés',
  suspended: 'Tickets suspendus',
}

function isTicketFilter(value: string | null): value is FilterKey {
  return value !== null && FILTERS.some((filter) => filter.key === value)
}

function isAnkiExpired(item: TicketItem): boolean {
  return Boolean(item.expiresAt && new Date(item.expiresAt).getTime() < Date.now())
}

function ticketDisplay(item: TicketItem): { label: string; tone: Tone } {
  if (item.status === 'suspended') return { label: 'Suspendu', tone: 'error' }
  if (item.type === 'anki') {
    if (isAnkiExpired(item)) return { label: 'Expiré', tone: 'neutral' }
    if (item.ankiChapters > 0 && item.ankiCompleted >= item.ankiChapters) {
      return { label: 'Terminé', tone: 'neutral' }
    }
    if (item.ankiChapters > 0) {
      return { label: `En cours · ${item.ankiCompleted}/${item.ankiChapters}`, tone: 'info' }
    }
    return { label: 'Disponible', tone: 'success' }
  }
  if (item.seriesUsed >= 30) return { label: 'Terminé', tone: 'neutral' }
  if (item.status === 'used' || item.usedAt) {
    return { label: `En cours · ${item.seriesUsed}/30`, tone: 'info' }
  }
  return { label: 'Disponible', tone: 'success' }
}

function matchesTicketFilter(item: TicketItem, filter: FilterKey): boolean {
  if (filter === 'suspended') return item.status === 'suspended'
  if (item.status === 'suspended') return false
  if (item.type === 'anki') {
    const finished = isAnkiExpired(item) || (item.ankiChapters > 0 && item.ankiCompleted >= item.ankiChapters)
    if (filter === 'finished') return finished
    if (filter === 'inProgress') return !finished && item.ankiChapters > 0
    return !finished && item.ankiChapters === 0
  }
  if (filter === 'finished') return item.seriesUsed >= 30
  const started = item.status === 'used' || item.usedAt !== null
  if (filter === 'inProgress') return item.seriesUsed < 30 && started
  return item.seriesUsed < 30 && !started
}

function isNeverUsed(item: TicketItem): boolean {
  return !item.usedAt && item.seriesUsed === 0 && item.ankiChapters === 0
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
  const [ticketType, setTicketType] = useState<TicketType>('series')
  const [search, setSearch] = useState('')
  const [generating, setGenerating] = useState(false)
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [unarchiving, setUnarchiving] = useState(false)
  // Menu des actions d'un ticket : rendu dans un portail, hors du tableau.
  // Dans le tableau il était rogné (le conteneur du tableau défile
  // horizontalement et coupe tout ce qui déborde verticalement).
  const [menu, setMenu] = useState<{ code: string; anchor: HTMLButtonElement } | null>(null)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [detail, setDetail] = useState<TicketItem | null>(null)
  const [deleteTargets, setDeleteTargets] = useState<TicketItem[]>([])

  const lastBatch = getGeneratedTickets()
  const batchSecrets = new Map(lastBatch.map((ticket) => [ticket.code, ticket.secret]))

  const activeType: TicketType = searchParams.get('type') === 'anki' ? 'anki' : 'series'
  const archivedView = searchParams.get('vue') === 'archives'
  const filterParam = searchParams.get('statut')
  const activeFilter = !archivedView && isTicketFilter(filterParam) ? filterParam : null
  const normalizedSearch = search.trim().toUpperCase()

  const seriesCount = tickets.filter((item) => item.type === 'series' && !item.archivedAt).length
  const ankiCount = tickets.filter((item) => item.type === 'anki' && !item.archivedAt).length
  // Les archives suivent le parcours affiché, comme les autres compteurs :
  // le bloc « Anki » et le bloc « 30 séries » de l'accueil du docteur
  // pointent chacun vers leurs propres tickets archivés.
  const archivedCount = tickets.filter(
    (item) => item.type === activeType && item.archivedAt !== null,
  ).length
  const archivedOtherType: TicketType = activeType === 'anki' ? 'series' : 'anki'
  const archivedOtherCount = tickets.filter(
    (item) => item.type === archivedOtherType && item.archivedAt !== null,
  ).length

  const activeTypeTickets = useMemo(
    () => tickets.filter((item) => item.type === activeType),
    [tickets, activeType],
  )

  const counts = useMemo(() => {
    const current = activeTypeTickets.filter((item) => !item.archivedAt)
    return {
      available: current.filter((item) => matchesTicketFilter(item, 'available')).length,
      inProgress: current.filter((item) => matchesTicketFilter(item, 'inProgress')).length,
      finished: current.filter((item) => matchesTicketFilter(item, 'finished')).length,
      suspended: current.filter((item) => matchesTicketFilter(item, 'suspended')).length,
    } satisfies Record<FilterKey, number>
  }, [activeTypeTickets])

  const visibleTickets = useMemo(() => {
    // Vue Archives : les tickets archivés du parcours affiché. Sinon : les
    // tickets actifs du même parcours.
    const base = activeTypeTickets.filter((item) =>
      archivedView ? item.archivedAt !== null : item.archivedAt === null,
    )
    const filtered = activeFilter ? base.filter((item) => matchesTicketFilter(item, activeFilter)) : base
    return normalizedSearch
      ? filtered.filter((item) => item.code.toUpperCase().includes(normalizedSearch))
      : filtered
  }, [tickets, activeTypeTickets, activeFilter, archivedView, normalizedSearch])

  const menuItem = menu ? tickets.find((item) => item.code === menu.code) ?? null : null

  const selectedTickets = useMemo(
    () => tickets.filter((item) => selected.has(item.code)),
    [tickets, selected],
  )
  const canDeleteSelected = selectedTickets.length > 0 && selectedTickets.every(isNeverUsed)
  const allVisibleSelected =
    visibleTickets.length > 0 && visibleTickets.every((item) => selected.has(item.code))

  useEffect(() => {
    setSelected(new Set())
  }, [activeType, activeFilter, archivedView, normalizedSearch])

  useEffect(() => {
    if (activeFilter) setSearch('')
  }, [activeFilter])

  // Position du menu d'actions : il reste collé à son bouton, quel que soit
  // le défilement de la page ou du tableau.
  useLayoutEffect(() => {
    if (!menu) {
      setMenuStyle(null)
      return
    }
    const place = () => {
      if (!menu.anchor.isConnected) {
        setMenu(null)
        return
      }
      const anchor = menu.anchor.getBoundingClientRect()
      const panel = menuRef.current
      const height = panel?.offsetHeight ?? 190
      const width = panel?.offsetWidth ?? MENU_WIDTH
      const flip =
        window.innerHeight - anchor.bottom < height + 16 && anchor.top > height + 16
      const top = flip ? anchor.top - height - 6 : anchor.bottom + 6
      const left = Math.min(
        Math.max(8, anchor.right - width),
        Math.max(8, window.innerWidth - width - 8),
      )
      setMenuStyle({ top, left })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu])

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

  function updateParams(next: {
    type?: TicketType
    statut?: FilterKey | null
    vue?: 'archives' | null
  }) {
    const params = new URLSearchParams(searchParams)
    if (next.type !== undefined) params.set('type', next.type)
    if (next.statut !== undefined) {
      if (next.statut === null) params.delete('statut')
      else params.set('statut', next.statut)
    }
    if (next.vue !== undefined) {
      if (next.vue === null) params.delete('vue')
      else params.set('vue', next.vue)
    }
    setSearchParams(params, { replace: true })
  }

  async function handleGenerate() {
    const n = Number.parseInt(count, 10)
    if (!Number.isInteger(n) || n < 1 || n > MAX_TICKETS_PER_BATCH) {
      toast(`Indique un nombre entre 1 et ${MAX_TICKETS_PER_BATCH}.`, 'error')
      return
    }
    setGenerating(true)
    try {
      const created = await api.generateTickets(n, ticketType)
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

  async function handleArchive(codes: string[]) {
    if (codes.length === 0) return
    setArchiving(true)
    try {
      await api.archiveTickets(codes)
      toast(`${codes.length} ticket${codes.length > 1 ? 's' : ''} archivé${codes.length > 1 ? 's' : ''}.`)
      setSelected(new Set())
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'L’archivage a échoué.', 'error')
    } finally {
      setArchiving(false)
    }
  }

  async function handleUnarchive(codes: string[]) {
    if (codes.length === 0) return
    setUnarchiving(true)
    try {
      await api.unarchiveTickets(codes)
      toast(`${codes.length} ticket${codes.length > 1 ? 's' : ''} désarchivé${codes.length > 1 ? 's' : ''}.`)
      setSelected(new Set())
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Le désarchivage a échoué.', 'error')
    } finally {
      setUnarchiving(false)
    }
  }

  function requestDelete(codes: string[]) {
    const targets = tickets.filter((item) => codes.includes(item.code))
    if (targets.length === 0) return
    if (!targets.every(isNeverUsed)) {
      toast(
        'La sélection contient un ticket déjà utilisé. Archive-le au lieu de le supprimer.',
        'error',
      )
      return
    }
    setDeleteTargets(targets)
  }

  async function performDelete() {
    const codes = deleteTargets.map((item) => item.code)
    if (codes.length === 0) return
    setDeleting(true)
    try {
      await api.deleteTickets(codes)
      toast(`${codes.length} ticket${codes.length > 1 ? 's' : ''} supprimé${codes.length > 1 ? 's' : ''}.`)
      setDeleteTargets([])
      setSelected(new Set())
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'La suppression a échoué.', 'error')
    } finally {
      setDeleting(false)
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

  function toggleSelectAll() {
    setSelected((previous) => {
      const next = new Set(previous)
      if (allVisibleSelected) {
        for (const item of visibleTickets) next.delete(item.code)
      } else {
        for (const item of visibleTickets) next.add(item.code)
      }
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

  const detailDisplay = detail ? ticketDisplay(detail) : null

  return (
    <div className="mx-auto max-w-content px-5 py-8 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(1.9rem,4vw,2.6rem)] leading-[1.05] tracking-[-0.02em] text-ink">
            Tickets d’accès.
          </h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-mute">
            Un ticket = un étudiant. Choisis le parcours 30 séries ou Anki, génère les ID et
            numéros, puis suis l’activité. Un ticket utilisé ne se supprime pas : il s’archive.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} loading={loading}>
          <RefreshCw size={14} /> Actualiser
        </Button>
      </div>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Type de ticket" htmlFor="ticket-type" className="w-52">
            <select
              id="ticket-type"
              value={ticketType}
              onChange={(event) => setTicketType(event.target.value as TicketType)}
              className="h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-[14px] text-ink outline-none transition focus:border-accent"
            >
              <option value="series">30 séries</option>
              <option value="anki">Anki · 5 chapitres</option>
            </select>
          </Field>
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

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line">
          <div className="flex gap-5" role="tablist" aria-label="Type de ticket">
            <button
              type="button"
              role="tab"
              aria-selected={activeType === 'series'}
              onClick={() => updateParams({ type: 'series', statut: null, vue: null })}
              className={cn(
                'inline-flex items-center gap-2 border-b-2 pb-3 text-[13px] font-medium transition',
                activeType === 'series'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-mute hover:text-ink',
              )}
            >
              30 séries
              <span className="rounded-full bg-cloud px-2 py-0.5 text-[10px] text-mute">{seriesCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeType === 'anki'}
              onClick={() => updateParams({ type: 'anki', statut: null, vue: null })}
              className={cn(
                'inline-flex items-center gap-2 border-b-2 pb-3 text-[13px] font-medium transition',
                activeType === 'anki'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-mute hover:text-ink',
              )}
            >
              Anki
              <span className="rounded-full bg-cloud px-2 py-0.5 text-[10px] text-mute">{ankiCount}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => updateParams({ vue: archivedView ? null : 'archives', statut: null })}
            className="inline-flex items-center gap-1.5 pb-3 text-[12px] font-medium text-mute transition hover:text-accent"
          >
            <Archive size={14} />
            {archivedView ? 'Tickets actifs' : `Archives (${archivedCount})`}
          </button>
        </div>

        {!archivedView ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {FILTERS.map((filter) => {
              const active = activeFilter === filter.key
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() =>
                    updateParams({ statut: activeFilter === filter.key ? null : filter.key, vue: null })
                  }
                  aria-pressed={active}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left transition',
                    active
                      ? 'border-accent bg-accent-soft/60'
                      : 'border-line bg-surface hover:border-accent/50',
                  )}
                >
                  <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
                    <span className={cn('size-1.5 rounded-full', filter.dot)} />
                    {filter.label}
                  </span>
                  <span className="mt-1 block font-display text-[1.6rem] leading-none text-ink">
                    {counts[filter.key]}
                  </span>
                  <span className="mt-1 block text-[10px] text-mute">{filter.note}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-cloud px-4 py-3">
            <Archive size={15} className="text-mute" />
            <p className="text-[12px] text-mute">
              Les tickets archivés de ce parcours sont masqués des listes actives. Le compte continue
              de fonctionner normalement : ses données sont conservées et tu peux le réactiver à tout
              moment.
            </p>
            {archivedOtherCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  updateParams({ type: archivedOtherType, vue: 'archives', statut: null })
                }
              >
                {archivedOtherCount} archivé{archivedOtherCount > 1 ? 's' : ''} ·{' '}
                {archivedOtherType === 'anki' ? 'Anki' : '30 séries'}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => updateParams({ vue: null })}
            >
              Retour aux tickets actifs
            </Button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search
              size={15}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute"
            />
            <Input
              id="ticket-search"
              value={search}
              onChange={(event) => setSearch(event.target.value.toUpperCase())}
              placeholder={`Rechercher un ID (ex. ${activeType === 'anki' ? 'ANKI0001' : 'PACES0001'})`}
              aria-label="Rechercher un ticket par ID"
              autoComplete="off"
              spellCheck={false}
              className="pl-9 pr-9 uppercase"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-mute transition hover:bg-cloud hover:text-ink"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          <span className="text-[11px] text-mute">
            {normalizedSearch
              ? `${visibleTickets.length} résultat${visibleTickets.length > 1 ? 's' : ''}`
              : `${visibleTickets.length} ticket${visibleTickets.length > 1 ? 's' : ''}`}
          </span>
        </div>

        {activeFilter ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent/20 bg-accent-soft/40 px-4 py-3">
            <p className="text-[13px] text-ink">
              Filtre : <strong>{FILTER_TITLES[activeFilter]}</strong> · {visibleTickets.length}{' '}
              ticket{visibleTickets.length > 1 ? 's' : ''}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => updateParams({ statut: null })}
            >
              Effacer le filtre
            </Button>
          </div>
        ) : null}

        {selected.size > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-cloud px-4 py-3">
            <div>
              <p className="text-[13px] font-medium text-ink">
                {selected.size} ticket{selected.size > 1 ? 's' : ''} sélectionné
                {selected.size > 1 ? 's' : ''}
              </p>
              <p className={cn('text-[11px]', canDeleteSelected ? 'text-mute' : 'text-sale')}>
                {canDeleteSelected
                  ? 'Suppression définitive possible uniquement pour les tickets jamais utilisés.'
                  : 'La sélection contient un ticket déjà utilisé : la suppression est bloquée. Archive-le.'}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Annuler
              </Button>
              {archivedView ? (
                <Button
                  variant="outline"
                  size="sm"
                  loading={unarchiving}
                  onClick={() => void handleUnarchive([...selected])}
                >
                  <ArchiveRestore size={13} /> Désarchiver
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  loading={archiving}
                  onClick={() => void handleArchive([...selected])}
                >
                  <Archive size={13} /> Archiver
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                disabled={!canDeleteSelected}
                onClick={() => requestDelete([...selected])}
              >
                <Trash2 size={13} /> Supprimer
              </Button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div
            className="mt-4 rounded-lg border border-sale/20 bg-danger-soft px-4 py-3 text-[13px] text-sale"
            role="alert"
          >
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
        ) : visibleTickets.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[14px] font-medium text-ink">
              {archivedView
                ? 'Aucun ticket archivé pour ce parcours.'
                : activeFilter
                  ? `Aucun ticket ${FILTER_TITLES[activeFilter].toLowerCase()}.`
                  : normalizedSearch
                    ? `Aucun ticket trouvé pour « ${normalizedSearch} ».`
                    : 'Aucun ticket dans cette catégorie.'}
            </p>
            <p className="mt-1 text-[12px] text-mute">
              {archivedView
                ? 'Les tickets archivés apparaissent ici.'
                : activeFilter
                  ? 'Efface le filtre pour voir tous les tickets.'
                  : 'Change de recherche ou génère un nouveau lot.'}
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-mute">
                  <th className="w-8 py-3 pr-2">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      aria-label="Sélectionner les tickets visibles"
                      className="h-4 w-4 accent-accent"
                    />
                  </th>
                  <th className="py-3 pr-4 font-semibold">Ticket</th>
                  <th className="py-3 pr-4 font-semibold">Numéro</th>
                  <th className="py-3 pr-4 font-semibold">Statut</th>
                  <th className="py-3 pr-4 font-semibold">Progression</th>
                  <th className="py-3 pr-4 font-semibold">Dernière activité</th>
                  <th className="py-3 pr-4 font-semibold">Expiration</th>
                  <th className="py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleTickets.map((item) => {
                  const display = ticketDisplay(item)
                  const isSelected = selected.has(item.code)
                  const secret = item.secret ?? batchSecrets.get(item.code) ?? null
                  return (
                    <tr
                      key={item.code}
                      className={cn(
                        'border-b border-line/60 align-middle transition-colors',
                        isSelected ? 'bg-accent-soft/60' : 'hover:bg-cloud/30',
                      )}
                    >
                      <td className="py-3 pr-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelected(item.code)}
                          aria-label={`Sélectionner ${item.code}`}
                          className="h-4 w-4 accent-accent"
                        />
                      </td>
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
                          {archivedView ? (
                            <span className="rounded-full bg-cloud px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">
                              {item.type === 'anki' ? 'Anki' : 'Séries'}
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
                            <span className="font-mono text-[12px] tracking-widest text-ink">
                              {secret}
                            </span>
                          </span>
                        ) : (
                          <span className="text-mute">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <StatusPill tone={display.tone}>{display.label}</StatusPill>
                          {item.archivedAt ? <StatusPill tone="neutral">Archivé</StatusPill> : null}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-mute">
                        {item.type === 'anki'
                          ? item.ankiChapters > 0
                            ? `${item.ankiCompleted}/${item.ankiChapters} chapitres`
                            : 'Aucun chapitre'
                          : `${item.seriesUsed}/30 séries`}
                      </td>
                      <td className="py-3 pr-4 text-mute">
                        {item.lastActivityAt ? formatDateTime(item.lastActivityAt) : '—'}
                      </td>
                      <td className="py-3 pr-4 text-mute">
                        {item.expiresAt ? formatDateLong(item.expiresAt) : '—'}
                      </td>
                      <td className="py-3 text-right">
                        <div className="relative inline-flex">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              const anchor = event.currentTarget
                              if (menu?.code === item.code) {
                                setMenu(null)
                                return
                              }
                              const rect = anchor.getBoundingClientRect()
                              setMenuStyle({
                                top: rect.bottom + 6,
                                left: Math.max(8, rect.right - MENU_WIDTH),
                              })
                              setMenu({ code: item.code, anchor })
                            }}
                            aria-label={`Actions pour ${item.code}`}
                            aria-expanded={menu?.code === item.code}
                          >
                            <MoreHorizontal size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detail ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/30 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-detail-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                  Vérifier l’état
                </p>
                <h2
                  id="ticket-detail-title"
                  className="mt-1 font-display text-[24px] tracking-[-0.02em] text-ink"
                >
                  {detail.code}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Fermer"
                className="grid h-8 w-8 place-items-center rounded-md text-mute transition hover:bg-cloud hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            <dl className="mt-4 grid gap-2 text-[12px] sm:grid-cols-2">
              <div className="flex justify-between gap-3 border-b border-line/60 py-1.5">
                <dt className="text-mute">Parcours</dt>
                <dd className="font-medium text-ink">{detail.type === 'anki' ? 'Anki' : '30 séries'}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line/60 py-1.5">
                <dt className="text-mute">Statut</dt>
                <dd>
                  {detailDisplay ? (
                    <StatusPill tone={detailDisplay.tone}>{detailDisplay.label}</StatusPill>
                  ) : null}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line/60 py-1.5">
                <dt className="text-mute">Créé le</dt>
                <dd className="text-ink">{formatDateLong(detail.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line/60 py-1.5">
                <dt className="text-mute">Expire le</dt>
                <dd className="text-ink">
                  {detail.expiresAt ? formatDateLong(detail.expiresAt) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line/60 py-1.5">
                <dt className="text-mute">Dernière activité</dt>
                <dd className="text-ink">
                  {detail.lastActivityAt ? formatDateTime(detail.lastActivityAt) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line/60 py-1.5">
                <dt className="text-mute">Dernière connexion</dt>
                <dd className="text-ink">
                  {detail.lastLoginAt ? formatDateTime(detail.lastLoginAt) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line/60 py-1.5">
                <dt className="text-mute">Séries utilisées</dt>
                <dd className="text-ink">{detail.seriesUsed} / 30</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line/60 py-1.5">
                <dt className="text-mute">Chapitres Anki</dt>
                <dd className="text-ink">
                  {detail.ankiCompleted} / {detail.ankiChapters || 5}
                </dd>
              </div>
            </dl>

            <div
              className={cn(
                'mt-4 rounded-xl border px-4 py-3 text-[12px]',
                isNeverUsed(detail)
                  ? 'border-success/20 bg-accent-soft/50 text-accent'
                  : 'border-sale/20 bg-danger-soft text-sale',
              )}
            >
              {isNeverUsed(detail)
                ? 'Disponible · jamais utilisé. La suppression définitive est possible.'
                : 'Déjà utilisé · suppression définitive bloquée. Archive-le pour le retirer des listes actives.'}
            </div>

            <div className="mt-5 flex justify-end">
              <Button variant="outline" onClick={() => setDetail(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTargets.length > 0 ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/30 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-delete-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-xl">
            <h2
              id="ticket-delete-title"
              className="font-display text-[24px] tracking-[-0.02em] text-ink"
            >
              Supprimer définitivement ?
            </h2>
            <p className="mt-2 text-[12px] leading-relaxed text-mute">
              {deleteTargets.length} ticket{deleteTargets.length > 1 ? 's' : ''} jamais utilisé
              {deleteTargets.length > 1 ? 's' : ''}. Cette action supprime le compte étudiant et
              toutes ses données.
            </p>
            <ul className="mt-3 max-h-40 divide-y divide-line overflow-y-auto rounded-lg border border-line">
              {deleteTargets.map((item) => {
                const display = ticketDisplay(item)
                return (
                  <li
                    key={item.code}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]"
                  >
                    <span className="font-mono text-ink">{item.code}</span>
                    <StatusPill tone={display.tone}>{display.label}</StatusPill>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-[12px] font-medium text-sale">Impossible à annuler.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setDeleteTargets([])}
                disabled={deleting}
              >
                Annuler
              </Button>
              <Button variant="danger" loading={deleting} onClick={() => void performDelete()}>
                Supprimer définitivement
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {menu && menuItem && menuStyle
        ? createPortal(
            <>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setMenu(null)}
              />
              <div
                ref={menuRef}
                style={{ top: menuStyle.top, left: menuStyle.left, width: MENU_WIDTH }}
                className="fixed z-20 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenu(null)
                    setDetail(menuItem)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-ink transition hover:bg-cloud"
                >
                  <Eye size={14} /> Vérifier l’état
                </button>
                {!menuItem.archivedAt ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(null)
                      void handleStatus(
                        menuItem,
                        menuItem.status === 'suspended' ? 'active' : 'suspended',
                      )
                    }}
                    disabled={busyCode === menuItem.code}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-ink transition hover:bg-cloud disabled:opacity-50"
                  >
                    {menuItem.status === 'suspended' ? (
                      <>
                        <Play size={14} /> Réactiver
                      </>
                    ) : (
                      <>
                        <Ban size={14} /> Suspendre
                      </>
                    )}
                  </button>
                ) : null}
                {menuItem.archivedAt ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(null)
                      void handleUnarchive([menuItem.code])
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-ink transition hover:bg-cloud"
                  >
                    <ArchiveRestore size={14} /> Désarchiver
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(null)
                      void handleArchive([menuItem.code])
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-ink transition hover:bg-cloud"
                  >
                    <Archive size={14} /> Archiver
                  </button>
                )}
                {isNeverUsed(menuItem) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(null)
                      requestDelete([menuItem.code])
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-sale transition hover:bg-danger-soft"
                  >
                    <Trash2 size={14} /> Supprimer
                  </button>
                ) : null}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  )
}
