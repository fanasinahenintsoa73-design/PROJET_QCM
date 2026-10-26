import { useRef, useState } from 'react'
import { FileText, ImageUp, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import type { Receipt } from '@/types'
import { cn, formatBytes, prepareReceipt } from '@/lib/utils'

export function ReceiptDropzone({
  value,
  onChange,
  label = 'Ajouter le reçu de paiement',
  hint = 'Photo ou PDF · 3 Mo max · Obligatoire',
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

  async function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const receipt = await prepareReceipt(file)
      onChange(receipt)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de lire ce fichier.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  if (value) {
    const isPdf = value.mime === 'application/pdf'
    return (
      <div className="border border-hairline-soft bg-cloud/50 p-3">
        <div className="flex items-stretch gap-4">
          <div className="relative h-[104px] w-[82px] shrink-0 overflow-hidden bg-ink">
            {isPdf ? (
              <div className="grid h-full place-items-center text-white">
                <FileText size={28} strokeWidth={1.4} />
              </div>
            ) : (
              <img src={value.dataUrl} alt="Aperçu du reçu" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
            <div className="min-w-0">
              <p className="eyebrow mb-1 text-success">Reçu ajouté</p>
              <p className="truncate text-[14px] font-medium">{value.name}</p>
              <p className="mt-1 text-[12px] text-mute">
                {isPdf ? 'PDF' : 'Image'} · {formatBytes(value.size)}
              </p>
            </div>
            <div className="flex items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium underline decoration-1 underline-offset-4 hover:text-mute"
              >
                <RefreshCw size={12} /> Remplacer
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-sale hover:opacity-70"
              >
                <Trash2 size={12} /> Supprimer
              </button>
            </div>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        {error && <p className="mt-3 text-[12px] text-sale">{error}</p>}
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
          void handleFiles(event.dataTransfer.files)
        }}
        className={cn(
          'group flex cursor-pointer flex-col items-center justify-center border border-dashed px-6 text-center transition',
          compact ? 'min-h-[142px] py-5' : 'min-h-[190px] py-8',
          dragOver ? 'border-ink bg-cloud' : 'border-hairline bg-cloud/40 hover:border-ink hover:bg-cloud',
        )}
      >
        <span className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-white transition group-hover:bg-ink group-hover:text-white">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <ImageUp size={18} strokeWidth={1.6} />}
        </span>
        <span className="text-[14px] font-medium">{busy ? 'Préparation du fichier…' : label}</span>
        <span className="mt-1.5 text-[11px] text-mute">{hint}</span>
        <span className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] underline decoration-1 underline-offset-4">
          Parcourir mes fichiers
        </span>
      </label>
      <input
        ref={inputRef}
        id="receipt-upload"
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      {error && (
        <p className="mt-2 text-[12px] text-sale" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function ReceiptThumb({ receipt, onClick }: { receipt: Receipt; onClick: () => void }) {
  if (receipt.mime === 'application/pdf') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 border border-hairline-soft px-3 py-2 text-[12px] font-medium transition hover:border-ink"
      >
        <FileText size={15} /> Voir le reçu
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-2.5 text-left"
      aria-label="Voir le reçu de paiement"
    >
      <span className="h-11 w-9 overflow-hidden bg-cloud">
        <img
          src={receipt.dataUrl}
          alt=""
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      </span>
      <span className="text-[12px] font-medium underline decoration-1 underline-offset-4 group-hover:text-mute">
        Voir le reçu
      </span>
    </button>
  )
}
