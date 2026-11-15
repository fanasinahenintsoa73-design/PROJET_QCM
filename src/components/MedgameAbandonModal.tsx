import { useState } from 'react'
import { api } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'
import { buttonClasses } from '@/components/ui/Button'

/**
 * Confirmation d'abandon : quitter MEDGAME consomme une série, la progression
 * dans le parcours est conservée.
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Abandon impossible. Réessaie.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Abandon"
      title="Quitter MEDGAME ?"
      size="sm"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className={buttonClasses('secondary', 'md', 'w-full')}
          >
            Rester
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void abandon()}
            className={buttonClasses('primary', 'md', 'w-full')}
          >
            {busy ? 'Abandon…' : 'Quitter et abandonner'}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-mute">
          Quitter maintenant compte comme un abandon et consomme une série. Ta progression dans le
          parcours est conservée.
        </p>
        {error ? <p className="text-[12px] leading-relaxed text-sale">{error}</p> : null}
      </div>
    </Modal>
  )
}
