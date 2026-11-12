import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { answerLetters, cn } from '@/lib/utils'
import type { AnkiLevelResult, Question } from '@/types'

const STAR_GOLD = '#B98A2E'
const STAR_EMPTY = '#DCE2DD'

/** Le texte d'une option, quelle que soit la lettre choisie. */
function optionText(question: Question, letter: string): string {
  const options = question.options as unknown as Record<string, string | undefined>
  return options[letter] ?? letter
}

/** Le bilan d'un niveau : le verdict, puis la correction des 5 questions. */
export function LevelBilan({
  chapterId,
  level,
  result,
  questions,
  answers,
}: {
  chapterId: string
  level: number
  result: AnkiLevelResult
  questions: Question[]
  answers: Record<string, string[]>
}) {
  const passed = result.passed
  const missing = result.total - result.correct

  return (
    <div>
      <div
        className={cn(
          'rounded-2xl border px-5 py-6 text-center',
          passed ? 'border-accent bg-accent-soft' : 'border-line bg-cloud',
        )}
      >
        <p
          className={cn(
            'font-display text-[34px] leading-none',
            passed ? 'text-accent-deep' : 'text-ink',
          )}
        >
          {result.correct} / {result.total}
        </p>
        <div className="mt-2 flex justify-center text-[16px] leading-none tracking-[0.16em]">
          {Array.from({ length: result.total }, (_, index) => (
            <span key={index} style={{ color: index < result.stars ? STAR_GOLD : STAR_EMPTY }}>
              ★
            </span>
          ))}
        </div>
        <p
          className={cn(
            'mt-3 text-[14px] font-semibold',
            passed ? 'text-accent-deep' : 'text-ink',
          )}
        >
          {passed ? 'Félicitations !' : `${result.stars} étoile${result.stars > 1 ? 's' : ''} · À refaire`}
        </p>
        <p className="mt-1 text-[12px] text-mute">
          {passed
            ? level < result.totalLevels
              ? `Niveau ${level + 1} débloqué.`
              : 'Chapitre terminé ! Tu peux rejouer n’importe quel niveau pour réviser.'
            : `Il te manque ${missing} bonne${missing > 1 ? 's' : ''} réponse${missing > 1 ? 's' : ''} pour débloquer le niveau ${level + 1}.`}
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {questions.map((question, position) => {
          const given = answers[question.id] ?? []
          const isCorrect = question.correctAnswers.every((value) => given.includes(value))
          const letters = answerLetters.filter((letter) => question.options[letter]?.trim())
          const givenText = given.length
            ? given.map((letter) => optionText(question, letter)).filter(Boolean).join(', ')
            : 'Aucune réponse'
          const correctText = question.correctAnswers
            .map((letter) => optionText(question, letter))
            .filter(Boolean)
            .join(', ')
          return (
            <div
              key={question.id}
              className={cn(
                'rounded-xl border border-line border-l-2 bg-surface p-4',
                isCorrect ? 'border-l-success' : 'border-l-sale',
              )}
            >
              <div className="flex items-start gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cloud text-[11px] font-semibold text-mute">
                  {position + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-snug text-ink">
                    {question.statement}
                  </p>
                  <p
                    className={cn(
                      'mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed',
                      isCorrect ? 'text-success' : 'text-sale',
                    )}
                  >
                    {isCorrect ? (
                      <Check size={13} className="mt-0.5 shrink-0" />
                    ) : (
                      <X size={13} className="mt-0.5 shrink-0" />
                    )}
                    <span>
                      Ta réponse : {givenText}
                      {!isCorrect && given.length < letters.length ? ' (partielle)' : ''}
                    </span>
                  </p>
                  <p className="mt-1 flex items-start gap-1.5 text-[12px] leading-relaxed text-success">
                    <Check size={13} className="mt-0.5 shrink-0" />
                    <span>Bonne réponse : {correctText}</span>
                  </p>
                  {question.explanation ? (
                    <p className="mt-2 border-t border-dashed border-line pt-2 text-[12px] leading-relaxed text-mute">
                      {question.explanation}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          to={`/app/medgame/${chapterId}/niveau/${level}`}
          className="rounded-xl bg-accent px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-accent-deep"
        >
          Rejouer le niveau
        </Link>
        <Link
          to={`/app/medgame/${chapterId}`}
          className="text-[12px] font-medium text-accent hover:underline"
        >
          Carte des niveaux
        </Link>
      </div>
    </div>
  )
}
