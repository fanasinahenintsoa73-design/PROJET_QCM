import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Filter,
  FolderOpen,
  Image as ImageIcon,
} from 'lucide-react'
import { api } from '@/lib/api'
import { chapterTitle, PACE_THEMES, themeTitle } from '@/lib/themes'
import { Modal } from '@/components/ui/Modal'
import { usePageTitle } from '@/components/Layouts'
import type { CourseSupport, ExamSubject } from '@/types'

type Kind = 'supports' | 'subjects'
type ContentItem = CourseSupport | ExamSubject

// pdf.js est volumineux : on ne le charge qu'à l'ouverture d'un PDF.
const PdfViewer = lazy(() =>
  import('@/components/PdfViewer').then((module) => ({ default: module.PdfViewer })),
)

function isImage(mime: string, fileName?: string): boolean {
  if (mime.startsWith('image/')) return true
  return Boolean(fileName && /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileName))
}

function isPdf(mime: string, fileName?: string): boolean {
  if (mime === 'application/pdf' || mime.endsWith('/pdf')) return true
  return Boolean(fileName && fileName.toLowerCase().endsWith('.pdf'))
}

export default function ContentLibraryPage({ kind }: { kind: Kind }) {
  const isSupports = kind === 'supports'
  usePageTitle(isSupports ? 'Supports du cours — MEDQCM mada' : 'Sujets concours — MEDQCM mada')
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ueFilter, setUeFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [viewing, setViewing] = useState<ContentItem | null>(null)
  const [viewUrl, setViewUrl] = useState('')
  const [viewLoading, setViewLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const load = isSupports ? api.listCourseSupports() : api.listExamSubjects()
    load
      .then((next) => {
        if (cancelled) return
        setItems(next)
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Impossible de charger les contenus.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isSupports])

  const years = useMemo(() => {
    const values = new Set<number>()
    for (const item of items) {
      if ('year' in item) values.add(item.year)
    }
    return [...values].sort((a, b) => b - a)
  }, [items])

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (ueFilter !== 'all' && item.ueId !== ueFilter) return false
        if (!isSupports && yearFilter !== 'all' && 'year' in item) {
          return String(item.year) === yearFilter
        }
        return true
      }),
    [isSupports, items, ueFilter, yearFilter],
  )

  const grouped = useMemo(() => {
    if (isSupports) {
      const map = new Map<string, ContentItem[]>()
      for (const item of filtered) {
        const key = `${item.ueId}::${(item as CourseSupport).chapterId}`
        map.set(key, [...(map.get(key) ?? []), item])
      }
      return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
    }
    const map = new Map<number, ContentItem[]>()
    for (const item of filtered) {
      const year = (item as ExamSubject).year
      map.set(year, [...(map.get(year) ?? []), item])
    }
    return [...map.entries()].sort(([a], [b]) => b - a)
  }, [filtered, isSupports])

  async function open(item: ContentItem) {
    setViewing(item)
    setViewUrl('')
    setViewLoading(true)
    try {
      const path = item.storagePath
      if (path) {
        setViewUrl(await api.resolveContentUrl(path))
      } else if (item.dataUrl) {
        setViewUrl(item.dataUrl)
      } else {
        throw new Error('Ce fichier est indisponible.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’ouvrir le fichier.')
    } finally {
      setViewLoading(false)
    }
  }

  function closeViewer() {
    setViewing(null)
    setViewUrl('')
  }

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        <Link
          to="/app"
          className="inline-flex items-center gap-2 text-[12px] font-medium text-mute transition hover:text-accent"
        >
          <ArrowLeft size={14} /> Mon espace
        </Link>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              {isSupports ? <BookOpen size={12} /> : <FileText size={12} />}
              {isSupports ? 'Supports du cours' : 'Sujets concours 2014–2026'}
            </span>
            <h1 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-[-0.035em] text-ink">
              {isSupports ? 'Les documents du cours.' : 'Les sujets d’examen.'}
            </h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-mute">
              {isSupports
                ? 'Consulte les supports déposés par le docteur, classés par UE et par chapitre.'
                : 'Consulte les sujets d’examen classés par année et par UE.'}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface px-4 py-3 text-[12px] text-mute">
            <span className="text-ink">Consultation uniquement</span>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-sale/25 bg-sale/5 px-4 py-3 text-[13px] text-sale">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-mute">
            <Filter size={13} /> Filtrer
          </span>
          <select
            value={ueFilter}
            onChange={(event) => setUeFilter(event.target.value)}
            className="h-9 rounded-lg border border-line bg-canvas px-3 text-[12px] text-ink"
          >
            <option value="all">Toutes les UE</option>
            {PACE_THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.title}
              </option>
            ))}
          </select>
          {!isSupports && (
            <select
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              className="h-9 rounded-lg border border-line bg-canvas px-3 text-[12px] text-ink"
            >
              <option value="all">Toutes les années</option>
              {years.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-[35vh] items-center justify-center">
            <span className="h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
            <FolderOpen size={28} className="mx-auto text-mute" />
            <p className="mt-3 text-[14px] font-medium text-ink">Aucun contenu disponible.</p>
            <p className="mt-1 text-[12px] text-mute">
              Le docteur n’a pas encore déposé de document dans cette section.
            </p>
          </div>
        ) : (
          <div className="mt-7 space-y-7">
            {grouped.map(([key, entries]) => {
              const first = entries[0]
              const heading = isSupports
                ? `${themeTitle(first.ueId)} · ${chapterTitle((first as CourseSupport).chapterId)}`
                : `Année ${key}`
              return (
                <section key={String(key)}>
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-mute">
                    {heading}
                  </h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {entries.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void open(item)}
                        className="group flex min-h-[120px] flex-col justify-between rounded-2xl border border-line bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-soft"
                      >
                        <div className="flex items-start gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                            {isImage(item.mimeType, item.fileName) ? (
                              <ImageIcon size={16} />
                            ) : (
                              <FileText size={16} />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium leading-snug text-ink">
                              {item.title}
                            </p>
                            {item.description && (
                              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-mute">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-2 text-[10px] text-mute">
                          <span className="truncate">{item.fileName}</span>
                          <span className="shrink-0 text-accent">Consulter</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(viewing)}
        onClose={closeViewer}
        title={viewing?.title ?? 'Document'}
        eyebrow={isSupports ? 'Support du cours' : 'Sujet concours'}
        size="xl"
      >
        {viewLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : viewUrl && viewing ? (
          isImage(viewing.mimeType, viewing.fileName) ? (
            <img
              src={viewUrl}
              alt={viewing.title}
              className="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg object-contain"
            />
          ) : isPdf(viewing.mimeType, viewing.fileName) ? (
            <Suspense
              fallback={
                <div className="flex min-h-[40vh] items-center justify-center">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                </div>
              }
            >
              <PdfViewer url={viewUrl} title={viewing.title} />
            </Suspense>
          ) : (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
              <p className="text-[13px] font-medium text-ink">
                Ce document ne peut pas être affiché.
              </p>
              <a
                href={viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-[11px] font-medium text-ink transition hover:border-accent/40 hover:text-accent"
              >
                Ouvrir le fichier
              </a>
            </div>
          )
        ) : (
          <p className="py-10 text-center text-[13px] text-mute">
            Ce document ne peut pas être affiché.
          </p>
        )}
        <p className="mt-3 text-[11px] text-mute">
          Consultation dans l’application uniquement. Aucun téléchargement n’est proposé.
        </p>
      </Modal>
    </div>
  )
}

export function CourseSupportsPage() {
  return <ContentLibraryPage kind="supports" />
}

export function ExamSubjectsPage() {
  return <ContentLibraryPage kind="subjects" />
}
