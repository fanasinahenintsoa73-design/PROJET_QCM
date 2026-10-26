import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export function addDays(date: Date | string, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function isExpired(expiresAt?: string) {
  return !!expiresAt && new Date(expiresAt).getTime() <= Date.now()
}

/** Whole days remaining, rounded up (0 when expired). */
export function daysLeft(expiresAt?: string) {
  if (!expiresAt) return 0
  const ms = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

/** Precise remaining time, e.g. "12 j 04 h". */
export function timeLeft(expiresAt?: string) {
  if (!expiresAt) return '—'
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expiré'
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  return d > 0 ? `${d} j ${String(h).padStart(2, '0')} h` : `${h} h`
}

export function formatDate(value?: string | Date, opts: Intl.DateTimeFormatOptions = {}) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  }).format(new Date(value))
}

export function formatDateLong(value?: string | Date) {
  return formatDate(value, { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatDateTime(value?: string | Date) {
  return formatDate(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function relativeDate(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
  if (days <= 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 7) return `Il y a ${days} jours`
  return formatDate(value)
}

export function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`
}

export function monthLabel(date = new Date()) {
  const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export function scoreTone(score: number, total: number) {
  const ratio = total ? score / total : 0
  if (ratio >= 0.8) return 'excellent'
  if (ratio >= 0.6) return 'solide'
  if (ratio >= 0.4) return 'à consolider'
  return 'à reprendre'
}

export function shuffle<T>(array: T[]): T[] {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const MAX_RECEIPT_BYTES = 3 * 1024 * 1024
const MAX_IMAGE_SIDE = 1600

/**
 * Accepts an image or a PDF and returns a compact receipt payload.
 * Images are downscaled and re-encoded so the demo store stays light.
 */
export async function prepareReceipt(file: File) {
  if (file.size > MAX_RECEIPT_BYTES) {
    throw new Error('Fichier trop lourd (3 Mo maximum). Compressez la photo et réessayez.')
  }
  const mime = file.type || 'application/octet-stream'
  const isPdf = mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const isImage = mime.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)
  if (!isPdf && !isImage) {
    throw new Error('Format non pris en charge. Ajoutez une photo (JPG, PNG) ou un PDF.')
  }
  if (isPdf) {
    return {
      dataUrl: await readFileAsDataUrl(file),
      name: file.name,
      mime: 'application/pdf',
      size: file.size,
    }
  }

  let bitmap: ImageBitmap | HTMLImageElement
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    const url = URL.createObjectURL(file)
    try {
      bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Image illisible'))
        img.src = url
      })
    } catch {
      URL.revokeObjectURL(url)
      throw new Error("Cette image n'a pas pu être lue. Essayez un JPG ou un PNG.")
    }
    URL.revokeObjectURL(url)
  }

  const width = 'width' in bitmap ? bitmap.width : 0
  const height = 'height' in bitmap ? bitmap.height : 0
  const ratio = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * ratio))
  canvas.height = Math.max(1, Math.round(height * ratio))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Impossible de préparer cette image.')
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, canvas.width, canvas.height)
  if ('close' in bitmap) bitmap.close()

  let quality = 0.82
  let dataUrl = canvas.toDataURL('image/jpeg', quality)
  while (dataUrl.length > 2_200_000 && quality > 0.4) {
    quality -= 0.14
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }
  const approxSize = Math.round((dataUrl.length * 3) / 4)
  return {
    dataUrl,
    name: file.name,
    mime: 'image/jpeg',
    size: approxSize,
  }
}

export function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const answerLetters = ['A', 'B', 'C', 'D'] as const
export type AnswerLetter = (typeof answerLetters)[number]

export function sameAnswer(a: string[] = [], b: string[] = []) {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((value, i) => value === sortedB[i])
}
