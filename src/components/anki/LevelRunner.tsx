import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { answerLetters, cn } from '@/lib/utils'
import { chapterTitle, findThemeForChapter } from '@/lib/themes'
import type { AnkiLevelAnswer, Question } from '@/types'

/**
 * Un niveau : 5 questions tirées au hasard dans le chapitre, répondues sans
 * correction, puis une seule submission. C'est le même rythme que les séries
 * de 30 questions : on répond aux 5, puis on soumet.
 */
export function LevelRunner({
  chapterId,
  level,
  onExit,
}: {
  chapterId: string
  level: number
  onExit: () => void
}) {
  const navigate = useNavigate()
  const theme = findThemeForChapter(chapterId)
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await api.getAnkiLevelQuestions(chapterId, level)
      setQuestions(list)
      setIndex(0)
      setAnswers({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger ce niveau.')
    } finally {
      setLoading(false)
    }
  }, [chapterId, level])

  useEffect(() => {
    void load()
  }, [load])

  const question = questions[index]
  const answeredCount = Object.keys(answers).length
  const allAnswered = questions.length > 0 && answeredCount === questions.length

  const choose = (letter: string) => {
    if (!question) return
    setAnswers((current) => ({ ...current, [question.id]: [letter] }))
    if (index < questions.length - 1) setIndex(index + 1)
  }

  const submit = async () => {
    if (!allAnswered || saving) return
    setSaving(true)
    setError(null)
    const payload: AnkiLevelAnswer[] = questions.map((item) => ({
      questionId: item.id,
      given: answers[item.id] ?? [],
    }))
    try {
      const result = await api.recordAnkiLevel({ chapterId, level, answers: payload })
      navigate(`/app/medgame/${chapterId}/niveau/${level}/bilan`, {
        state: { result, questions, answers },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible. Réessaie.')
    } finally {
      setSaving(false)
    }
  }

  const leave = () => {
    if (answeredCount > 0 && !window.confirm('Tu quittes le niveau ? Tes réponses ne seront pas enregistrées.')) {
      return
    }
    onExit()
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center text-[13px] text-mute">
        Préparation du niveau…
      </div>
    )
  }

  if (!question) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-[13px] text-mute">
          Ce chapitre n'a pas assez de questions pour ouvrir un niveau.
        </p>
        <button
          type="button"
          onClick={leave}
          className="mt-4 text-[12px] font-medium text-accent hover:underline"
        >
          Retour à la carte des niveaux
        </button>
      </div>
    )
  }

  const letters = answerLetters.filter((letter) => question.options[letter]?.trim())

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={leave}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-mute hover:text-accent"
        >
          <ArrowLeft size={14} /> Carte des niveaux
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent">
          Niveau {level}
        </span>
      </div>

      <div className="mt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
          {theme?.title ?? 'MEDGAME'}
        </p>
        <h1 className="mt-1 font-display text-[24px] tracking-[-0.02em] text-ink">
          {chapterTitle(chapterId)}
        </h1>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cloud">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${((index + 1) / questions.length) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] text-mute">
            Question {index + 1} sur {questions.length}
          </span>
        </div>
        <div className="mt-2 flex gap-1.5">
          {questions.map((item, position) => (
            <span
              key={item.id}
              className={cn(
                'h-1.5 flex-1 rounded-full transition',
                answers[item.id] ? 'bg-accent' : 'bg-cloud',
                position === index && !answers[item.id] && 'bg-accent/40',
              )}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-sale/25 bg-sale/5 px-4 py-3 text-[13px] text-sale">
          {error}
        </div>
      )}

      <article className="mt-5 rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <p className="text-[15px] leading-relaxed text-ink sm:text-[16px]">{question.statement}</p>

        <div className="mt-5 space-y-2.5">
          {letters.map((letter) => {
            const selected = answers[question.id]?.includes(letter)
            return (
              <button
                key={letter}
                type="button"
                onClick={() => choose(letter)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-[13px] leading-relaxed transition',
                  'border-line bg-canvas text-ink hover:border-accent/60',
                  selected && 'border-accent bg-accent-soft',
                )}
              >
                <span
                  className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold',
                    selected ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-mute',
                  )}
                >
                  {selected ? <Check size={13} /> : letter}
                </span>
                <span>{question.options[letter]}</span>
              </button>
            )
          })}
        </div>
      </article>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-mute">
          {answeredCount} / {questions.length} questions répondues
        </p>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!allAnswered || saving}
          className={cn(
            'rounded-xl px-5 py-3 text-[13px] font-semibold transition',
            allAnswered && !saving
              ? 'bg-accent text-white hover:bg-accent-deep'
              : 'cursor-not-allowed bg-cloud text-mute',
          )}
        >
          {saving ? 'Envoi…' : 'Soumettre le niveau'}
        </button>
      </div>
    </div>
  )
}
