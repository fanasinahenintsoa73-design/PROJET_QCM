import type { GeneratedTicket } from '@/types'

/** Date du jour au format AAAA-MM-JJ pour le nom des fichiers exportés. */
function ticketFileBase(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `medqcm-tickets-${now.getFullYear()}-${month}-${day}`
}

/** Copie un texte dans le presse-papiers (repli si l'API Clipboard échoue). */
export async function copyText(text: string): Promise<boolean> {
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

/**
 * Télécharge le lot généré en fichier Excel (.xlsx) : 2 colonnes,
 * « ID » et « Numéro d'enregistrement ». Charges la librairie à la demande
 * (chunk séparé, pas dans le bundle initial).
 */
export async function downloadExcelTickets(tickets: GeneratedTicket[]): Promise<void> {
  if (tickets.length === 0) throw new Error('Aucun ticket à télécharger.')
  const XLSX = await import('xlsx')

  const rows: string[][] = tickets.map((item) => [item.code, item.secret])
  const worksheet = XLSX.utils.aoa_to_sheet([['ID', 'Numéro d’enregistrement'], ...rows])
  worksheet['!cols'] = [{ wch: 14 }, { wch: 24 }]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets')
  XLSX.writeFile(workbook, `${ticketFileBase()}.xlsx`)
}

/**
 * Télécharge le lot généré en PDF propre, comme une liste d'examen :
 * titre, date, tableau ID + numéro d'enregistrement.
 */
export async function downloadPdfTickets(tickets: GeneratedTicket[]): Promise<void> {
  if (tickets.length === 0) throw new Error('Aucun ticket à télécharger.')
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 48
  const dateText = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  doc.setFont('times', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(21, 32, 27)
  doc.text('MEDQCM — Tickets d’accès', margin, 64)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(101, 112, 105)
  doc.text(`Généré le ${dateText} · ${tickets.length} ticket${tickets.length > 1 ? 's' : ''}`, margin, 86)

  autoTable(doc, {
    startY: 104,
    head: [['ID', 'Numéro d’enregistrement']],
    body: tickets.map((item) => [item.code, item.secret]),
    theme: 'grid',
    styles: { fontSize: 11, cellPadding: 7, lineColor: [215, 222, 216], textColor: [21, 32, 27] },
    headStyles: { font: 'helvetica', fontStyle: 'bold', fillColor: [11, 107, 79], textColor: 255 },
    columnStyles: { 0: { cellWidth: 110, font: 'helvetica', fontStyle: 'bold' }, 1: { font: 'courier' } },
    alternateRowStyles: { fillColor: [245, 247, 243] },
  })

  const finalY = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 104
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(101, 112, 105)
  doc.text('MEDQCM · Document généré depuis l’espace docteur · À distribuer en main propre.', margin, finalY + 24)

  doc.save(`${ticketFileBase()}.pdf`)
}
