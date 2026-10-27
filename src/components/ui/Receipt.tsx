import { useRef, useState } from 'react'
import { FileText, ImageUp, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import type { Receipt } from '@/types'
import { cn, formatBytes, prepareReceipt } from '@/lib/utils'

export function ReceiptDropzone({
  value,
  onChange,
  label = 'Reçu de paiement',
  hint = 'Photo ou PDF · 3 Mo maximum',
  compact = false,
}: {
  value: Receipt | null
  onChange: (receipt: Receipt | null) => void
  label?: string
  hint?: string
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(file?: File) {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const receipt = await prepareReceipt(file)
      onChange(receipt)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ce fichier n’a pas pu être lu.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  if (value) {
    return (
      <div>
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-canvas p-3 sm:flex-row sm:items-center">
          <span className="grid h-[104px] w-[82px] shrink-0 place-items-center overflow-hidden rounded-lg bg-cloud">
            {value.mime === 'application/pdf' ? (
              <FileText size={24} className="text-ink" strokeWidth={1.4} />
            ) : (
              <img src={value.dataUrl} alt="" className="h-full w-full object-cover" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-accent">Reçu ajouté</p>
            <p className="mt-1 truncate text-[14px] font-medium text-ink">{value.name}</p>
            <p className="mt-0.5 text-[11px] text-mute">
              {value.mime === 'application/pdf' ? 'PDF' : 'Image'} · {formatBytes(value.size)}
            </p>
            <div className="mt-3 flex items-center gap-4">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent underline decoration-1 underline-offset-4"
              >
                <RefreshCw size={12} /> Remplacer
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex items-center gap-1.5 text-[12px] text-mute transition hover:text-sale"
              >
                <Trash2 size={12} /> Supprimer
              </button>
            </div>
          </div>
        </div>
        <input
          ref={inputRef}
          id="receipt-upload"
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        {error && <p className="mt-2 text-[12px] text-sale">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <label
        htmlFor="receipt-upload"
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          void handleFile(event.dataTransfer.files?.[0])
        }}
        className={cn(
          'group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center transition',
          compact ? 'min-h-[142px] py-5' : 'min-h-[190px] py-8',
          dragOver
            ? 'border-accent bg-accent-soft/50'
            : 'border-line bg-canvas hover:border-accent hover:bg-accent-soft/30',
        )}
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-surface text-accent transition group-hover:bg-accent group-hover:text-white">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <ImageUp size={18} />}
        </span>
        <span className="mt-3 text-[14px] font-medium text-ink">{label}</span>
        <span className="mt-1 text-[11px] text-mute">{hint}</span>
        <span className="mt-3 text-[12px] font-medium text-accent underline decoration-1 underline-offset-4">
          Parcourir mes fichiers
        </span>
      </label>
      <input
        ref={inputRef}
        id="receipt-upload"
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        disabled={busy}
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      {error && <p className="mt-2 text-[12px] text-sale">{error}</p>}
    </div>
  )
}

export function ReceiptThumb({
  receipt,
  onClick,
}: {
  receipt: Receipt
  onClick?: () => void
}) {
  const isPdf = receipt.mime === 'application/pdf'
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-left transition hover:border-accent"
    >
      {isPdf || !receipt.dataUrl ? (
        <FileText size={18} className="text-mute" strokeWidth={1.4} />
      ) : (
        <span className="h-11 w-9 overflow-hidden rounded bg-cloud">
          <img
            src={receipt.dataUrl}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        </span>
      )}
      <span className="text-[12px] font-medium text-ink underline decoration-line underline-offset-4 group-hover:decoration-accent">
        Voir le reçu
      </span>
    </button>
  )
}
