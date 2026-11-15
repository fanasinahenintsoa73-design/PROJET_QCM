import { Modal } from '@/components/ui/Modal'
import { buttonClasses } from '@/components/ui/Button'

/**
 * Demande de confirmation avant d'enregistrer les chapitres d'une UE dans
 * MEDGAME. En confirmant, les chapitres sont enregistrés et l'étudiant peut
 * les consulter dans « Mon jeu ».
 */
export function MedgameSaveChaptersModal({
  open,
  onClose,
  onConfirmed,
  chapterCount,
  starting,
  error,
}: {
  open: boolean
  onClose: () => void
  onConfirmed: () => void
  chapterCount: number
  starting: boolean
  error: string
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          Enregistrer les chapitres
        </p>
        <h2 className="mt-2 font-display text-[1.45rem] leading-tight text-ink">
          Voulez-vous enregistrer les chapitres ?
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-mute">
          En confirmant, les{' '}
          <span className="font-medium text-ink">
            {chapterCount} chapitre{chapterCount > 1 ? 's' : ''}
          </span>{' '}
          choisi{chapterCount > 1 ? 's' : ''} pour cette UE sont enregistrés. Vous pouvez les
          consulter dans « Mon jeu ».
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
            disabled={starting}
            className={buttonClasses('secondary', 'md', starting ? 'opacity-60' : '')}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirmed}
            disabled={starting}
            className={buttonClasses('primary', 'md', starting ? 'opacity-60' : '')}
          >
            {starting ? 'Enregistrement…' : 'Confirmer'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
