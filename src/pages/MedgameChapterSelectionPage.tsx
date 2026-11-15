import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useMedgameKeepAlive } from '@/lib/useMedgameKeepAlive'
import { getUsableQuestions } from '@/lib/db'
import { medgameBankSize } from '@/lib/medgame'
import { chaptersForTheme, PACE_THEMES } from '@/lib/themes'
import { findChapterSubjects } from '@/lib/subjects'
import { ChapterList } from '@/components/ChapterList'
import { Button } from '@/components/ui/Button'
import { MedgameSaveChaptersModal } from '@/components/MedgameSaveChaptersModal'
import { usePageTitle } from '@/components/Layouts'

/**
 * Choix des chapitres d'un parcours MEDGAME. Même grammaire que Pres
 * Concours : on coche des chapitres dans une UE, on voit le compte rendu à
 * droite, on lance. Ici les questions sont mélangées par blocs de 5.
 */
export default function MedgameChapterSelectionPage() {
  const { ueId = '' } = useParams()
  const navigate = useNavigate()
  const { db } = useAuth()
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [runInProgress, setRunInProgress] = useState(false)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  useMedgameKeepAlive(activeRunId)

  const theme = PACE_THEMES.find((candidate) => candidate.id === ueId)
  usePageTitle(`${theme?.title ?? 'UE'} — MEDGAME — MEDQCM mada`)

  const chapters = useMemo(() => {
    if (!theme) return []
    return chaptersForTheme(theme.id).map((chapter) => {
      const subjects = findChapterSubjects(chapter.id, db.subjects)
      const questionCount = subjects.reduce(
        (total, subject) =>
          total +
          (db.questions.length > 0
            ? getUsableQuestions(subject.id, db).length
            : subject.questionCount),
        0,
      )
      return { ...chapter, subjects, questionCount }
    })
  }, [db.questions, db.subjects, theme])

  // La planche déjà ouverte dans cette UE est proposée présélectionnée.
  useEffect(() => {
    let cancelled = false
    void api
      .getMedgameOverview()
      .then((overview) => {
        if (cancelled) return
        // Tant que l'étudiant reste dans MEDGAME, ses parties restent vivantes.
        const active = overview.boards.find((item) => item.run?.status === 'in_progress')
        setActiveRunId(active?.run?.id ?? null)
        const board = overview.boards.find((item) => item.progress.ueId === ueId)
        if (!board) return
        setRunInProgress(board.run?.status === 'in_progress')
        const ids = board.progress.chapterIds.filter((id) =>
          chaptersForTheme(ueId).some((chapter) => chapter.id === id),
        )
        if (ids.length > 0) setSelected(new Set(ids))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [ueId])

  // Les questions disponibles : les énoncés répétés d'un chapitre à l'autre ne
  // comptent qu'une fois, comme dans la banque réellement tirée.
  const bankSize = useMemo(
    () => (selected.size > 0 ? medgameBankSize(db, [...selected]) : 0),
    [db, selected],
  )
  const levelCount = Math.ceil(bankSize / 5)
  const allSelected = chapters.length > 0 && selected.size === chapters.length
  const canLaunch = selected.size > 0 && bankSize > 0 && !runInProgress

  function toggle(chapterId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return next
    })
  }

  function toggleAll() {
    const available = chapters.filter((chapter) => chapter.questionCount > 0)
    setSelected(allSelected ? new Set() : new Set(available.map((chapter) => chapter.id)))
  }

  async function launch() {
    if (!theme || !canLaunch || starting) return
    setStarting(true)
    setError('')
    try {
      const overview = await api.createMedgameProgress(theme.id, [...selected])
      const board = overview.boards.find((item) => item.progress.ueId === theme.id)
      if (!board) throw new Error('La planche n’a pas pu être créée.')
      await api.startMedgameRun(board.progress.id)
      navigate('/app/medgame/parcours')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Le parcours n’a pas pu être lancé. Réessaie.',
      )
      setStarting(false)
    }
  }

  if (!theme) {
    return (
      <div className="mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-10">
        <p className="text-[11px] uppercase tracking-[0.14em] text-mute">UE introuvable</p>
        <h1 className="mt-3 font-display text-[2.4rem] leading-none text-ink">
          Cette UE n’existe pas.
        </h1>
        <Link
          to="/app/medgame"
          className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-accent"
        >
          <ArrowLeft size={15} /> Retour à MEDGAME
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-canvas">
      <section className="border-b border-line">
        <div className="mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-12 lg:px-10">
          <Link
            to="/app/medgame"
            className="inline-flex items-center gap-2 text-[12px] font-medium text-mute transition hover:text-accent"
          >
            <ArrowLeft size={14} /> MEDGAME
          </Link>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
                Choisir les chapitres
              </p>
              <h1 className="mt-2 font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-[-0.03em] text-ink">
                {theme.title}
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-mute">
                Cochez un ou plusieurs chapitres. Toutes leurs questions sont mélangées dans un
                parcours de niveaux de 5, et il faut 5/5 pour ouvrir le suivant.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface px-4 py-3 text-[12px] text-mute">
              <span className="font-medium text-ink">{chapters.length}</span>{' '}
              chapitre{chapters.length > 1 ? 's' : ''} disponible
              {chapters.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-content px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        {error ? (
          <div className="mb-6 rounded-xl border border-sale/25 bg-sale/5 px-4 py-3 text-[13px] text-sale">
            {error}
          </div>
        ) : null}

        {runInProgress ? (
          <div className="mb-6 rounded-xl border border-accent/20 bg-accent-soft/40 px-4 py-3 text-[13px] text-ink">
            Une partie MEDGAME est déjà en cours dans cette UE. Termine-la ou abandonne-la avant de
            lancer un nouveau parcours.
          </div>
        ) : null}

        {chapters.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-8">
            <p className="font-display text-[1.5rem] text-ink">Les chapitres arrivent bientôt.</p>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-mute">
              Cette UE est bien disponible, mais le docteur n’a pas encore publié ses chapitres.
              Revenez plus tard pour lancer un parcours.
            </p>
            <Link
              to="/app/medgame"
              className="mt-5 inline-flex items-center gap-2 text-[13px] font-medium text-accent"
            >
              Retour à MEDGAME <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <ChapterList
              entries={chapters.map((chapter) => ({
                id: chapter.id,
                title: chapter.title,
                meta: `${chapter.questionCount} question${chapter.questionCount > 1 ? 's' : ''}`,
                disabled: chapter.questionCount === 0,
                badge: selected.has(chapter.id)
                  ? { label: 'Choisi', tone: 'accent' }
                  : null,
              }))}
              selectedIds={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              toggleAllLabel={allSelected ? 'Tout décocher' : 'Tout sélectionner'}
            />

            <aside className="h-fit rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:sticky lg:top-5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Votre parcours</p>
              <p className="mt-3 font-display text-[2rem] leading-none text-ink">
                {selected.size}
                <span className="ml-1 text-[13px] font-sans font-normal text-mute">
                  chapitre{selected.size > 1 ? 's' : ''}
                </span>
              </p>
              <p className="mt-2 text-[12px] text-mute">
                {canLaunch
                  ? 'Votre sélection est prête pour lancer un parcours.'
                  : 'Sélectionnez au moins un chapitre contenant des questions.'}
              </p>

              <div className="mt-5 rounded-xl bg-cloud px-3 py-2.5 text-[11px] leading-relaxed text-mute">
                Tes {bankSize} questions forment {levelCount} niveau{levelCount > 1 ? 'x' : ''}{' '}
                de 5. Chaque niveau est tiré au hasard dans tes chapitres : il faut 5/5 pour valider
                un niveau. Une série est consommée à la fin du parcours.
              </div>

              {selected.size > 0 && bankSize === 0 ? (
                <p className="mt-3 text-[11px] leading-relaxed text-sale">
                  Ajoute un autre chapitre : il faut au moins une question.
                </p>
              ) : null}

              <Button
                type="button"
                size="lg"
                className="mt-5 w-full justify-center"
                disabled={!canLaunch || starting}
                onClick={() => setConfirmOpen(true)}
              >
                {starting ? 'Enregistrement…' : 'Lancer le parcours'} <ArrowRight size={16} />
              </Button>
              {selected.size === 0 ? (
                <p className="mt-2 text-center text-[11px] text-mute">
                  Sélectionnez au moins un chapitre.
                </p>
              ) : null}
            </aside>
          </div>
        )}
      </section>

      <MedgameSaveChaptersModal
        open={confirmOpen}
        onClose={() => (starting ? undefined : setConfirmOpen(false))}
        onConfirmed={() => void launch()}
        chapterCount={selected.size}
        starting={starting}
        error={error}
      />
    </div>
  )
}
