import { useState } from 'react'
import { ArrowLeft, Copy, FileSpreadsheet, FileText } from 'lucide-react'
import { usePageTitle } from '@/components/Layouts'
import { Button, ButtonLink } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { copyText, downloadExcelTickets, downloadPdfTickets } from '@/lib/downloadTickets'
import { getGeneratedTickets } from '@/lib/generatedTicketsSession'

export default function AdminGeneratedTicketsPage() {
  usePageTitle('Tickets générés — Espace docteur')
  const { toast } = useToast()
  const batch = getGeneratedTickets()
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null)

  async function handleExcel() {
    setBusy('excel')
    try {
      await downloadExcelTickets(batch)
      toast('Fichier Excel enregistré dans les téléchargements.')
    } catch {
      toast('Téléchargement Excel impossible. Réessaie.', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function handlePdf() {
    setBusy('pdf')
    try {
      await downloadPdfTickets(batch)
      toast('Fichier PDF enregistré dans les téléchargements.')
    } catch {
      toast('Téléchargement PDF impossible. Réessaie.', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function handleCopy() {
    const text = batch.map((item) => `${item.code} — ${item.secret}`).join('\n')
    const ok = await copyText(text)
    toast(ok ? 'Liste copiée !' : 'Copie impossible sur cet appareil.', ok ? 'success' : 'error')
  }

  if (batch.length === 0) {
    return (
      <div className="mx-auto max-w-content px-5 py-8 sm:px-8 lg:px-10">
        <h1 className="font-display text-[clamp(1.9rem,4vw,2.6rem)] leading-[1.05] tracking-[-0.02em] text-ink">
          Aucun ticket à afficher.
        </h1>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-mute">
          Les numéros ne sont visibles qu’une seule fois, juste après la génération. Si cette page
          a été actualisée, ils ne sont plus affichés.
        </p>
        <div className="mt-7">
          <ButtonLink to="/admin/tickets">
            <ArrowLeft size={15} /> Retour aux tickets
          </ButtonLink>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-content px-5 py-8 sm:px-8 lg:px-10">
      <ButtonLink to="/admin/tickets" variant="ghost" size="sm" className="-ml-2">
        <ArrowLeft size={14} /> Retour aux tickets
      </ButtonLink>

      <h1 className="mt-6 font-display text-[clamp(1.9rem,4vw,2.6rem)] leading-[1.05] tracking-[-0.02em] text-ink">
        {batch.length} ticket{batch.length > 1 ? 's' : ''} généré{batch.length > 1 ? 's' : ''}.
      </h1>
      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-mute">
        Télécharge ou copie ces numéros maintenant : après avoir quitté cette page, ils ne seront
        plus affichés.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => void handleExcel()} loading={busy === 'excel'}>
          <FileSpreadsheet size={15} /> Télécharger Excel
        </Button>
        <Button variant="outline" onClick={() => void handlePdf()} loading={busy === 'pdf'}>
          <FileText size={15} /> Télécharger PDF
        </Button>
        <Button variant="outline" onClick={() => void handleCopy()}>
          <Copy size={13} /> Copier tout
        </Button>
      </div>

      <p className="mt-6 rounded-lg border border-warning/30 bg-[#fdf3e2] px-4 py-3 text-[13px] leading-relaxed text-[#8a5300]">
        Chaque numéro donne accès à 30 séries pour un seul étudiant. Ne les partage qu’avec la
        personne concernée.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[340px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-mute">
              <th className="py-3 pr-4 font-semibold">ID</th>
              <th className="py-3 font-semibold">Numéro d’enregistrement</th>
            </tr>
          </thead>
          <tbody>
            {batch.map((item) => (
              <tr key={item.code} className="border-b border-line/60">
                <td className="py-2.5 pr-4 font-semibold tracking-wide text-ink">{item.code}</td>
                <td className="py-2.5 font-mono text-[12px] tracking-widest text-ink">{item.secret}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
