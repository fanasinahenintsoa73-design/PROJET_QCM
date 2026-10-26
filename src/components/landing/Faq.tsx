import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const questions = [
  {
    question: 'Faut-il installer une application ?',
    answer:
      "Non. MEDQCM fonctionne directement dans le navigateur de votre ordinateur, de votre tablette ou de votre téléphone. Aucun téléchargement, aucune mise à jour à gérer : ouvrez, connectez-vous, entraînez-vous.",
  },
  {
    question: 'Comment mon compte est-il activé ?',
    answer:
      "Vous créez votre demande en joignant votre reçu de paiement. Le docteur vérifie personnellement le justificatif sous 24 heures. Tant que la validation n'est pas faite, l'accès aux QCM reste fermé. Vous recevez ensuite vos 30 jours d'accès.",
  },
  {
    question: 'Que se passe-t-il au bout de 30 jours ?',
    answer:
      "L'accès au sujet s'arrête automatiquement à l'échéance : chaque chargement de question est bloqué et vous êtes redirigé vers la demande de renouvellement. Un nouveau sujet est publié chaque mois ; pour le débloquer, joignez votre nouveau reçu de paiement.",
  },
  {
    question: 'Puis-je enchaîner plusieurs séries ?',
    answer:
      "Oui, autant que vous le souhaitez pendant vos 30 jours. Chaque série est composée de 20 questions tirées aléatoirement dans la banque du mois. L'objectif est de revoir les notions sous des angles différents, pas d'apprendre une série par cœur.",
  },
  {
    question: 'Comment les corrigés sont-ils rédigés ?',
    answer:
      "Votre docteur importe deux fichiers : la banque de questions et les corrigés. Les deux sont appariés automatiquement par numéro. Chaque bonne réponse est associée à une explication médicale détaillée, rédigée pour comprendre le raisonnement, pas seulement le résultat.",
  },
  {
    question: 'Le paiement est-il sécurisé ?',
    answer:
      "Aucune donnée bancaire n'est saisie sur la plateforme. Vous joignez uniquement votre justificatif de paiement (photo ou PDF), que le docteur contrôle avant d'ouvrir l'accès. Ce reçu reste privé et n'est visible que par vous et le docteur.",
  },
  {
    question: 'Sur quels appareils puis-je travailler ?',
    answer:
      "Sur PC, Mac, iPhone et Android, avec la même expérience et les mêmes données. Les questions s'adaptent à l'écran, les zones tactiles sont pensées pour le mobile, et votre série reste fluide même sur une connexion modeste.",
  },
]

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="border-t border-hairline-soft">
      {questions.map((item, index) => {
        const isOpen = open === index
        return (
          <div key={item.question} className="border-b border-hairline-soft">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-6 py-6 text-left"
              onClick={() => setOpen(isOpen ? null : index)}
              aria-expanded={isOpen}
            >
              <span className="text-[15px] font-medium leading-snug sm:text-[16px]">{item.question}</span>
              <span
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-full transition duration-300',
                  isOpen ? 'rotate-45 bg-accent text-white' : 'bg-cloud text-ink',
                )}
                aria-hidden
              >
                <Plus size={17} strokeWidth={1.6} />
              </span>
            </button>
            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-out',
                isOpen ? 'grid-rows-[1fr] pb-6' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <p className="max-w-2xl pr-12 text-[14px] leading-[1.65] text-ash">{item.answer}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
