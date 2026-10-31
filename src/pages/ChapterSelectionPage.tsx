import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ListChecks } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getUsableQuestions } from '@/lib/db'
import { chaptersForTheme, PACE_THEMES } from '@/lib/themes'
import { findChapterSubjects } from '@/lib/subjects'
import { Button } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import { cn, SERIES_SIZE } from '@/lib/utils'

export default function ChapterSelectionPage() {
  const { ueId = '' } = useParams()
  const navigate = useNavigate()
  const { db } = useAuth()
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const theme = PACE_THEMES.find((candidate) => candidate.id === ueId)
  usePageTitle(`${theme?.title ?? 'UE'} — MEDQCM mada`)

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

  const totalQuestions = chapters.reduce(
    (total, chapter) => (selected.has(chapter.id) ? total + chapter.questionCount : total),
    0,
  )
  const allSelected = chapters.length > 0 && selected.size === chapters.length
  const canLaunch = selected.size > 0 && totalQuestions >= SERIES_SIZE

  function toggle(chapterId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(chapters.map((chapter) => chapter.id)))
  }

  function launch() {
    if (!theme || !canLaunch) return
    const params = new URLSearchParams({
      ue: theme.id,
      chapters: [...selected].join(','),
    })
    navigate(`/app/entrainement?${params.toString()}`)
  }

  if (!theme) {
    return (
      <div className="mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-10">
        <p className="text-[11px] uppercase tracking-[0.14em] text-mute">UE introuvable</p>
        <h1 className="mt-3 font-display text-[2.4rem] leading-none text-ink">
          Cette UE n’existe pas.
        </h1>
        <Link
          to="/app"
          className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-accent"
        >
          <ArrowLeft size={15} /> Retour au tableau de bord
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-canvas">
      <section className="border-b border-line">
        <div className="mx-auto max-w-content px-5 py-10 sm:px-8 sm:py-12 lg:px-10">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 text-[12px] font-medium text-mute transition hover:text-accent"
          >
            <ArrowLeft size={14} /> Toutes les UE
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
                Cochez un ou plusieurs chapitres. Les 10 questions de la série seront tirées
                uniquement dans les chapitres sélectionnés, puis mélangées.
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
        {chapters.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-8">
            <p className="font-display text-[1.5rem] text-ink">Les chapitres arrivent bientôt.</p>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-mute">
              Cette UE est bien disponible, mais le docteur n’a pas encore publié ses chapitres.
              Revenez plus tard pour lancer une série.
            </p>
            <Link
              to="/app"
              className="mt-5 inline-flex items-center gap-2 text-[13px] font-medium text-accent"
            >
              Retour au tableau de bord <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="rounded-2xl border border-line bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                  <ListChecks size={16} className="text-accent" />
                  Chapitres
                </div>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-[12px] font-medium text-accent transition hover:text-accent-deep"
                >
                  {allSelected ? 'Tout décocher' : 'Tout sélectionner'}
                </button>
              </div>

              <div className="divide-y divide-line">
                {chapters.map((chapter) => {
                  const checked = selected.has(chapter.id)
                  return (
                    <button
                      key={chapter.id}
                      type="button"
                      onClick={() => toggle(chapter.id)}
                      className={cn(
                        'flex w-full items-center gap-4 px-5 py-4 text-left transition sm:px-6',
                        checked ? 'bg-accent-soft/60' : 'hover:bg-cloud/50',
                      )}
                      aria-pressed={checked}
                    >
                      <span
                        className={cn(
                          'grid h-5 w-5 shrink-0 place-items-center rounded border transition',
                          checked
                            ? 'border-accent bg-accent text-white'
                            : 'border-line bg-surface text-transparent',
                        )}
                      >
                        <Check size={13} strokeWidth={3} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-ink">
                          {chapter.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-mute">
                          {chapter.subjects.length} sujet{chapter.subjects.length > 1 ? 's' : ''}
                          {' · '}
                          {chapter.questionCount} question{chapter.questionCount > 1 ? 's' : ''}
                        </span>
                      </span>
                      {chapter.questionCount < SERIES_SIZE ? (
                        <span className="shrink-0 rounded-full bg-cloud px-2 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-mute">
                          À compléter
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>

            <aside className="h-fit rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:sticky lg:top-5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Votre série</p>
              <p className="mt-3 font-display text-[2rem] leading-none text-ink">
                {selected.size}
                <span className="ml-1 text-[13px] font-sans font-normal text-mute">
                  chapitre{selected.size > 1 ? 's' : ''}
                </span>
              </p>
              <p className="mt-2 text-[12px] text-mute">
                {totalQuestions} question{totalQuestions > 1 ? 's' : ''} disponible
                {totalQuestions > 1 ? 's' : ''} dans la sélection
              </p>

              <div className="mt-5 rounded-xl bg-cloud px-3 py-2.5 text-[11px] leading-relaxed text-mute">
                Chaque série contient {SERIES_SIZE} questions distinctes. Une série lancée est
                comptée, même si vous la quittez.
              </div>

              {selected.size > 0 && totalQuestions < SERIES_SIZE ? (
                <p className="mt-3 text-[11px] leading-relaxed text-sale">
                  Ajoutez un autre chapitre : il faut au moins {SERIES_SIZE} questions.
                </p>
              ) : null}

              <Button
                type="button"
                size="lg"
                className="mt-5 w-full justify-center"
                disabled={!canLaunch}
                onClick={launch}
              >
                Lancer la série <ArrowRight size={16} />
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
    </div>
  )
}
