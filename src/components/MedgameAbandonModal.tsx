import { useState } from 'react'
import { api } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'
import { buttonClasses } from '@/components/ui/Button'

/**
 * Demande de confirmation avant de quitter un niveau MEDGAME lancé.
 * Sortir sans soumettre consomme une série. La progression du parcours est conservée.
 */
export function MedgameAbandonModal({
  open,
  onClose,
  onAbandoned,
  runId,
}: {
  open: boolean
  onClose: () => void
  onAbandoned: () => void
  runId: string | null
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function abandon() {
    if (!runId || busy) return
    setBusy(true)
    setError('')

    try {
      await api.abandonMedgameRun(runId)
      onAbandoned()
    } catch {
      setError('Impossible de quitter. Réessaie dans un instant.')
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-md">
      <div className="p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sale">
          Quitter le niveau
        </p>
        <h2 className="mt-2 font-display text-[1.45rem] leading-tight text-ink">
          Voulez-vous vraiment quitter ?
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-mute">
          Ce niveau compte 1 série, même si vous le quittez sans le soumettre. Votre progression
          dans le parcours est conservée.
        </p>

        {error ? (
          <p className="mt-4 rounded-xl border border-sale/25 bg-sale/5 px-4 py-3 text-[12px] text-sale">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={buttonClasses('secondary', 'md', busy ? 'opacity-60' : '')}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void abandon()}
            disabled={busy}
            className={buttonClasses('primary', 'md', busy ? 'opacity-60' : '')}
          >
            {busy ? 'Patientez…' : 'Confirmer'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
