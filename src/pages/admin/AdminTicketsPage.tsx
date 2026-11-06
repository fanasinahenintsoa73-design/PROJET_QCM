import { useCallback, useEffect, useState } from 'react'
import { Ban, Copy, History, Play, Printer, RefreshCw, Ticket } from 'lucide-react'
import { api } from '@/lib/api'
import { usePageTitle } from '@/components/Layouts'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { StatusPill } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/Toast'
import { formatDateLong, formatDateTime } from '@/lib/utils'
import type { GeneratedTicket, TicketItem } from '@/types'

const MAX_TICKETS_PER_BATCH = 500

type Tone = 'success' | 'info' | 'neutral' | 'error'

function ticketDisplay(item: TicketItem): { label: string; tone: Tone } {
  if (item.status === 'suspended') return { label: 'Suspendu', tone: 'error' }
  if (item.seriesUsed >= 30) return { label: 'Terminé', tone: 'neutral' }
  if (item.status === 'used' || item.usedAt) return { label: `En cours · ${item.seriesUsed}/30`, tone: 'info' }
  return { label: 'Disponible', tone: 'success' }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }
}

export default function AdminTicketsPage() {
  usePageTitle('Tickets — Espace docteur')
  const { toast } = useToast()

  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [count, setCount] = useState('50')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<GeneratedTicket[]>([])
  const [historyCode, setHistoryCode] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [busyCode, setBusyCode] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setTickets(await api.listTickets())
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
      setGenerated(created)
      toast(`${created.length} ticket${created.length > 1 ? 's' : ''} généré${created.length > 1 ? 's' : ''}.`)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'La génération a échoué.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopyAll() {
    const text = generated.map((item) => `${item.code} — ${item.secret}`).join('\n')
    const ok = await copyText(text)
    toast(ok ? 'Liste copiée !' : 'Copie impossible sur cet appareil.', ok ? 'success' : 'error')
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

  async function toggleHistory(item: TicketItem) {
    if (historyCode === item.code) {
      setHistoryCode(null)
      setHistory([])
      return
    }
    setHistoryCode(item.code)
    setHistory([])
    setHistoryLoading(true)
    try {
      setHistory(await api.ticketHistory(item.code))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Historique impossible.', 'error')
    } finally {
      setHistoryLoading(false)
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

        {generated.length > 0 ? (
          <div id="generated-tickets" className="mt-6 border-t border-line pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-ink">{generated.length} tickets générés</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => void handleCopyAll()}>
                  <Copy size={13} /> Copier tout
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer size={13} /> Imprimer
                </Button>
              </div>
            </div>
            <p className="mt-2 rounded-lg border border-warning/30 bg-[#fdf3e2] px-3 py-2 text-[12px] leading-relaxed text-[#8a5300]">
              Copie ou imprime ces numéros maintenant : après avoir fermé cette page, ils ne
              seront plus affichés.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[340px] text-left text-[13px]">
                <tbody>
                  {generated.map((item) => (
                    <tr key={item.code} className="border-b border-line/60">
                      <td className="py-2 pr-4 font-semibold tracking-wide text-ink">{item.code}</td>
                      <td className="py-2 font-mono text-[12px] tracking-widest text-ink">{item.secret}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      {/* Liste des tickets */}
      <section className="mt-8">
        <div className="flex items-end justify-between gap-4 border-b border-line pb-4">
          <div>
            <h2 className="text-[22px] font-medium tracking-[-0.01em] text-ink">Tous les tickets</h2>
            <p className="mt-1 text-[11px] text-mute">
              Disponible · En cours (séries faites) · Terminé (30 séries) · Suspendu
            </p>
          </div>
          <span className="font-display text-[1.6rem] leading-none text-ink">{tickets.length}</span>
        </div>

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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-mute">
                  <th className="py-3 pr-4 font-semibold">Ticket</th>
                  <th className="py-3 pr-4 font-semibold">Statut</th>
                  <th className="py-3 pr-4 font-semibold">Créé</th>
                  <th className="py-3 pr-4 font-semibold">1ʳᵉ connexion</th>
                  <th className="py-3 pr-4 font-semibold">Dernière connexion</th>
                  <th className="py-3 pr-4 font-semibold">Historique</th>
                  <th className="py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((item) => {
                  const display = ticketDisplay(item)
                  return (
                    <>
                      <tr key={item.code} className="border-b border-line/60 align-middle">
                        <td className="py-3 pr-4 font-semibold tracking-wide text-ink">{item.code}</td>
                        <td className="py-3 pr-4">
                          <StatusPill tone={display.tone}>{display.label}</StatusPill>
                        </td>
                        <td className="py-3 pr-4 text-mute">{formatDateLong(item.createdAt)}</td>
                        <td className="py-3 pr-4 text-mute">{item.usedAt ? formatDateLong(item.usedAt) : '—'}</td>
                        <td className="py-3 pr-4 text-mute">{item.lastLoginAt ? formatDateTime(item.lastLoginAt) : '—'}</td>
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            onClick={() => void toggleHistory(item)}
                            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline"
                          >
                            <History size={13} /> {historyCode === item.code ? 'Masquer' : 'Voir'}
                          </button>
                        </td>
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
                      {historyCode === item.code ? (
                        <tr key={`${item.code}-history`} className="border-b border-line/60">
                          <td colSpan={7} className="bg-cloud/60 px-4 py-3">
                            {historyLoading ? (
                              <p className="text-[12px] text-mute">Chargement…</p>
                            ) : history.length === 0 ? (
                              <p className="text-[12px] text-mute">Aucune connexion enregistrée.</p>
                            ) : (
                              <p className="text-[12px] leading-relaxed text-mute">
                                {history.length} connexion{history.length > 1 ? 's' : ''} :{' '}
                                {history.map((date) => formatDateTime(date)).join(' · ')}
                              </p>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style>{`@media print { body * { visibility: hidden; } #generated-tickets, #generated-tickets * { visibility: visible; } #generated-tickets { position: absolute; left: 0; top: 0; width: 100%; border: 0; padding: 0; } }`}</style>
    </div>
  )
}
