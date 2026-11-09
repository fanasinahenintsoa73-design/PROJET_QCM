import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Lightbulb,
  SkipForward,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { buttonClasses } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import { chapterTitle, findThemeForChapter } from '@/lib/themes'
import { answerLetters, cn } from '@/lib/utils'
import type { Question } from '@/types'

export default function AnkiQuizPage() {
  const { chapterId = '' } = useParams()
  const [searchParams] = useSearchParams()
  usePageTitle(`${chapterTitle(chapterId)} — Anki — MEDQCM mada`)

  const theme = findThemeForChapter(chapterId)
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [result, setResult] = useState<'correct' | 'wrong' | 'revealed' | null>(null)
  const [level, setLevel] = useState(1)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadQuestions = useCallback(async () => {
    setLoading(true)
    try {
      if (searchParams.get('replay') === '1') {
        await api.restartAnkiChapter(chapterId)
      }
      const [nextQuestions, states] = await Promise.all([
        api.getAnkiQuestions(chapterId),
        api.getAnkiChapters(),
      ])
      const state = states.find((candidate) => candidate.chapterId === chapterId)
      setLevel(state?.level ?? 1)
      setQuestions(nextQuestions)
      setIndex(0)
      setSelected(null)
      setResult(null)
      setCompleted(nextQuestions.length === 0)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les questions Anki.')
    } finally {
      setLoading(false)
    }
  }, [chapterId, searchParams])

  useEffect(() => {
    void loadQuestions()
  }, [loadQuestions])

  const question = questions[index]
  const options = question
    ? answerLetters.filter((letter) => Boolean(question.options[letter]))
    : []
  const correctAnswers = question?.correctAnswers ?? []

  const nextQuestion = useCallback(async () => {
    if (index + 1 < questions.length) {
      setIndex((value) => value + 1)
      setSelected(null)
      setResult(null)
      return
    }
    await loadQuestions()
  }, [index, questions.length, loadQuestions])

  // Une bonne réponse affiche le vert et attend le bouton Suivant.
  async function submitAnswer(letter: string) {
    if (!question || result || saving) return
    const isCorrect = correctAnswers.length === 1 && correctAnswers[0] === letter
    setSelected(letter)
    if (!isCorrect) {
      setResult('wrong')
      return
    }
    setSaving(true)
    try {
      const answer = await api.recordAnkiAnswer({
        chapterId,
        questionId: question.id,
        givenAnswers: [letter],
        status: 'correct',
        canReturn: false,
      })
      setLevel(answer.level)
      setCompleted(answer.completed)
      setResult('correct')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La réponse n’a pas pu être enregistrée.')
    } finally {
      setSaving(false)
    }
  }

  async function revealAnswer() {
    if (!question || result || saving) return
    setResult('revealed')
  }

  async function chooseNext() {
    if (!question || saving) return
    if (result === 'correct') {
      await nextQuestion()
      return
    }
    if (result !== 'wrong' && result !== 'revealed') return
    setSaving(true)
    try {
      const answer = await api.recordAnkiAnswer({
        chapterId,
        questionId: question.id,
        givenAnswers: result === 'wrong' && selected ? [selected] : [],
        status: result,
        canReturn: true,
      })
      setLevel(answer.level)
      setCompleted(answer.completed)
      if (answer.completed) {
        setSelected(null)
        setResult(null)
        return
      }
      await nextQuestion()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La réponse n’a pas pu être enregistrée.')
    } finally {
      setSaving(false)
    }
  }

  async function chooseIgnore() {
    if (!question || saving) return
    setSaving(true)
    try {
      const status = result === 'wrong' || result === 'revealed' ? result : 'skipped'
      const answer = await api.recordAnkiAnswer({
        chapterId,
        questionId: question.id,
        givenAnswers: status === 'wrong' && selected ? [selected] : [],
        status,
        canReturn: false,
      })
      setLevel(answer.level)
      setCompleted(answer.completed)
      if (answer.completed || index + 1 >= questions.length) {
        if (answer.completed) {
          setSelected(null)
          setResult(null)
          return
        }
        await loadQuestions()
      } else {
        setIndex((value) => value + 1)
        setSelected(null)
        setResult(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La question n’a pas pu être ignorée.')
    } finally {
      setSaving(false)
    }
  }

  async function skipQuestion() {
    await chooseIgnore()
  }

  async function restartChapter() {
    if (saving) return
    setSaving(true)
    try {
      await api.restartAnkiChapter(chapterId)
      setCompleted(false)
      await loadQuestions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Le chapitre n’a pas pu être recommencé.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-content items-center justify-center px-5">
        <div className="text-center">
          <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="mt-4 text-sm text-mute">Préparation des questions…</p>
        </div>
      </div>
    )
  }

  if (completed || questions.length === 0) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center justify-center px-5 py-12">
        <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-7 text-center sm:p-10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/10 text-success">
            <Trophy size={26} />
          </span>
          <h1 className="mt-5 font-display text-[clamp(1.8rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.03em] text-ink">
            Félicitations, vous avez terminé le chapitre
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-mute">
            Ton niveau est {level}. Tu peux refaire ce chapitre pendant toute la durée du ticket pour bien mémoriser.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button type="button" onClick={() => void restartChapter()} disabled={saving} className={buttonClasses('primary')}>
              Refaire le chapitre <ArrowRight size={16} />
            </button>
            <Link to="/app" className={buttonClasses('secondary')}>
              Retour au tableau de bord
            </Link>
            <Link to="/app" className={buttonClasses('secondary')}>
              Voir l’historique
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-mute hover:text-accent"
          >
            <ArrowLeft size={14} /> Retour au mode Anki
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent">
            <Sparkles size={12} /> Niveau {level}
          </span>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
            {theme?.title ?? 'Anki'}
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
              Question {index + 1} / {questions.length}
            </span>
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
            {options.map((letter) => {
              const isSelected = selected === letter
              const isCorrect = correctAnswers.includes(letter)
              const showCorrect = Boolean(result) && isCorrect
              const showWrong = result === 'wrong' && isSelected && !isCorrect
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => void submitAnswer(letter)}
                  disabled={Boolean(result) || saving}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-[13px] leading-relaxed transition',
                    'border-line bg-canvas text-ink hover:border-accent/60',
                    isSelected && !result && 'border-accent bg-accent-soft',
                    showCorrect && 'border-success bg-success/10 text-ink',
                    showWrong && 'border-sale bg-sale/10 text-ink',
                    (Boolean(result) || saving) && 'cursor-default',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold',
                      showCorrect && 'border-success bg-success text-white',
                      showWrong && 'border-sale bg-sale text-white',
                      !showCorrect && !showWrong && 'border-line bg-surface text-mute',
                    )}
                  >
                    {showCorrect ? <Check size={13} /> : showWrong ? <X size={13} /> : letter}
                  </span>
                  <span>{question.options[letter]}</span>
                </button>
              )
            })}
          </div>

          {result && (
            <div
              className={cn(
                'mt-5 rounded-xl border px-4 py-3.5',
                result === 'correct'
                  ? 'border-success/25 bg-success/5'
                  : result === 'wrong'
                    ? 'border-sale/25 bg-sale/5'
                    : 'border-accent/25 bg-accent-soft/50',
              )}
            >
              <p
                className={cn(
                  'flex items-center gap-2 text-[13px] font-semibold',
                  result === 'correct'
                    ? 'text-success'
                    : result === 'wrong'
                      ? 'text-sale'
                      : 'text-accent',
                )}
              >
                {result === 'correct' ? (
                  <>
                    <Check size={15} /> Bonne réponse !
                  </>
                ) : result === 'wrong' ? (
                  <>
                    <X size={15} /> Réponse incorrecte
                  </>
                ) : (
                  <>
                    <Eye size={15} /> Réponse affichée
                  </>
                )}
              </p>
              <p className="mt-2 text-[13px] text-ink">
                Bonne réponse :{' '}
                <strong className="font-semibold text-success">
                  {correctAnswers.join(', ')}
                </strong>
              </p>
              {question.explanation && (
                <p className="mt-2 flex items-start gap-2 text-[12px] leading-relaxed text-mute">
                  <Lightbulb size={14} className="mt-0.5 shrink-0 text-accent" />
                  <span>{question.explanation}</span>
                </p>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5 border-t border-line pt-4">
            <div className="flex flex-wrap gap-2">
              {!result && (
                <>
                  <button
                    type="button"
                    onClick={() => void revealAnswer()}
                    disabled={saving}
                    className={buttonClasses('secondary', 'sm')}
                  >
                    <Eye size={14} /> Afficher la réponse
                  </button>
                  <button
                    type="button"
                    onClick={() => void skipQuestion()}
                    disabled={saving}
                    className={buttonClasses('ghost', 'sm')}
                  >
                    <SkipForward size={14} /> Ignorer
                  </button>
                </>
              )}
            </div>
            {result && (
              <>
                {result === 'wrong' || result === 'revealed' ? (
                  <button
                    type="button"
                    onClick={() => void chooseIgnore()}
                    disabled={saving}
                    className={buttonClasses('ghost', 'sm')}
                  >
                    <SkipForward size={14} /> Ignorer
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void chooseNext()}
                  disabled={saving}
                  className={buttonClasses('primary', 'sm')}
                >
                  Suivant <ArrowRight size={14} />
                </button>
              </>
            )}
            {result === 'correct' && (
              <span className="text-[11px] text-mute">Passage automatique…</span>
            )}
          </div>
        </article>
      </div>
    </div>
  )
}
