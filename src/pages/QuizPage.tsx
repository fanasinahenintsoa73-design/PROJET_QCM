import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { getSeriesUsage } from '@/lib/db'
import type { Question, Subject } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { usePageTitle } from '@/components/Layouts'
import { chapterTitle, findPaceTheme } from '@/lib/themes'
import { findThemeSubject } from '@/lib/subjects'
import {
  answerLetters,
  cn,
  errorCode,
  SERIES_LIMIT,
  SERIES_LIMIT_MESSAGE,
  SERIES_SIZE,
  type AnswerLetter,
} from '@/lib/utils'

type BlockReason = 'limit' | 'access' | null

const QUIT_MESSAGE =
  'Voulez-vous vraiment quitter ? Ce QCM compte une série même si vous revenez.'

/**
 * Évite qu'un retour navigateur/app juste après un abandon relance une
 * nouvelle série (donc un nouveau comptage) : on repart vers le tableau de
 * bord sans appeler start_chapter_quiz pendant quelques secondes.
 */
const JUST_ABANDONED_KEY = 'medqcm.justAbandoned'

function isJustAbandoned(): boolean {
  try {
    const raw = sessionStorage.getItem(JUST_ABANDONED_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { until?: number }
    return typeof parsed.until === 'number' && parsed.until > Date.now()
  } catch {
    return false
  }
}

function markJustAbandoned() {
  try {
    sessionStorage.setItem(JUST_ABANDONED_KEY, JSON.stringify({ until: Date.now() + 10000 }))
  } catch {
    /* stockage indisponible : le garde historique reste en place */
  }
}

function clearJustAbandoned() {
  try {
    sessionStorage.removeItem(JUST_ABANDONED_KEY)
  } catch {
    /* noop */
  }
}

interface ActiveQuiz {
  attemptId?: string
  subject?: Subject
  ueId?: string
  chapterIds?: string[]
  questions: Question[]
}

export default function QuizPage() {
  usePageTitle('Série en cours — MEDQCM mada')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, db } = useAuth()
  const themeParam = searchParams.get('theme') ?? ''
  const ueParam = searchParams.get('ue') ?? ''
  const chaptersParam = searchParams.get('chapters') ?? ''
  const chapterIds = chaptersParam.split(',').map((id) => id.trim()).filter(Boolean)
  const isChapterMode = Boolean(ueParam)
  const theme = findPaceTheme(isChapterMode ? ueParam : themeParam)
  const subject = !isChapterMode
    ? theme
      ? findThemeSubject(theme.id, db.subjects)
      : db.subjects.find(
          (candidate) =>
            candidate.id === themeParam &&
            !candidate.archived &&
            candidate.questionCount >= SERIES_SIZE,
        )
    : undefined
  const subjectId = subject?.id ?? null
  const chapterKey = [...chapterIds].sort().join(',')
  const usage = user ? getSeriesUsage(user.id, db) : undefined

  const [payload, setPayload] = useState<ActiveQuiz | null>(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState<BlockReason>(null)
  const [unavailable, setUnavailable] = useState('')
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [showQuit, setShowQuit] = useState(false)
  const [quitting, setQuitting] = useState(false)
  const finished = useRef(false)
  const allowExit = useRef(false)
  const guardPushed = useRef(false)

  // Une navigation hors du QCM (bouton retour, lien, app Android) demande une
  // confirmation : la série ouverte reste comptée même si l'étudiant revient.
  // On évite useBlocker : l'app utilise BrowserRouter, pas un data-router.
  useEffect(() => {
    if (!payload || finished.current || guardPushed.current) return
    window.history.pushState({ medqcmQuiz: true }, '', window.location.href)
    guardPushed.current = true
  }, [payload])

  useEffect(() => {
    const onPopState = () => {
      if (!payload || finished.current || allowExit.current) return
      window.history.pushState({ medqcmQuiz: true }, '', window.location.href)
      setShowQuit(true)
    }
    const onClick = (event: MouseEvent) => {
      if (!payload || finished.current || allowExit.current) return
      const anchor = (event.target as Element | null)?.closest?.('a[href]')
      if (!anchor) return
      const href = anchor.getAttribute('href') ?? ''
      if (!href.startsWith('/')) return
      const nextPath = href.split('?')[0].split('#')[0]
      if (nextPath.startsWith('/app/resultat')) return
      event.preventDefault()
      event.stopPropagation()
      setShowQuit(true)
    }
    window.addEventListener('popstate', onPopState)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('popstate', onPopState)
      document.removeEventListener('click', onClick, true)
    }
  }, [payload])

  // L'app Android envoie cet événement quand le bouton retour est pressé sans
  // historique WebView : la même fenêtre de confirmation s'affiche.
  useEffect(() => {
    const onAndroidBack = () => {
      if (payload && !finished.current) setShowQuit(true)
    }
    window.addEventListener('medqcm:request-exit', onAndroidBack)
    return () => window.removeEventListener('medqcm:request-exit', onAndroidBack)
  }, [payload])

  // Fermeture d'onglet ou refresh : le navigateur n'autorise qu'un avertissement
  // générique. Après refresh, start_chapter_quiz reprend le brouillon existant.
  useEffect(() => {
    if (!payload || finished.current) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [payload])
  // Le brouillon est déjà compté dans le cycle : une fois la série chargée,
  // le numéro affiché est le compteur courant, pas le suivant.
  const seriesNumber = Math.min(
    SERIES_LIMIT,
    (usage?.used ?? 0) + (payload ? 0 : 1),
  )

  const questions = payload?.questions ?? []
  const current = questions[index]
  const selected = current ? answers[current.id] ?? [] : []
  const answeredCount = questions.filter((question) => (answers[question.id] ?? []).length > 0).length
  const isLast = index === questions.length - 1

  // La session recharge la base toutes les 20 s. On ne dépend que de
  // l'identifiant du sujet pour ne pas relancer la série en cours.
  useEffect(() => {
    if (!user || (!isChapterMode && !themeParam)) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setBlocked(null)
    setUnavailable('')
    setLoadError('')
    setPayload(null)

    if (isChapterMode && (!theme || chapterIds.length === 0)) {
      setUnavailable(
        'Cette UE ou cette sélection de chapitres est introuvable. Revenez au tableau de bord pour choisir vos chapitres.',
      )
      setLoading(false)
      return
    }
    if (!isChapterMode && !subjectId) {
      setUnavailable(
        'Ce thème sera bientôt disponible : le docteur prépare encore ses questions.',
      )
      setLoading(false)
      return
    }

    // Retour juste après un abandon confirmé : ne pas relancer une série.
    if (isChapterMode && isJustAbandoned()) {
      clearJustAbandoned()
      setLoading(false)
      navigate('/app', { replace: true })
      return
    }

    const request = isChapterMode
      ? api.startChapterQuiz(user.id, ueParam, chapterIds, SERIES_SIZE)
      : api.startQuiz(user.id, subjectId as string, SERIES_SIZE)

    request
      .then((quiz) => {
        if (!active) return
        if (quiz.questions.length < SERIES_SIZE) {
          setUnavailable(
            'Cette sélection ne contient pas encore assez de questions pour une série complète.',
          )
          return
        }
        setPayload(
          'attemptId' in quiz
            ? {
                attemptId: quiz.attemptId,
                ueId: quiz.ueId,
                chapterIds: quiz.chapterIds,
                questions: quiz.questions,
              }
            : {
                subject: quiz.subject,
                questions: quiz.questions,
              },
        )
        setIndex(0)
        setAnswers({})
        finished.current = false
      })
      .catch((error: unknown) => {
        if (!active) return
        const message =
          error instanceof Error ? error.message : 'La série n’a pas pu être chargée.'
        switch (errorCode(error)) {
          case 'SERIES_LIMIT_REACHED':
            setBlocked('limit')
            return
          case 'ACCESS_EXPIRED':
            setBlocked('access')
            return
          case 'THEME_UNAVAILABLE':
          case 'THEME_NOT_FOUND':
          case 'NO_CHAPTER':
          case 'INVALID_CHAPTER':
            setUnavailable(message)
            return
          default:
            break
        }
        if (/accès|attribué|terminé/i.test(message)) setBlocked('access')
        else setLoadError(message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [chapterKey, isChapterMode, subjectId, themeParam, ueParam, user?.id])

  function toggleAnswer(letter: AnswerLetter) {
    if (!current) return
    setAnswers((previous) => {
      const existing = previous[current.id] ?? []
      if (existing.includes(letter)) {
        return { ...previous, [current.id]: [] }
      }
      return { ...previous, [current.id]: [letter] }
    })
  }

  function canContinue() {
    if (!payload) {
      setBlocked('access')
      return false
    }
    return true
  }

  async function goNext() {
    if (!isLast) {
      if (!canContinue()) return
      setIndex((value) => Math.min(value + 1, questions.length - 1))
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!canContinue() || !user || !payload || saving || finished.current) return
    setSaving(true)
    setSubmitError('')
    finished.current = true
    try {
      const result = payload.attemptId
        ? await api.saveChapterAttempt({
            userId: user.id,
            attemptId: payload.attemptId,
            answers,
          })
        : await api.saveAttempt({
            userId: user.id,
            subjectId: payload.subject!.id,
            questionIds: questions.map((question) => question.id),
            answers,
          })
      navigate(`/app/resultat/${result.attemptId}`, { replace: true })
    } catch (error) {
      finished.current = false
      setSaving(false)
      if (errorCode(error) === 'SERIES_LIMIT_REACHED') {
        setBlocked('limit')
        return
      }
      setSubmitError(
        error instanceof Error ? error.message : 'La série n’a pas pu être enregistrée.',
      )
    }
  }

  function quit() {
    if (payload && !finished.current) setShowQuit(true)
  }

  function cancelQuit() {
    setShowQuit(false)
  }

  async function confirmQuit() {
    if (!payload || quitting) return
    setQuitting(true)
    try {
      // La série a déjà été comptée au lancement ; on la marque seulement
      // comme abandonnée pour que le retour crée une nouvelle série.
      if (payload.attemptId && user) {
        await api.abandonSeries(user.id, payload.attemptId)
      }
    } catch {
      // Même sans réponse serveur, l'étudiant a confirmé : on le fait sortir.
    } finally {
      allowExit.current = true
      finished.current = true
      guardPushed.current = false
      markJustAbandoned()
      setShowQuit(false)
      setQuitting(false)
      navigate('/app', { replace: true })
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-lg">
          <p className="text-[12px] text-mute">
            {theme ? theme.title : 'Préparation de la série'}
          </p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Dix questions arrivent.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">
            La sélection est chargée de façon sécurisée. La correction restera masquée jusqu’à
            l’envoi.
          </p>
        </div>
      </div>
    )
  }

  if (!isChapterMode && !themeParam) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-lg">
          <p className="text-[12px] text-mute">Aucune UE sélectionnée</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Choisissez une UE.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">
            Choisissez une UE puis un ou plusieurs chapitres depuis votre tableau de bord. Chaque
            série contient dix questions.
          </p>
          <ButtonLink to="/app" className="mt-6">
            Voir les UE
          </ButtonLink>
        </div>
      </div>
    )
  }

  if (blocked === 'limit') {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-lg">
          <p className="text-[12px] text-mute">Quota du cycle</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Vos 30 séries ont été lancées.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">
            {SERIES_LIMIT_MESSAGE}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <ButtonLink to="/reinscription">Renouveler mon accès</ButtonLink>
            <ButtonLink to="/app" variant="ghost">
              Retour au tableau de bord
            </ButtonLink>
          </div>
        </div>
      </div>
    )
  }

  if (blocked === 'access') {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-lg">
          <p className="text-[12px] text-mute">Série interrompue</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Le cycle est terminé.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">
            Votre accès n’est plus actif. Renouvelez votre abonnement pour retrouver vos UE, vos
            chapitres et vos 30 séries.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <ButtonLink to="/reinscription">Renouveler mon accès</ButtonLink>
            <ButtonLink to="/app" variant="ghost">
              Retour au tableau de bord
            </ButtonLink>
          </div>
        </div>
      </div>
    )
  }

  if (unavailable) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-lg">
          <p className="text-[12px] text-mute">Série en préparation</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Bientôt disponible.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">{unavailable}</p>
          <ButtonLink to="/app" className="mt-6">
            Choisir un autre thème
          </ButtonLink>
        </div>
      </div>
    )
  }

  if (loadError || !payload || !current) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-content items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-lg">
          <p className="text-[12px] text-mute">Série indisponible</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            Aucune question à afficher.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-mute">
            {loadError || 'Cette sélection n’a pas encore ses dix questions. Contactez votre docteur.'}
          </p>
          <ButtonLink to="/app" className="mt-6">
            Retour au tableau de bord
          </ButtonLink>
        </div>
      </div>
    )
  }

  return (
    <>
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
              Série <span className="font-medium text-ink">{seriesNumber}</span> sur {SERIES_LIMIT}
            </p>
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
          <span className="font-medium text-ink">
            {isChapterMode ? theme?.title : payload.subject?.title}
          </span>
          {isChapterMode && chapterIds.length > 0 ? (
            <>
              <span className="h-1 w-1 rounded-full bg-line" />
              <span className="max-w-[28rem] truncate">
                {chapterIds.map((id) => chapterTitle(id)).filter(Boolean).join(' · ')}
              </span>
            </>
          ) : null}
          <span className="h-1 w-1 rounded-full bg-line" />
          <span>Une seule réponse</span>
          <span className="ml-auto rounded-full bg-cloud px-2.5 py-1">
            Question {String(index + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}
          </span>
        </div>

        <h1 className="mt-5 max-w-3xl font-display text-[clamp(1.7rem,3.2vw,2.35rem)] leading-[1.25] tracking-[-0.02em] text-ink">
          {current.statement}
        </h1>

        <div className="mt-7 space-y-2.5" role="group" aria-label="Réponses possibles">
          {answerLetters.filter((letter) => current.options[letter]?.trim()).map((letter) => {
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

        {submitError && (
          <p className="mt-5 rounded-lg border border-sale/20 bg-danger-soft px-4 py-3 text-[13px] text-sale" role="alert">
            {submitError}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={quit}
              className="inline-flex h-10 items-center gap-1.5 text-[12px] font-medium text-mute transition hover:text-ink"
            >
              <ArrowLeft size={14} /> Quitter la série
            </button>
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((value) => Math.max(0, value - 1))}
                className="inline-flex h-10 items-center gap-1.5 text-[12px] font-medium text-mute transition hover:text-ink"
              >
                <ArrowLeft size={14} /> Précédente
              </button>
            )}
          </div>

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

      {showQuit ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmation de sortie du QCM"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <h2 className="font-display text-2xl text-ink">Quitter cette série ?</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-mute">
              {QUIT_MESSAGE} Vos réponses en cours ne seront pas enregistrées.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="secondary" onClick={cancelQuit} disabled={quitting} className="flex-1">
                Rester dans le QCM
              </Button>
              <Button variant="danger" onClick={confirmQuit} loading={quitting} className="flex-1">
                Quitter et compter la série
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
