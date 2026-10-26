import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Download, RotateCcw, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getAttempt } from '@/lib/db'
import { ButtonLink } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import {
  answerLetters,
  cn,
  formatDateLong,
  formatDateTime,
  isExpired,
  scoreTone,
} from '@/lib/utils'

export default function ResultPage() {
  usePageTitle('Résultat de la série')
  const { attemptId } = useParams<{ attemptId: string }>()
  const navigate = useNavigate()
  const { user, db } = useAuth()

  const attempt = attemptId ? getAttempt(attemptId, db) : undefined
  const ownsAttempt = attempt && userIdMatches(attempt.userId, user?.id)
  const subject = attempt ? db.subjects.find((item) => item.id === attempt.subjectId) : undefined
  const questions = attempt
    ? attempt.questionIds
        .map((id) => db.questions.find((question) => question.id === id))
        .filter((question): question is NonNullable<typeof question> => Boolean(question))
    : []

  useEffect(() => {
    const check = () => {
      if (isExpired(user?.expiresAt)) navigate('/expiration', { replace: true })
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
  }, [navigate, user?.expiresAt])

  if (!attempt || !ownsAttempt) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-content flex-col justify-center px-5 py-16 sm:px-8 lg:px-12">
        <p className="eyebrow">Série introuvable</p>
        <h1 className="display mt-5 max-w-3xl text-[clamp(3rem,7vw,5rem)]">
          Ce résultat n’existe pas.
        </h1>
        <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-mute">
          La série demandée n’est pas disponible sur cet appareil ou n’appartient pas à votre
          compte.
        </p>
        <ButtonLink to="/app/historique" variant="primary" className="mt-7">
          Voir mon historique
        </ButtonLink>
      </div>
    )
  }

  const total = attempt.total
  const score = attempt.score
  const unanswered = attempt.questionIds.filter(
    (id) => !(attempt.answers[id] ?? []).length,
  ).length
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
      ['Sujet', subject?.title ?? 'Sujet de QCM'],
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
      <div className="border-b border-hairline-soft">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-[11px] sm:px-8 lg:px-12">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 text-mute transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Tableau de bord
          </Link>
          <span className="uppercase tracking-[0.18em] text-stone">Résultat de la série</span>
          <Link to="/app/historique" className="text-mute transition-colors hover:text-ink">
            Historique
          </Link>
        </div>
      </div>

      {/* Score */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-content px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
          <div className="grid items-end gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="eyebrow text-white/45">
                {subject?.monthLabel ?? 'Sujet de QCM'} · {formatDateTime(attempt.createdAt)}
              </p>
              <h1 className="display mt-5 text-[clamp(3.8rem,8vw,6.4rem)]">{verdict}.</h1>
              <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/55">
                {message}
              </p>
            </div>
            <div className="lg:col-span-5 lg:text-right">
              <p className="eyebrow text-white/45">Score final</p>
              <p className="mt-3 flex items-baseline gap-2 lg:justify-end" aria-label={`${score} sur ${total}`}>
                <span className="display text-[clamp(6rem,15vw,9.5rem)] leading-[0.75]">
                  {score}
                </span>
                <span className="text-[22px] font-light text-white/35">/{total}</span>
              </p>
              <p className="mt-4 text-[12px] text-white/55">
                {percent} % de réussite · 1 point par question juste
              </p>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-3 border-t border-white/15 pt-6">
            <div>
              <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
                <span className="size-1.5 bg-success-bright" aria-hidden="true" />
                Correctes
              </p>
              <p className="mt-2 text-[26px] font-light tabular-nums">{score}</p>
            </div>
            <div className="border-l border-white/15 pl-5 sm:pl-8">
              <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
                <span className="size-1.5 bg-sale" aria-hidden="true" />
                Incorrectes
              </p>
              <p className="mt-2 text-[26px] font-light tabular-nums">{incorrect}</p>
            </div>
            <div className="border-l border-white/15 pl-5 sm:pl-8">
              <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
                <span className="size-1.5 bg-white/30" aria-hidden="true" />
                Sans réponse
              </p>
              <p className="mt-2 text-[26px] font-light tabular-nums">{unanswered}</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <ButtonLink
              to="/app/entrainement"
              variant="white"
              size="lg"
              className="group gap-3"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Refaire une autre série
            </ButtonLink>
            <Link
              to="/app"
              className="inline-flex items-center gap-2 py-2 text-[13px] font-medium text-white/70 transition-colors hover:text-white"
            >
              Retour au tableau de bord
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Corrigé */}
      <section>
        <div className="mx-auto grid max-w-content gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-12 lg:gap-14 lg:px-12">
          <aside className="lg:col-span-4">
            <div className="bg-cloud p-6 sm:p-7 lg:sticky lg:top-6">
              <p className="eyebrow">Votre série</p>
              <h2 className="mt-2 text-[22px] font-medium leading-snug tracking-[-0.01em] text-ink">
                {subject?.title ?? 'Sujet de QCM'}
              </h2>
              <dl className="mt-5 border-t border-hairline text-[12px]">
                <div className="flex items-center justify-between gap-4 border-b border-hairline py-3">
                  <dt className="text-mute">Série terminée le</dt>
                  <dd className="text-right font-medium text-ink">
                    {formatDateLong(attempt.createdAt)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-hairline py-3">
                  <dt className="text-mute">Questions</dt>
                  <dd className="font-medium text-ink">{total}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-mute">Résultat</dt>
                  <dd className="font-medium text-ink">{score} / {total}</dd>
                </div>
              </dl>

              <p className="mt-5 border-t border-hairline pt-5 text-[11px] leading-relaxed text-mute">
                Une question à réponses multiples n’est validée que si toutes les bonnes
                réponses sont cochées, sans erreur supplémentaire.
              </p>

              <button
                type="button"
                onClick={exportResult}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 border border-hairline bg-white px-4 py-2.5 text-[12px] font-medium text-ink transition hover:bg-cloud"
              >
                <Download className="size-3.5" aria-hidden="true" />
                Télécharger le résultat
              </button>
            </div>
          </aside>

          <div className="lg:col-span-8">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-5">
              <div>
                <p className="eyebrow">Corrigé</p>
                <h2 className="mt-2 text-[24px] font-medium tracking-[-0.01em] text-ink">
                  Le détail, question par question.
                </h2>
              </div>
              <p className="text-[11px] text-mute">{total} questions · explications incluses</p>
            </div>

            <div>
              {questions.map((question, questionIndex) => {
                const given = attempt.answers[question.id] ?? []
                const isCorrect = sameLetters(given, question.correctAnswers)
                const isBlank = given.length === 0
                return (
                  <article
                    key={question.id}
                    className="border-b border-hairline py-8 first:pt-7 sm:py-9"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="eyebrow">
                        Question {String(questionIndex + 1).padStart(2, '0')}
                      </span>
                      <span className="h-px w-5 bg-hairline" aria-hidden="true" />
                      <span className="text-[10px] uppercase tracking-[0.14em] text-mute">
                        {question.matiere}
                      </span>
                      <span
                        className={cn(
                          'ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]',
                          isBlank
                            ? 'bg-cloud text-mute'
                            : isCorrect
                              ? 'bg-[#e9f5ee] text-success'
                              : 'bg-[#fdecec] text-sale',
                        )}
                      >
                        {isBlank ? (
                          'Sans réponse'
                        ) : isCorrect ? (
                          <>
                            <Check className="size-3" strokeWidth={2.5} aria-hidden="true" />
                            Juste
                          </>
                        ) : (
                          <>
                            <X className="size-3" strokeWidth={2.5} aria-hidden="true" />
                            À revoir
                          </>
                        )}
                      </span>
                    </div>

                    <h3 className="mt-4 text-[16px] font-medium leading-relaxed text-ink">
                      {question.statement}
                    </h3>

                    <div className="mt-4 border-t border-hairline-soft">
                      {answerLetters.map((letter) => {
                        const isExpected = question.correctAnswers.includes(letter)
                        const isGiven = given.includes(letter)
                        return (
                          <div
                            key={letter}
                            className={cn(
                              'flex items-start gap-3 border-b border-hairline-soft px-2 py-3 sm:px-3',
                              isExpected && 'bg-[#f3faf5]',
                              !isExpected && isGiven && 'bg-[#fff5f5]',
                            )}
                          >
                            <span
                              className={cn(
                                'mt-0.5 grid size-6 shrink-0 place-items-center border text-[11px] font-medium',
                                isExpected
                                  ? 'border-success bg-success text-white'
                                  : isGiven
                                    ? 'border-sale bg-sale text-white'
                                    : 'border-hairline text-mute',
                              )}
                            >
                              {letter}
                            </span>
                            <span className="flex-1 text-[13px] leading-relaxed text-charcoal">
                              {question.options[letter]}
                            </span>
                            {isExpected && (
                              <span className="mt-0.5 shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em] text-success">
                                Réponse attendue
                              </span>
                            )}
                            {!isExpected && isGiven && (
                              <span className="mt-0.5 shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em] text-sale">
                                Votre réponse
                              </span>
                            )}
                            {isExpected && isGiven && (
                              <Check
                                className="mt-1 size-3.5 shrink-0 text-success"
                                strokeWidth={2}
                                aria-hidden="true"
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-4 border-l-2 border-ink bg-cloud px-5 py-4 sm:px-6">
                      <p className="eyebrow">Explication médicale</p>
                      <p className="mt-2 text-[13px] leading-relaxed text-charcoal">
                        {question.explanation}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>

          </div>
        </div>
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
