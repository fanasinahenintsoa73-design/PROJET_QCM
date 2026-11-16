import { CheckCircle2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { buttonClasses } from '@/components/ui/Button'

/**
 * Demande de confirmation avant d'enregistrer les chapitres d'une UE dans
 * MEDGAME. En confirmant, les chapitres sont enregistrés mais aucun niveau
 * n'est lancé : l'étudiant choisit ensuite quand commencer depuis « Mon jeu ».
 */
export function MedgameSaveChaptersModal({
  open,
  onClose,
  onConfirmed,
  chapterCount,
  starting,
  error,
  saved,
  onGoToGame,
}: {
  open: boolean
  onClose: () => void
  onConfirmed: () => void
  chapterCount: number
  starting: boolean
  error: string
  saved: boolean
  onGoToGame: () => void
}) {
  if (saved) {
    return (
      <Modal open={open} onClose={onClose}>
        <div className="p-6">
          <CheckCircle2 size={30} className="text-success" />
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            Enregistrement terminé
          </p>
          <h2 className="mt-2 font-display text-[1.45rem] leading-tight text-ink">
            Chapitre enregistré.
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-mute">
            Vous pouvez consulter et commencer le niveau.
          </p>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className={buttonClasses('secondary', 'md')}
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={onGoToGame}
              className={buttonClasses('primary', 'md')}
            >
              Voir mon jeu
            </button>
          </div>
        </div>
      </Modal>
    )
  }

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
          En confirmant,{' '}
          {chapterCount > 1 ? (
            <>
              les <span className="font-medium text-ink">{chapterCount} chapitres</span> choisis
              pour cette UE sont enregistrés.
            </>
          ) : (
            <>
              le <span className="font-medium text-ink">chapitre</span> choisi pour cette UE est
              enregistré.
            </>
          )}{' '}
          Vous pourrez consulter votre jeu et commencer le niveau quand vous voulez.
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
            {starting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
