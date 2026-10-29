import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Download, RotateCcw, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import type { AttemptReview } from '@/lib/supabaseData'
import { ButtonLink } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import { answerLetters, cn, formatDateTime, scoreTone } from '@/lib/utils'

export default function ResultPage() {
  usePageTitle('Résultat de la série — MEDQCM L1')
  const { attemptId } = useParams<{ attemptId: string }>()
  const { user, db } = useAuth()

  const [review, setReview] = useState<AttemptReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!attemptId) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setLoadError('')
    api
      .getAttemptReview(attemptId)
      .then((result) => {
        if (active) setReview(result)
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Ce résultat est introuvable.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [attemptId])

  const attempt = review?.attempt
  const ownsAttempt = attempt && userIdMatches(attempt.userId, user?.id)
  const subject = attempt ? db.subjects.find((item) => item.id === attempt.subjectId) : undefined
  const questions = review?.questions ?? []

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-content flex-col justify-center px-5 py-16 sm:px-8 lg:px-10">
        <p className="text-[12px] text-mute">Correction en cours</p>
        <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] text-ink">
          Votre résultat se prépare.
        </h1>
        <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-mute">
          Les réponses et les explications sont vérifiées côté serveur.
        </p>
      </div>
    )
  }

  if (!attempt || !ownsAttempt) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-content flex-col justify-center px-5 py-16 sm:px-8 lg:px-10">
        <h1 className="font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] text-ink">
          Ce résultat n’est pas disponible.
        </h1>
        <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-mute">
          {loadError || 'La série demandée n’existe pas ou n’appartient pas à votre compte.'}
        </p>
        <ButtonLink to="/app" className="mt-6">
          Retour à mon cycle
        </ButtonLink>
      </div>
    )
  }

  const total = attempt.total
  const score = attempt.score
  const unanswered = attempt.questionIds.filter((id) => !(attempt.answers[id] ?? []).length).length
  const incorrect = Math.max(0, total - score - unanswered)
  const percent = total ? Math.round((score / total) * 100) : 0
  const verdict = capitalize(scoreTone(score, total))
  const message =
    percent >= 80
      ? 'Maîtrise solide. Continuez à consolider les détails.'
      : percent >= 60
        ? 'De bonnes bases. Le corrigé va préciser les points fragiles.'
        : percent >= 40
          ? 'Les notions clés sont là, mais elles doivent être stabilisées.'
          : 'Ce score est un point de départ. Reprenez les explications une par une.'

  const exportResult = () => {
    const rows: string[][] = [
      ['MEDQCM — résultat de série'],
      ['Étudiant', user ? `${user.firstName} ${user.lastName}` : ''],
      ['Thème', subject?.title ?? 'Thème de QCM'],
      ['Date', new Date(attempt.createdAt).toLocaleString('fr-FR')],
      ['Score', `${score} / ${total}`, `${percent} %`],
      ['Correctes', String(score), 'Incorrectes', String(incorrect), 'Sans réponse', String(unanswered)],
      [],
      ['N°', 'Matière', 'Énoncé', 'Votre réponse', 'Réponse attendue', 'Résultat', 'Explication'],
      ...questions.map((question, index) => {
        const given = attempt.answers[question.id] ?? []
        const correct = sameLetters(given, question.correctAnswers)
        return [
          String(index + 1),
          question.matiere,
          question.statement,
          given.length ? given.join(', ') : 'Sans réponse',
          question.correctAnswers.join(', '),
          given.length === 0 ? 'Sans réponse' : correct ? 'Juste' : 'À revoir',
          question.explanation,
        ]
      }),
    ]
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `resultat-medqcm-${new Date(attempt.createdAt).toISOString().slice(0, 10)}.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="bg-canvas">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 px-5 py-3 text-[12px] sm:px-8 lg:px-10">
          <Link to="/app" className="inline-flex items-center gap-2 text-mute transition hover:text-accent">
            <ArrowLeft size={14} /> Mon cycle
          </Link>
          <span className="text-mute">Résultat de la série</span>
          <Link to="/app#series" className="text-mute transition hover:text-accent">
            Mes séries
          </Link>
        </div>
      </div>

      <section className="mx-auto max-w-content px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_260px] lg:items-end lg:p-10">
            <div>
              <p className="text-[12px] text-mute">
                {subject?.monthLabel ?? 'Thème de QCM'} · {formatDateTime(attempt.createdAt)}
              </p>
              <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.8rem)] leading-[1.02] tracking-[-0.03em] text-ink">
                {verdict}.
              </h1>
              <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-mute">{message}</p>
            </div>
            <div className="lg:text-right">
              <p className="text-[11px] text-mute">Score final</p>
              <p className="mt-1 flex items-baseline gap-1 lg:justify-end" aria-label={`${score} sur ${total}`}>
                <span className="font-display text-[clamp(4rem,9vw,5.6rem)] leading-none text-accent">
                  {score}
                </span>
                <span className="text-[18px] text-mute">/{total}</span>
              </p>
              <p className="mt-2 text-[11px] text-mute">{percent} % de réussite</p>
            </div>
          </div>

          <div className="grid grid-cols-3 border-t border-line">
            {[
              ['Correctes', score, 'text-success'],
              ['Incorrectes', incorrect, 'text-sale'],
              ['Sans réponse', unanswered, 'text-mute'],
            ].map(([label, value, tone], index) => (
              <div key={label} className={`px-5 py-4 sm:px-8 ${index > 0 ? 'border-l border-line' : ''}`}>
                <p className="text-[10px] text-mute">{label}</p>
                <p className={`mt-1 text-[18px] font-medium tabular-nums ${tone}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <ButtonLink to={`/app/entrainement?theme=${encodeURIComponent(attempt.subjectId)}`} size="lg">
            <RotateCcw size={15} /> Refaire une série
          </ButtonLink>
          <Link to="/app" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-deep">
            Retour au cycle <ArrowRight size={14} />
          </Link>
          <button
            type="button"
            onClick={exportResult}
            className="ml-auto inline-flex items-center gap-2 text-[12px] text-mute transition hover:text-accent"
          >
            <Download size={14} /> Télécharger le résultat
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-content px-5 pb-16 sm:px-8 lg:px-10">
        <div className="border-b border-line pb-4">
          <h2 className="text-[18px] font-medium text-ink">Corrigé détaillé</h2>
          <p className="mt-1 text-[12px] text-mute">
            {subject?.title ?? 'Thème de QCM'} · {total} questions · chaque question compte un point.
          </p>
        </div>

        {questions.map((question, questionIndex) => {
          const given = attempt.answers[question.id] ?? []
          const isCorrect = sameLetters(given, question.correctAnswers)
          const isBlank = given.length === 0
          return (
            <article key={question.id} className="border-b border-line py-7 sm:py-9">
              <div className="flex flex-wrap items-center gap-2.5">
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

              <h3 className="mt-3 max-w-3xl text-[16px] font-medium leading-relaxed text-ink">
                {question.statement}
              </h3>

              <div className="mt-4 max-w-3xl overflow-hidden rounded-lg border border-line">
                {answerLetters.filter((letter) => question.options[letter]?.trim()).map((letter) => {
                  const isExpected = question.correctAnswers.includes(letter)
                  const isGiven = given.includes(letter)
                  return (
                    <div
                      key={letter}
                      className={cn(
                        'flex items-start gap-3 border-b border-line px-3.5 py-3 last:border-b-0',
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

              <div className="mt-4 max-w-3xl rounded-lg bg-cloud px-4 py-4">
                <p className="text-[11px] font-medium text-ink">Explication</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ash">{question.explanation}</p>
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function sameLetters(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((letter, index) => letter === right[index])
}

function userIdMatches(a: string, b?: string) {
  return Boolean(b) && a === b
}
