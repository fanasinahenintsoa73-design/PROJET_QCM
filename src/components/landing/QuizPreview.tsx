import { Check, ArrowUpRight } from 'lucide-react'

const options = [
  { letter: 'A', text: 'Fréquence cardiaque ÷ volume d’éjection systolique' },
  { letter: 'B', text: 'Fréquence cardiaque × volume d’éjection systolique', correct: true },
  { letter: 'C', text: 'Volume d’éjection systolique × pression artérielle' },
  { letter: 'D', text: 'Fréquence cardiaque + volume d’éjection systolique' },
]

export function QuizPreview() {
  return (
    <div className="relative bg-canvas">
      <div className="flex items-center justify-between border-b border-hairline-soft px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3">
          <span className="eyebrow">Corrigé</span>
          <span className="h-3 w-px bg-hairline" />
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-mute">Série n° 04</span>
        </div>
        <span className="font-display text-[24px] leading-none">17 / 20</span>
      </div>

      <div className="px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex items-center justify-between">
          <span className="eyebrow text-ink">Question 06 · Physiologie</span>
          <span className="text-[10px] tabular-nums text-mute">06 / 20</span>
        </div>
        <p className="mt-5 text-[17px] font-medium leading-snug tracking-[-0.01em] sm:text-[19px]">
          Le débit cardiaque est égal à :
        </p>

        <div className="mt-5 divide-y divide-hairline-soft border-y border-hairline-soft">
          {options.map((option) => (
            <div
              key={option.letter}
              className={
                option.correct
                  ? 'flex items-center gap-3 bg-[#eef7f1] px-3 py-3'
                  : 'flex items-center gap-3 px-3 py-3'
              }
            >
              <span
                className={
                  option.correct
                    ? 'grid h-7 w-7 shrink-0 place-items-center bg-success text-white'
                    : 'grid h-7 w-7 shrink-0 place-items-center border border-hairline-soft text-[11px] font-medium text-mute'
                }
              >
                {option.correct ? <Check size={13} strokeWidth={2.5} /> : option.letter}
              </span>
              <span className="text-[12px] leading-snug sm:text-[13px]">{option.text}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 bg-cloud p-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-success">
              Réponse exacte — B
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-success">+1</span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-charcoal">
            Le débit cardiaque correspond au volume de sang éjecté par minute. Il est le produit de la
            fréquence cardiaque par le volume d’éjection systolique.
          </p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] underline decoration-1 underline-offset-4"
          >
            Explication du docteur <ArrowUpRight size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}
