import { Link } from 'react-router-dom'
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
    <article className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-7">
        <h1 className="font-display text-[22px] tracking-[-0.02em] text-ink">
          Niveau {level}
        </h1>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">
          Bilan
        </span>
      </header>

      <div className="px-5 py-5 sm:px-7 sm:py-6">
        <div
          className={cn(
            'rounded-2xl border px-5 py-6 text-center',
            passed ? 'border-accent bg-accent-soft' : 'border-line bg-cloud',
          )}
        >
          <p
            className={cn(
              'font-display text-[36px] leading-none',
              passed ? 'text-accent-deep' : 'text-ink',
            )}
          >
            {result.correct} / {result.total}
          </p>
          <div className="mt-3 flex justify-center text-[18px] leading-none tracking-[0.18em]">
            {Array.from({ length: result.total }, (_, index) => (
              <span key={index} style={{ color: index < result.stars ? STAR_GOLD : STAR_EMPTY }}>
                ★
              </span>
            ))}
          </div>
          <p
            className={cn(
              'mt-3 text-[13px] leading-relaxed',
              passed ? 'text-accent-deep' : 'text-ink',
            )}
          >
            {passed
              ? level < result.totalLevels
                ? `Félicitations ! Niveau ${level + 1} débloqué`
                : 'Félicitations ! Chapitre terminé'
              : `${result.stars} étoile${result.stars > 1 ? 's' : ''} · À refaire`}
          </p>
          {!passed ? (
            <p className="mt-1 text-[12px] leading-relaxed text-mute">
              Il te manque {missing} bonne{missing > 1 ? 's' : ''} réponse
              {missing > 1 ? 's' : ''} pour débloquer le niveau {level + 1}.
            </p>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          {questions.map((question) => {
            const given = answers[question.id] ?? []
            const isCorrect = question.correctAnswers.every((value) => given.includes(value))
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
                  'rounded-xl border border-line bg-surface p-4',
                  isCorrect ? 'border-l-[3px] border-l-success' : 'border-l-[3px] border-l-sale',
                )}
              >
                <p className="text-[13px] font-semibold leading-snug text-ink">
                  {question.statement}
                </p>
                <div className="mt-3 grid grid-cols-[92px_1fr] gap-x-4 gap-y-2">
                  <span className="text-[12px] text-mute">Ta réponse</span>
                  <span
                    className={cn(
                      'text-[13px] font-medium leading-relaxed',
                      isCorrect ? 'text-success' : 'text-sale',
                    )}
                  >
                    {givenText}
                    {isCorrect ? ' — juste' : ' — faux'}
                  </span>
                  <span className="text-[12px] text-mute">Réponse</span>
                  <span className="text-[13px] font-medium leading-relaxed text-success">
                    {correctText}
                  </span>
                </div>
                {question.explanation ? (
                  <p className="mt-3 border-t border-dashed border-line pt-2 text-[12px] leading-relaxed text-mute">
                    {question.explanation}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="mt-5 space-y-2.5">
          <Link
            to={`/app/medgame/${chapterId}/niveau/${level}`}
            className="block w-full rounded-xl bg-accent px-5 py-3.5 text-center text-[13px] font-semibold text-white transition hover:bg-accent-deep"
          >
            Rejouer le niveau
          </Link>
          <Link
            to={`/app/medgame/${chapterId}`}
            className="block w-full rounded-xl border border-accent px-5 py-3.5 text-center text-[13px] font-semibold text-accent transition hover:bg-accent hover:text-white"
          >
            Carte des niveaux
          </Link>
        </div>
      </div>
    </article>
  )
}
