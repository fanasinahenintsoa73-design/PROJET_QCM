import { Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { answerLetters, cn } from '@/lib/utils'
import type { AnkiLevelResult, Question } from '@/types'

const STAR_GOLD = '#B98A2E'
const STAR_EMPTY = '#DCE2DD'

/** La réponse est juste si elle contient exactement les bonnes lettres. */
function sameAnswers(given: string[], correct: string[]): boolean {
  return (
    given.length === correct.length && given.every((letter) => correct.includes(letter))
  )
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

        <div className="mt-6 border-b border-line pb-3">
          <h2 className="text-[16px] font-medium text-ink">Corrigé détaillé</h2>
          <p className="mt-1 text-[12px] text-mute">
            {questions.length} question{questions.length > 1 ? 's' : ''} · chaque question compte
            un point.
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {questions.map((question, questionIndex) => {
            const given = answers[question.id] ?? []
            const isBlank = given.length === 0
            const isCorrect = sameAnswers(given, question.correctAnswers)
            const letters = answerLetters.filter((letter) => question.options[letter]?.trim())

            return (
              <article
                key={question.id}
                className="overflow-hidden rounded-xl border border-line bg-surface"
              >
                <div className="border-b border-line px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-mute">
                      Question {String(questionIndex + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] text-stone">·</span>
                    <span className="text-[11px] text-mute">{question.matiere}</span>
                    <span
                      className={cn(
                        'ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium',
                        isBlank
                          ? 'bg-cloud text-mute'
                          : isCorrect
                            ? 'bg-accent-soft text-accent'
                            : 'bg-danger-soft text-sale',
                      )}
                    >
                      {isBlank ? (
                        'Sans réponse'
                      ) : isCorrect ? (
                        <>
                          <Check size={11} strokeWidth={2.5} /> Juste
                        </>
                      ) : (
                        <>
                          <X size={11} strokeWidth={2.5} /> À revoir
                        </>
                      )}
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] font-semibold leading-snug text-ink">
                    {question.statement}
                  </p>
                </div>

                <div className="px-4 py-3">
                  <div className="overflow-hidden rounded-lg border border-line">
                    {letters.map((letter) => {
                      const isExpected = question.correctAnswers.includes(letter)
                      const isGiven = given.includes(letter)
                      return (
                        <div
                          key={letter}
                          className={cn(
                            'flex items-start gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0',
                            isExpected && 'bg-accent-soft/60',
                            !isExpected && isGiven && 'bg-danger-soft/60',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded border text-[11px] font-medium',
                              isExpected
                                ? 'border-accent bg-accent text-white'
                                : isGiven
                                  ? 'border-sale bg-sale text-white'
                                  : 'border-line text-mute',
                            )}
                          >
                            {letter}
                          </span>
                          <span className="flex-1 text-[13px] leading-relaxed text-ash">
                            {question.options[letter]}
                          </span>
                          {isExpected && (
                            <span className="mt-0.5 shrink-0 text-[10px] font-medium text-accent">
                              Attendue
                            </span>
                          )}
                          {!isExpected && isGiven && (
                            <span className="mt-0.5 shrink-0 text-[10px] font-medium text-sale">
                              Votre réponse
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {question.explanation ? (
                    <div className="mt-3 rounded-lg bg-cloud px-4 py-3">
                      <p className="text-[11px] font-medium text-ink">Explication</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-ash">
                        {question.explanation}
                      </p>
                    </div>
                  ) : null}
                </div>
              </article>
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
