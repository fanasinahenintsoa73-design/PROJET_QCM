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
  usePageTitle('Série en cours — MEDQCM L1')
  const navigate = useNavigate()
  const { user, db } = useAuth()

  const assignment = user ? getActiveAssignment(user.id, db) : undefined
  const subject = assignment
    ? db.subjects.find((candidate) => candidate.id === assignment.subjectId)
    : undefined
  const bank = subject ? getSubjectQuestions(subject.id, db) : []
  const planned = Math.min(20, bank.length)
  const [questions] = useState<Question[]>(() =>
    randomQuestionIds(bank, 20)
      .map((id) => bank.find((question) => question.id === id))
      .filter((question): question is Question => Boolean(question)),
  )
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [blocked, setBlocked] = useState(!assignment || !subject || isExpired(assignment.expiresAt))
  const [saving, setSaving] = useState(false)
  const finished = useRef(false)

  const current = questions[index]
  const selected = current ? answers[current.id] ?? [] : []
  const answeredCount = questions.filter((question) => (answers[question.id] ?? []).length > 0).length
  const isLast = index === questions.length - 1

  useEffect(() => {
    const check = () => {
      if (isExpired(user?.expiresAt)) {
        navigate('/expiration', { replace: true })
        return
      }
      if (!assignment || !subject || isExpired(assignment.expiresAt)) setBlocked(true)
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

  function toggleAnswer(letter: AnswerLetter) {
    if (!current) return
    setAnswers((previous) => {
      const existing = previous[current.id] ?? []
      const next = existing.includes(letter)
        ? existing.filter((value) => value !== letter)
        : [...existing, letter]
      return { ...previous, [current.id]: next.sort() }
    })
  }

  function canContinue() {
    if (isExpired(user?.expiresAt)) {
      setBlocked(true)
      return false
    }
    if (!assignment || !subject) {
      setBlocked(true)
      return false
    }
    return true
  }

  function goNext() {
    if (!isLast) {
      if (!canContinue()) return
      setIndex((value) => Math.min(value + 1, questions.length - 1))
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!canContinue() || !user || !assignment || !subject || saving || finished.current) return
    setSaving(true)
    finished.current = true
    const score = questions.reduce(
      (total, question) => total + (sameAnswer(answers[question.id] ?? [], question.correctAnswers) ? 1 : 0),
      0,
    )
    const attempt = saveAttempt({
      userId: user.id,
      subjectId: subject.id,
      questionIds: questions.map((question) => question.id),
      answers,
      score,
    })
    navigate(`/app/resultat/${attempt.id}`, { replace: true })
  }

  function quit() {
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
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-lg">
          <p className="text-[12px] text-mute">Série interrompue</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Le cycle est terminé.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">
            Votre accès n’est plus actif. Vos anciens résultats restent consultables dans
            l’historique.
          </p>
          <ButtonLink to="/app" className="mt-6">
            Retour au tableau de bord
          </ButtonLink>
        </div>
      </div>
    )
  }

  if (!current || questions.length === 0) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-lg">
          <p className="text-[12px] text-mute">Banque vide</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Aucune question à afficher.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">
            Le sujet n’a pas encore de questions publiées. Contactez votre docteur.
          </p>
          <ButtonLink to="/app" className="mt-6">
            Retour au tableau de bord
          </ButtonLink>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-68px)] bg-canvas">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-content px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={quit}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-mute transition hover:text-ink"
            >
              <ArrowLeft size={14} /> Quitter
            </button>
            <p className="text-[12px] tabular-nums text-mute">
              Question <span className="font-medium text-ink">{String(index + 1).padStart(2, '0')}</span>{' '}
              / {String(questions.length).padStart(2, '0')}
            </p>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-mute">
              <Clock3 size={13} /> {timeLeft(assignment?.expiresAt)}
            </span>
          </div>
          <ProgressBar
            value={((index + 1) / questions.length) * 100}
            className="mt-3 h-1"
            barClassName="bg-accent"
          />
        </div>
      </div>

      <div className="mx-auto max-w-[900px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-mute">
          <span className="font-medium text-ink">{current.matiere}</span>
          <span className="h-1 w-1 rounded-full bg-line" />
          <span>Une ou plusieurs réponses</span>
          <span className="ml-auto rounded-full bg-cloud px-2.5 py-1">
            {planned} questions au total
          </span>
        </div>

        <h1 className="mt-5 max-w-3xl font-display text-[clamp(1.7rem,3.2vw,2.35rem)] leading-[1.25] tracking-[-0.02em] text-ink">
          {current.statement}
        </h1>

        <div className="mt-7 space-y-2.5" role="group" aria-label="Réponses possibles">
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
                  'flex w-full items-start gap-3.5 rounded-xl border px-3.5 py-3.5 text-left transition',
                  active
                    ? 'border-accent bg-accent-soft'
                    : 'border-line bg-surface hover:border-accent/50 hover:bg-canvas',
                )}
              >
                <span
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-[12px] font-semibold',
                    active
                      ? 'border-accent bg-accent text-white'
                      : 'border-line bg-canvas text-mute',
                  )}
                >
                  {letter}
                </span>
                <span className="flex-1 pt-1 text-[14px] leading-relaxed text-ash">
                  {current.options[letter]}
                </span>
                <span
                  className={cn(
                    'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border transition',
                    active ? 'border-accent bg-accent text-white' : 'border-line bg-surface',
                  )}
                  aria-hidden
                >
                  {active && <Check size={12} strokeWidth={3} />}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={index === 0 ? quit : () => setIndex((value) => Math.max(0, value - 1))}
            disabled={index === 0}
            className="inline-flex h-10 items-center gap-1.5 text-[12px] font-medium text-mute transition hover:text-ink disabled:opacity-40"
          >
            <ArrowLeft size={14} /> {index === 0 ? 'Quitter la série' : 'Précédente'}
          </button>

          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
            <span className="text-center text-[11px] text-mute sm:text-right">
              {answeredCount} / {questions.length} répondues
            </span>
            <Button
              onClick={goNext}
              disabled={selected.length === 0 || saving}
              className="min-w-[172px]"
            >
              {isLast ? (saving ? 'Enregistrement…' : 'Terminer la série') : 'Question suivante'}
              {!isLast && <ArrowRight size={15} />}
            </Button>
          </div>
        </div>

        <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-mute">
          <ShieldCheck size={13} className="mt-0.5 shrink-0 text-accent" />
          La correction et les bonnes réponses apparaîtront uniquement après l’envoi de la série.
        </p>
      </div>
    </div>
  )
}
