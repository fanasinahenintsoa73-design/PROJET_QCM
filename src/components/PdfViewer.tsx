import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { getDocument, type PDFDocumentProxy } from '@/lib/pdfClient'
import { cn } from '@/lib/utils'

interface PdfViewerProps {
  url: string
  title?: string
}

const toolbarButton =
  'grid h-8 w-8 place-items-center rounded-md text-mute transition hover:bg-accent-soft hover:text-accent disabled:cursor-not-allowed disabled:opacity-35'

/**
 * Viewer PDF intégré, compatible WebView Android : pdf.js rend chaque page
 * dans un canvas au lieu de dépendre du lecteur PDF du navigateur.
 */
export function PdfViewer({ url, title }: PdfViewerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [renderError, setRenderError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [renderKey, setRenderKey] = useState(0)
  const [resizeKey, setResizeKey] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)
  const loadingTaskRef = useRef<ReturnType<typeof getDocument> | null>(null)

  // On ne mesure pas la largeur en continu : le canvas peut lui-même changer
  // la taille de la zone (barres de défilement) et déclencher une boucle de
  // rendu. On refait juste un rendu lors d'un vrai redimensionnement.
  useEffect(() => {
    const onResize = () => setResizeKey((key) => key + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    setRenderError('')
    setPdf(null)
    setPageNumber(1)
    setZoom(1)
    loadingTaskRef.current = null

    const load = async () => {
      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Le fichier n’a pas pu être chargé (${response.status}).`)
        }
        const data = new Uint8Array(await response.arrayBuffer())
        const loadingTask = getDocument({ data })
        loadingTaskRef.current = loadingTask
        const document = await loadingTask.promise
        if (cancelled) {
          await loadingTask.destroy()
          return
        }
        setPdf(document)
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Impossible de charger le PDF.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
      const loadingTask = loadingTaskRef.current
      loadingTaskRef.current = null
      if (loadingTask) void loadingTask.destroy()
    }
  }, [url, retryKey])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    let cancelled = false
    setRenderError('')

    const render = async () => {
      setRendering(true)
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return
        // `clientWidth` inclut le padding (p-3 = 12px de chaque côté).
        const availableWidth = Math.max(1, (containerRef.current?.clientWidth || 824) - 24)
        const baseViewport = page.getViewport({ scale: 1 })
        const fitScale = Math.max(0.35, Math.min(2, availableWidth / baseViewport.width))
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = page.getViewport({ scale: fitScale * zoom * dpr })
        const canvas = canvasRef.current
        if (!canvas) return

        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))
        canvas.style.width = `${Math.max(1, Math.floor(viewport.width / dpr))}px`
        canvas.style.height = `${Math.max(1, Math.floor(viewport.height / dpr))}px`

        renderTaskRef.current?.cancel()
        const task = page.render({ canvas, viewport })
        renderTaskRef.current = task
        await task.promise
        page.cleanup()
      } catch (error) {
        if (cancelled) return
        if (error instanceof Error && error.name === 'RenderingCancelledException') return
        setRenderError(error instanceof Error ? error.message : 'Impossible d’afficher cette page.')
      } finally {
        if (!cancelled) setRendering(false)
      }
    }

    void render()

    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
    }
  }, [pdf, pageNumber, zoom, renderKey, resizeKey])

  if (loadError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-lg border border-line bg-surface px-6 py-10 text-center">
        <AlertCircle size={28} className="text-sale" />
        <div>
          <p className="text-[13px] font-medium text-ink">Impossible d’afficher ce PDF.</p>
          <p className="mt-1 max-w-md text-[11px] leading-relaxed text-mute">{loadError}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setRetryKey((key) => key + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-[11px] font-medium text-ink transition hover:border-accent/40 hover:text-accent"
          >
            <RotateCcw size={14} /> Réessayer
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-[11px] font-medium text-ink transition hover:border-accent/40 hover:text-accent"
          >
            <ExternalLink size={14} /> Ouvrir le fichier
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
            disabled={!pdf || loading || pageNumber <= 1}
            className={toolbarButton}
            aria-label="Page précédente"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[86px] text-center text-[11px] font-medium text-ink">
            Page {pdf ? pageNumber : '–'} / {pdf?.numPages ?? '–'}
          </span>
          <button
            type="button"
            onClick={() => setPageNumber((page) => Math.min(pdf?.numPages ?? page, page + 1))}
            disabled={!pdf || loading || pageNumber >= (pdf?.numPages ?? 1)}
            className={toolbarButton}
            aria-label="Page suivante"
          >
            <ChevronRight size={16} />
          </button>
          {pdf && pdf.numPages > 1 && (
            <select
              value={pageNumber}
              onChange={(event) => setPageNumber(Number(event.target.value))}
              className="ml-1 h-7 rounded-md border border-line bg-white px-1.5 text-[11px] text-ink"
              aria-label="Aller à la page"
            >
              {Array.from({ length: pdf.numPages }, (_, index) => index + 1).map((page) => (
                <option key={page} value={page}>
                  {page}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))}
            disabled={!pdf || loading}
            className={toolbarButton}
            aria-label="Zoom arrière"
          >
            <ZoomOut size={15} />
          </button>
          <span className="w-10 text-center text-[11px] text-mute">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))}
            disabled={!pdf || loading}
            className={toolbarButton}
            aria-label="Zoom avant"
          >
            <ZoomIn size={15} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            disabled={!pdf || loading || zoom === 1}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-mute transition hover:bg-accent-soft hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
          >
            Ajuster
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative flex h-[60vh] items-start justify-center overflow-auto bg-[#eef0f3] p-3 sm:h-[65vh]"
      >
        {renderError ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
            <AlertCircle size={24} className="text-sale" />
            <p className="text-[12px] font-medium text-ink">Impossible d’afficher cette page.</p>
            <p className="max-w-md text-[11px] leading-relaxed text-mute">{renderError}</p>
            <button
              type="button"
              onClick={() => {
                setRenderError('')
                setRenderKey((key) => key + 1)
              }}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-[11px] font-medium text-ink transition hover:border-accent/40 hover:text-accent"
            >
              <RotateCcw size={14} /> Réessayer
            </button>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className={cn(
              'mx-auto block shadow-sm transition-opacity',
              (loading || rendering) && 'opacity-50',
            )}
            aria-label={title ? `Aperçu de ${title}` : 'Aperçu du PDF'}
          />
        )}

        {(loading || rendering) && !renderError && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[11px] text-mute shadow-sm">
              <Loader2 size={14} className="animate-spin" />
              {loading ? 'Chargement du PDF…' : 'Rendu de la page…'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
