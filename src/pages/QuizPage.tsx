import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Clock3, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getActiveAssignment, getSubjectQuestions, saveAttempt } from '@/lib/db'
import { randomQuestionIds } from '@/lib/seed'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { usePageTitle } from '@/components/Layouts'
import {
  answerLetters,
  cn,
  isExpired,
  sameAnswer,
  timeLeft,
  type AnswerLetter,
} from '@/lib/utils'
import type { Question } from '@/types'

export default function QuizPage() {
  usePageTitle('Série de 20 QCM')
  const navigate = useNavigate()
  const { user, db } = useAuth()

  const assignment = user ? getActiveAssignment(user.id, db) : undefined
  const subject = assignment
    ? db.subjects.find((candidate) => candidate.id === assignment.subjectId)
    : undefined
  const bank = subject ? getSubjectQuestions(subject.id, db) : []

  const [questions] = useState<Question[]>(() => {
    if (!subject) return []
    const byId = new Map(bank.map((question) => [question.id, question]))
    return randomQuestionIds(bank, 20)
      .map((id) => byId.get(id))
      .filter((question): question is Question => Boolean(question))
  })
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [blocked, setBlocked] = useState(!assignment || !subject || isExpired(assignment.expiresAt))
  const [saving, setSaving] = useState(false)
  const finished = useRef(false)

  const current = questions[index]
  const selected = current ? answers[current.id] ?? [] : []
  const answeredCount = Object.values(answers).filter((letters) => letters.length > 0).length
  const isLast = index === questions.length - 1

  /* Live expiration engine: the quiz is interrupted as soon as the month ends. */
  useEffect(() => {
    const check = () => {
      if (isExpired(user?.expiresAt)) {
        navigate('/expiration', { replace: true })
        return
      }
      if (!assignment || !subject || isExpired(assignment.expiresAt)) {
        setBlocked(true)
      }
    }

    check()
    const interval = window.setInterval(check, 15_000)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [assignment, navigate, subject, user?.expiresAt])

  const toggleAnswer = (letter: AnswerLetter) => {
    if (!current) return
    setAnswers((previous) => {
      const existing = previous[current.id] ?? []
      const next = existing.includes(letter)
        ? existing.filter((item) => item !== letter)
        : [...existing, letter].sort()
      return { ...previous, [current.id]: next }
    })
  }

  const canContinue = () => {
    if (isExpired(user?.expiresAt)) {
      navigate('/expiration', { replace: true })
      return false
    }
    if (!assignment || !subject || isExpired(assignment.expiresAt)) {
      setBlocked(true)
      return false
    }
    return true
  }

  const goNext = () => {
    if (!canContinue()) return
    if (!isLast) {
      setIndex((value) => value + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (saving || !subject || !user || finished.current) return
    setSaving(true)
    finished.current = true

    const score = questions.reduce((total, question) => {
      const given = answers[question.id] ?? []
      return total + (sameAnswer(given, question.correctAnswers) ? 1 : 0)
    }, 0)

    const attempt = saveAttempt({
      userId: user.id,
      subjectId: subject.id,
      questionIds: questions.map((question) => question.id),
      answers,
      score,
    })
    navigate(`/app/resultat/${attempt.id}`, { replace: true })
  }

  const quit = () => {
    if (
      answeredCount > 0 &&
      !window.confirm('Quitter cette série ? Vos réponses ne seront pas enregistrées.')
    ) {
      return
    }
    navigate('/app')
  }

  if (blocked) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-content flex-col justify-center px-5 py-16 sm:px-8 lg:px-12">
        <p className="eyebrow">Série interrompue</p>
        <h1 className="display mt-5 max-w-3xl text-[clamp(3rem,7vw,5rem)]">
          Le cycle est terminé.
        </h1>
        <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-mute">
          La période de 30 jours associée à ce sujet est terminée. Aucune nouvelle question ne
          peut être chargée.
        </p>
        <ButtonLink to="/app" variant="primary" className="mt-7">
          Retour au tableau de bord
        </ButtonLink>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-content flex-col justify-center px-5 py-16 sm:px-8 lg:px-12">
        <p className="eyebrow">Banque vide</p>
        <h1 className="display mt-5 max-w-3xl text-[clamp(3rem,7vw,5rem)]">
          Aucune question à afficher.
        </h1>
        <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-mute">
          Le sujet qui vous a été attribué ne contient pas encore de questions. Contactez votre
          docteur.
        </p>
        <ButtonLink to="/app" variant="primary" className="mt-7">
          Retour au tableau de bord
        </ButtonLink>
      </div>
    )
  }

  return (
    <div className="bg-canvas">
      {/* Quiz progress bar */}
      <div className="border-b border-hairline-soft">
        <div className="mx-auto max-w-content px-5 pb-4 pt-4 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={quit}
              className="inline-flex items-center gap-2 py-2 text-[12px] font-medium text-mute transition-colors hover:text-ink"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Quitter
            </button>
            <p className="text-[11px] uppercase tracking-[0.18em] text-mute">
              Question <span className="text-ink">{String(index + 1).padStart(2, '0')}</span>
              <span className="text-stone"> / {String(questions.length).padStart(2, '0')}</span>
            </p>
            <p className="hidden items-center gap-1.5 text-[11px] text-mute sm:flex">
              <Clock3 className="size-3.5" aria-hidden="true" />
              {timeLeft(user?.expiresAt)} restants
            </p>
            <p className="text-[11px] text-mute sm:hidden">{timeLeft(user?.expiresAt)}</p>
          </div>
          <ProgressBar
            value={((index + 1) / questions.length) * 100}
            className="mt-3 h-[2px]"
          />
        </div>
      </div>

      <div className="mx-auto max-w-[920px] px-5 py-9 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="eyebrow">
            Question {String(questionNumber(current)).padStart(2, '0')}
          </span>
          <span className="h-px w-6 bg-hairline" aria-hidden="true" />
          <span className="text-[10px] uppercase tracking-[0.16em] text-mute">
            {current.matiere}
          </span>
          <span className="ml-auto border border-hairline px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-mute">
            Une ou plusieurs réponses
          </span>
        </div>

        <h1 className="mt-5 max-w-[760px] text-[clamp(1.35rem,2.6vw,1.85rem)] font-medium leading-[1.35] tracking-[-0.01em] text-ink">
          {current.statement}
        </h1>

        <div className="mt-8 border-t border-hairline" role="group" aria-label="Réponses possibles">
          {answerLetters.map((letter) => {
            const active = selected.includes(letter)
            return (
              <button
                key={letter}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => toggleAnswer(letter)}
                className={cn(
                  'group flex w-full items-start gap-4 border-b border-hairline py-5 text-left transition-colors sm:gap-5 sm:px-3',
                  active ? 'bg-cloud' : 'hover:bg-cloud/60',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 grid size-9 shrink-0 place-items-center border text-[13px] font-medium transition-colors',
                    active
                      ? 'border-ink bg-ink text-white'
                      : 'border-hairline bg-canvas text-ash group-hover:border-stone',
                  )}
                >
                  {letter}
                </span>
                <span className="flex-1 text-[14.5px] leading-relaxed text-charcoal sm:text-[15px]">
                  {current.options[letter]}
                </span>
                <span
                  className={cn(
                    'mt-1 grid size-5 shrink-0 place-items-center border transition-colors',
                    active ? 'border-ink bg-ink text-white' : 'border-hairline text-transparent',
                  )}
                  aria-hidden="true"
                >
                  <Check className="size-3" strokeWidth={2.5} />
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => {
                if (index === 0) {
                  quit()
                  return
                }
                setIndex((value) => value - 1)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              disabled={index === 0}
              className="inline-flex items-center gap-2 py-2 text-[13px] font-medium text-mute transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Question précédente
            </button>
            <p className="mt-1 text-[11px] text-stone">
              {answeredCount} réponse{answeredCount > 1 ? 's' : ''} sur {questions.length}
            </p>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={goNext}
            disabled={selected.length === 0 || saving}
            loading={saving}
            className="group min-w-[200px] gap-3"
          >
            {isLast ? 'Terminer la série' : 'Question suivante'}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>

        <div className="mt-8 flex items-start gap-2.5 border-t border-hairline-soft pt-5 text-[11px] leading-relaxed text-mute">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <p>
            Votre score et le corrigé détaillé s’affichent à la fin de la série. Vous pouvez
            revenir sur une question avant de terminer. L’accès se coupe automatiquement à la
            fin de votre mois.
          </p>
        </div>
      </div>
    </div>
  )
}

function questionNumber(question: Question) {
  return question.number
}
