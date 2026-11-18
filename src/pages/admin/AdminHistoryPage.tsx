import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, History, RefreshCw, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { usePageTitle } from '@/components/Layouts'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { cn, formatDateTime } from '@/lib/utils'
import type { CompletedHistoryItem, CompletedSeriesRow } from '@/types'

function seriesLabel(row: CompletedSeriesRow): string {
  const parts: string[] = []
  if (row.ue) parts.push(row.ue)
  if (row.chapters && row.chapters.length > 0) parts.push(row.chapters.join(', '))
  return parts.length > 0 ? parts.join(' · ') : '—'
}

function seriesScore(row: CompletedSeriesRow): string {
  if (row.kind === 'medgame') {
    if (row.correct != null && row.total != null) return `${row.correct}/${row.total} bonnes réponses`
    if (row.level != null) return `Niveau ${row.level}`
    return 'Terminé'
  }
  if (row.score != null && row.total != null) return `${row.score}/${row.total}`
  return 'Terminé'
}

export default function AdminHistoryPage() {
  usePageTitle('Historique des comptes — Espace docteur')
  const { toast } = useToast()
  const [items, setItems] = useState<CompletedHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await api.listCompletedHistory())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'L’historique n’a pas pu être chargé.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const total = items.length
    const average = total
      ? items.reduce((sum, item) => sum + (item.average || 0), 0) / total
      : 0
    const series = items.reduce((sum, item) => sum + item.series.length, 0)
    return { total, average, series }
  }, [items])

  function toggle(id: string) {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDelete(item: CompletedHistoryItem) {
    setDeletingId(item.id)
    try {
      await api.deleteCompletedHistory(item.id)
      toast(`Historique de ${item.ticketCode} supprimé.`)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'La suppression a échoué.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-content px-5 py-8 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mute">
            Espace docteur
          </p>
          <h1 className="mt-1 font-display text-[30px] tracking-[-0.02em] text-ink">
            Historique des comptes terminés
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-mute">
            Trace anonyme des étudiants ayant terminé leurs 30 séries. Le compte et ses données ont
            été supprimés ; il ne reste que ce résumé, que vous pouvez supprimer à tout moment.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} /> Actualiser
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-[11px] text-mute">Comptes terminés</p>
          <p className="mt-1 font-display text-[24px] text-ink">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-[11px] text-mute">Séries jouées</p>
          <p className="mt-1 font-display text-[24px] text-ink">{stats.series}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-[11px] text-mute">Moyenne globale</p>
          <p className="mt-1 font-display text-[24px] text-ink">{stats.average.toFixed(1)} / 100</p>
        </div>
      </div>

      {loading ? (
        <p className="mt-8 text-[13px] text-mute">Chargement…</p>
      ) : error ? (
        <p className="mt-8 text-[13px] text-sale">{error}</p>
      ) : items.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-12 text-center">
          <History size={28} className="text-mute" />
          <p className="text-[14px] font-medium text-ink">Aucun compte terminé pour l’instant</p>
          <p className="max-w-md text-[12px] leading-relaxed text-mute">
            L’historique apparaîtra ici dès qu’un étudiant aura terminé ses 30 séries et que son
            compte aura été supprimé.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((item) => {
            const isOpen = expanded.has(item.id)
            return (
              <div key={item.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-expanded={isOpen}
                  >
                    <ChevronDown
                      size={16}
                      className={cn('shrink-0 text-mute transition', isOpen && 'rotate-180')}
                    />
                    <div className="min-w-0">
                      <p className="font-mono text-[13px] font-medium text-ink">
                        {item.studentLabel || item.ticketCode}
                      </p>
                      <p className="mt-0.5 text-[11px] text-mute">
                        {item.series.length} séries · moyenne {item.average.toFixed(1)} / 100
                        {item.completedAt ? ` · terminé le ${formatDateTime(item.completedAt)}` : ''}
                      </p>
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDelete(item)}
                    disabled={deletingId === item.id}
                  >
                    <Trash2 size={14} /> Supprimer
                  </Button>
                </div>

                {isOpen ? (
                  <div className="border-t border-line bg-cloud/40 px-4 py-3">
                    {item.series.length === 0 ? (
                      <p className="text-[12px] text-mute">Aucun détail de série.</p>
                    ) : (
                      <ul className="divide-y divide-line">
                        {item.series.map((row, index) => (
                          <li
                            key={`${row.date}-${index}`}
                            className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12px]"
                          >
                            <div className="min-w-0">
                              <span className="mr-2 font-medium text-ink">
                                {row.kind === 'medgame' ? 'MEDGAME checker' : 'Pré-concours'}
                              </span>
                              <span className="text-mute">{seriesLabel(row)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-ink">{seriesScore(row)}</span>
                              <span className="text-mute">{formatDateTime(row.date)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
