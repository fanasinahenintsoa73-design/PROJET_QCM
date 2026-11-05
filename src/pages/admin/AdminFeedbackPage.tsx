import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageSquare, RefreshCw, Star } from 'lucide-react'
import { api } from '@/lib/api'
import { usePageTitle } from '@/components/Layouts'
import { findPaceTheme } from '@/lib/themes'
import { cn, formatDateTime } from '@/lib/utils'
import type { SeriesFeedbackReview } from '@/types'

const RATING_LABELS = ['À revoir', 'Moyen', 'Bien', 'Très bien', 'Excellent']

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} étoile${rating > 1 ? 's' : ''} sur 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          strokeWidth={1.6}
          fill={star <= rating ? 'currentColor' : 'none'}
          className={star <= rating ? 'text-accent' : 'text-stone'}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

export default function AdminFeedbackPage() {
  usePageTitle('Avis des étudiants — Espace docteur')
  const [reviews, setReviews] = useState<SeriesFeedbackReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterRating, setFilterRating] = useState(0)
  const [search, setSearch] = useState('')
  const [onlyComments, setOnlyComments] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.listSeriesFeedbacks()
      setReviews(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Les avis n’ont pas pu être chargés.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const total = reviews.length
    const average = total
      ? reviews.reduce((sum, item) => sum + item.rating, 0) / total
      : 0
    const withComment = reviews.filter((item) => item.comment.trim().length > 0).length
    const distribution = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: reviews.filter((item) => item.rating === rating).length,
    }))
    return { total, average, withComment, distribution }
  }, [reviews])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return reviews.filter((item) => {
      if (filterRating !== 0 && item.rating !== filterRating) return false
      if (onlyComments && !item.comment.trim()) return false
      if (!query) return true
      const ueTitle = item.ueId ? findPaceTheme(item.ueId)?.title ?? item.ueId : ''
      const haystack = `${item.userName} ${item.userEmail} ${item.comment} ${ueTitle}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [reviews, filterRating, search, onlyComments])

  return (
    <>
      <section className="border-b border-hairline-soft">
        <div className="mx-auto max-w-content px-4 py-8 sm:px-8 sm:py-9 lg:px-12">
          <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Retours étudiants</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="display text-[clamp(2.4rem,5vw,3.8rem)]">Avis des étudiants.</h1>
              <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-mute">
                Notes sur 5 étoiles et commentaires laissés après chaque série terminée.
                Un étudiant ne peut modifier que l’avis de sa propre série.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-[12px] font-medium text-ink transition hover:border-accent hover:text-accent disabled:opacity-45"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} />
              Actualiser
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-content px-4 py-8 sm:px-8 sm:py-11 lg:px-12">
        {error ? (
          <div role="alert" className="rounded-2xl border border-sale/30 bg-danger-soft px-5 py-4 text-[13px] text-sale">
            {error}
            <span className="mt-1 block text-[12px] text-ash">
              Si aucun avis ne s’affiche, vérifiez que la migration « series_feedback » est bien
              exécutée dans Supabase.
            </span>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-mute">Avis reçus</p>
            <p className="mt-2 font-display text-[2.2rem] leading-none text-ink">{stats.total}</p>
            <p className="mt-1.5 text-[11px] text-mute">
              {stats.withComment} avec un commentaire
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-mute">Note moyenne</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="font-display text-[2.2rem] leading-none text-ink">
                {stats.total ? stats.average.toFixed(1).replace('.', ',') : '—'}
              </span>
              <span className="text-[12px] text-mute">/ 5</span>
            </p>
            <p className="mt-1.5 text-[11px] text-mute">Toutes séries confondues</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-mute">Répartition</p>
            <div className="mt-3 space-y-1.5">
              {stats.distribution.map(({ rating, count }) => {
                const width = stats.total ? Math.round((count / stats.total) * 100) : 0
                return (
                  <div key={rating} className="flex items-center gap-2 text-[11px]">
                    <span className="w-6 shrink-0 text-mute">{rating}★</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-cloud">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
                    </span>
                    <span className="w-7 shrink-0 text-right tabular-nums text-ink">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 border-b border-hairline pb-4">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 0, label: 'Toutes' },
              { value: 5, label: '5★' },
              { value: 4, label: '4★' },
              { value: 3, label: '3★' },
              { value: 2, label: '2★' },
              { value: 1, label: '1★' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilterRating(option.value)}
                aria-pressed={filterRating === option.value}
                className={cn(
                  'h-9 rounded-full border px-3.5 text-[12px] font-medium transition',
                  filterRating === option.value
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface text-mute hover:border-accent hover:text-accent',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-[12px] text-mute">
            <input
              type="checkbox"
              checked={onlyComments}
              onChange={(event) => setOnlyComments(event.target.checked)}
              className="size-4 accent-[#0B6B4F]"
            />
            Avec commentaire uniquement
          </label>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un étudiant, un mot…"
            aria-label="Rechercher dans les avis"
            className="form-input ml-auto h-10 w-full max-w-xs"
          />
        </div>

        {loading ? (
          <p className="py-12 text-center text-[13px] text-mute">Chargement des avis…</p>
        ) : filtered.length === 0 ? (
          <div className="flex items-start gap-3 py-12">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
              <MessageSquare className="size-4" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[14px] font-medium text-ink">Aucun avis à afficher.</p>
              <p className="mt-1 max-w-md text-[12px] leading-relaxed text-mute">
                {reviews.length === 0
                  ? 'Les avis apparaîtront ici dès qu’un étudiant notera une série terminée. La migration Supabase « series_feedback » doit être exécutée pour qu’ils arrivent côté serveur.'
                  : 'Aucun avis ne correspond aux filtres actuels. Essayez une autre note ou effacez la recherche.'}
              </p>
            </div>
          </div>
        ) : (
          <div>
            {filtered.map((item) => {
              const ueTitle = item.ueId
                ? findPaceTheme(item.ueId)?.title ?? item.ueId
                : 'UE de QCM'
              return (
                <article key={item.attemptId} className="border-b border-hairline py-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-ink">{item.userName}</p>
                      <p className="mt-0.5 truncate text-[11px] text-mute">
                        {item.userEmail}
                        <span aria-hidden="true"> · </span>
                        {ueTitle}
                        <span aria-hidden="true"> · </span>
                        Série : {item.score}/{item.total} · {formatDateTime(item.attemptCreatedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <Stars rating={item.rating} />
                      <span className="text-[12px] font-medium text-ink">
                        {RATING_LABELS[item.rating - 1]}
                      </span>
                    </div>
                  </div>
                  {item.comment.trim() ? (
                    <p className="mt-3 max-w-3xl rounded-lg bg-cloud px-4 py-3 text-[13px] leading-relaxed text-ash">
                      « {item.comment} »
                    </p>
                  ) : (
                    <p className="mt-3 text-[12px] italic text-mute">Note seule, sans commentaire.</p>
                  )}
                  <p className="mt-2 text-[10px] text-mute">
                    Avis envoyé le {formatDateTime(item.createdAt)}
                    {item.updatedAt && item.updatedAt !== item.createdAt
                      ? ` · modifié le ${formatDateTime(item.updatedAt)}`
                      : ''}
                  </p>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
