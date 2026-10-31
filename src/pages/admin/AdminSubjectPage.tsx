import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Loader2,
  PencilLine,
  Save,
  X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { getPublishedSubjects } from '@/lib/db'
import { parseSubjectFiles, type ParseResult } from '@/lib/excel'
import {
  PACE_THEMES,
  chaptersForTheme,
  chapterTitle,
  findPaceTheme,
  findThemeForChapter,
  type ChapterDefinition,
  type ThemeQuestionInput,
} from '@/lib/themes'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import { StatusPill } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/Toast'
import { usePageTitle } from '@/components/Layouts'
import { cn, formatBytes, formatDate, monthLabel, SERIES_SIZE } from '@/lib/utils'
import type { Subject } from '@/types'

const importAccept =
  '.xlsx,.xls,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'

type FileKey = 'questions' | 'answers'

interface FileErrors {
  questions?: string
  answers?: string
}

interface SaveNotice {
  title: string
  questionCount: number
  updated: boolean
  metadataOnly: boolean
}

function subjectTheme(subject: Subject) {
  return subject.chapterId ? findThemeForChapter(subject.chapterId) : findPaceTheme(subject.title)
}

function subjectChapter(subject: Subject) {
  return subject.chapterId ? chapterTitle(subject.chapterId) : 'Ancien format'
}

function sortSubjects(subjects: Subject[]) {
  const themeOrder = new Map(PACE_THEMES.map((theme, index) => [theme.id, index] as const))
  return [...subjects].sort((left, right) => {
    const leftTheme = subjectTheme(left)
    const rightTheme = subjectTheme(right)
    const byTheme =
      (themeOrder.get(leftTheme?.id ?? '') ?? 99) - (themeOrder.get(rightTheme?.id ?? '') ?? 99)
    if (byTheme !== 0) return byTheme
    const byChapter = subjectChapter(left).localeCompare(subjectChapter(right), 'fr', {
      sensitivity: 'base',
    })
    if (byChapter !== 0) return byChapter
    return left.title.localeCompare(right.title, 'fr', { sensitivity: 'base' })
  })
}

export default function AdminSubjectPage() {
  usePageTitle('Sujets — Espace docteur')
  const { db, refresh } = useAuth()
  const { toast } = useToast()

  const subjects = sortSubjects(getPublishedSubjects(db))

  const [ueId, setUeId] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [subjectTitle, setSubjectTitle] = useState('')
  const [editingSubjectId, setEditingSubjectId] = useState<string | undefined>()
  const [description, setDescription] = useState('')
  const [questionsFile, setQuestionsFile] = useState<File | null>(null)
  const [answersFile, setAnswersFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [parseError, setParseError] = useState('')
  const [ueError, setUeError] = useState('')
  const [chapterError, setChapterError] = useState('')
  const [titleError, setTitleError] = useState('')
  const [fileErrors, setFileErrors] = useState<FileErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<SaveNotice | null>(null)

  const formRef = useRef<HTMLElement>(null)
  const ueSelectRef = useRef<HTMLSelectElement>(null)

  const selectedTheme = PACE_THEMES.find((theme) => theme.id === ueId)
  const chapters = ueId ? chaptersForTheme(ueId) : []
  const selectedChapter = chapters.find((chapter) => chapter.id === chapterId)
  const existingSubject = editingSubjectId
    ? subjects.find((subject) => subject.id === editingSubjectId)
    : undefined
  const subjectsInChapter = chapterId
    ? subjects.filter((subject) => subject.chapterId === chapterId)
    : []

  useEffect(() => {
    if (!questionsFile || !answersFile) {
      setParsing(false)
      setParseResult(null)
      return
    }

    let cancelled = false
    setParsing(true)
    setParseError('')
    setParseResult(null)

    parseSubjectFiles(questionsFile, answersFile)
      .then((result) => {
        if (!cancelled) setParseResult(result)
      })
      .catch((caught) => {
        if (cancelled) return
        setParseResult(null)
        setParseError(
          caught instanceof Error
            ? caught.message
            : 'Impossible de lire les fichiers. Vérifiez leur format Excel ou PDF.',
        )
      })
      .finally(() => {
        if (!cancelled) setParsing(false)
      })

    return () => {
      cancelled = true
    }
  }, [answersFile, questionsFile])

  const parsedQuestions = parseResult?.questions ?? []
  const parseIssues = [...(parseError ? [parseError] : []), ...(parseResult?.errors ?? [])]
  const warnings = parseResult?.warnings ?? []
  const hasAnyFile = Boolean(questionsFile || answersFile)
  const enoughQuestions = parsedQuestions.length >= SERIES_SIZE
  const parsedReady = Boolean(parseResult) && !parseIssues.length && !parsing
  const canReuseContent = Boolean(existingSubject) && !hasAnyFile

  const clearForm = () => {
    setUeId('')
    setChapterId('')
    setSubjectTitle('')
    setEditingSubjectId(undefined)
    setDescription('')
    setQuestionsFile(null)
    setAnswersFile(null)
    setParseResult(null)
    setParseError('')
    setUeError('')
    setChapterError('')
    setTitleError('')
    setFileErrors({})
    setFormError('')
  }

  const resetForm = () => {
    clearForm()
    setNotice(null)
  }

  const chooseUe = (nextUeId: string) => {
    setUeId(nextUeId)
    setChapterId('')
    setSubjectTitle('')
    setEditingSubjectId(undefined)
    setDescription('')
    setUeError('')
    setChapterError('')
    setTitleError('')
    setFormError('')
    setNotice(null)
    setQuestionsFile(null)
    setAnswersFile(null)
    setParseResult(null)
    setParseError('')
    setFileErrors({})
  }

  const chooseChapter = (nextChapterId: string) => {
    setChapterId(nextChapterId)
    setEditingSubjectId(undefined)
    setSubjectTitle(chapters.find((chapter) => chapter.id === nextChapterId)?.title ?? '')
    setDescription('')
    setChapterError('')
    setTitleError('')
    setFormError('')
    setNotice(null)
    setQuestionsFile(null)
    setAnswersFile(null)
    setParseResult(null)
    setParseError('')
    setFileErrors({})
  }

  const startEdit = (subject: Subject) => {
    const theme = subject.chapterId ? findThemeForChapter(subject.chapterId) : undefined
    if (!theme || !subject.chapterId) {
      toast(
        'Ce sujet utilise l’ancien format sans chapitre. Il reste disponible aux étudiants mais ne peut pas être modifié dans le nouveau formulaire.',
        'error',
      )
      return
    }
    setUeId(theme.id)
    setChapterId(subject.chapterId)
    setEditingSubjectId(subject.id)
    setSubjectTitle(subject.title)
    setDescription(subject.description)
    setUeError('')
    setChapterError('')
    setTitleError('')
    setFormError('')
    setNotice(null)
    setQuestionsFile(null)
    setAnswersFile(null)
    setParseResult(null)
    setParseError('')
    setFileErrors({})
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      ueSelectRef.current?.focus({ preventScroll: true })
    }, 0)
  }

  const chooseFile = (key: FileKey, file: File | undefined) => {
    if (!file) return
    if (!/\.(xlsx|xls|pdf)$/i.test(file.name)) {
      setFileErrors((current) => ({
        ...current,
        [key]: 'Format non pris en charge. Utilisez un fichier Excel (.xlsx/.xls) ou PDF.',
      }))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileErrors((current) => ({
        ...current,
        [key]: 'Fichier trop volumineux (10 Mo maximum).',
      }))
      return
    }

    setFileErrors((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
    setFormError('')
    setNotice(null)
    setParseError('')

    if (key === 'questions') setQuestionsFile(file)
    else setAnswersFile(file)
  }

  const clearFile = (key: FileKey) => {
    setFileErrors((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
    setFormError('')
    setNotice(null)
    setParseError('')

    if (key === 'questions') setQuestionsFile(null)
    else setAnswersFile(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return

    setFormError('')
    setNotice(null)

    if (!selectedTheme) {
      setUeError('Sélectionnez l’UE du sujet.')
      ueSelectRef.current?.focus()
      return
    }
    if (!selectedChapter) {
      setChapterError('Sélectionnez le chapitre du sujet.')
      return
    }
    if (!subjectTitle.trim()) {
      setTitleError('Donnez un titre au sujet.')
      return
    }

    const nextFileErrors: FileErrors = {}
    if (hasAnyFile) {
      if (!questionsFile) {
        nextFileErrors.questions = 'Choisissez aussi le fichier du sujet pour remplacer le contenu.'
      }
      if (!answersFile) {
        nextFileErrors.answers = 'Choisissez aussi le fichier de correction pour remplacer le contenu.'
      }
    } else if (!existingSubject) {
      nextFileErrors.questions = 'Le fichier du sujet est obligatoire.'
      nextFileErrors.answers = 'Le fichier de correction est obligatoire.'
    }

    if (nextFileErrors.questions || nextFileErrors.answers) {
      setFileErrors(nextFileErrors)
      setFormError(
        hasAnyFile
          ? 'Les deux fichiers doivent être remplacés ensemble pour éviter un sujet partiel.'
          : 'Ajoutez les deux fichiers avant d’enregistrer le sujet.',
      )
      return
    }

    if (hasAnyFile) {
      if (parsing) {
        setFormError('La lecture des fichiers est encore en cours. Patientez un instant.')
        return
      }
      if (parseIssues.length) {
        setFormError('Les fichiers contiennent des erreurs : corrigez-les avant d’enregistrer.')
        return
      }
      if (!enoughQuestions) {
        setFormError(
          `Le sujet doit contenir au moins ${SERIES_SIZE} questions valides pour ouvrir une série étudiante.`,
        )
        return
      }
    }

    const metadataOnly = !hasAnyFile
    const updated = Boolean(existingSubject)

    setSaving(true)
    try {
      const questions: ThemeQuestionInput[] | undefined = metadataOnly
        ? undefined
        : parsedQuestions.map((question) => ({
            ...question,
            matiere: selectedChapter.title,
          }))

      const subject = await api.saveChapterSubject({
        subjectId: editingSubjectId,
        themeId: selectedTheme.id,
        chapterId: selectedChapter.id,
        title: subjectTitle.trim(),
        description: description.trim(),
        monthLabel: existingSubject?.monthLabel?.trim() || monthLabel(),
        questions,
        questionFileName: questionsFile?.name,
        answerFileName: answersFile?.name,
      })

      await refresh()
      clearForm()
      setNotice({
        title: subject.title,
        questionCount: subject.questionCount,
        updated,
        metadataOnly,
      })
      toast(
        updated
          ? 'Sujet mis à jour. Les étudiants retrouvent immédiatement le nouveau contenu.'
          : 'Sujet enregistré et disponible pour les séries étudiantes.',
        'success',
      )
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Enregistrement du sujet impossible.'
      setFormError(message)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-canvas">
      <section className="border-b border-hairline-soft">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 sm:py-9 lg:px-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="eyebrow text-mute">Parcours QCM</p>
              <h1 className="display mt-3 text-[clamp(2.8rem,6vw,4.5rem)]">Sujets.</h1>
              <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-mute">
                Choisissez une UE puis un chapitre, donnez un titre au sujet, joignez le fichier
                des questions et celui de la correction. Un chapitre peut contenir plusieurs
                sujets.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={subjects.length > 0 ? 'success' : 'neutral'} dot>
                {subjects.length} sujet{subjects.length > 1 ? 's' : ''} en ligne
              </StatusPill>
              <StatusPill tone="neutral" dot>
                {PACE_THEMES.length} UE
              </StatusPill>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section
            ref={formRef}
            aria-labelledby="subject-form-title"
            className="scroll-mt-[130px] border border-hairline bg-white p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline-soft pb-4">
              <div>
                <h2
                  id="subject-form-title"
                  className="text-[18px] font-medium tracking-[-0.01em]"
                >
                  {existingSubject ? 'Modifier le sujet' : 'Enregistrer un sujet'}
                </h2>
                <p className="mt-1 max-w-md text-[11px] leading-relaxed text-mute">
                  Les sujets sont rangés par UE et par chapitre. Enregistrer un nouveau sujet ne
                  remplace pas les autres sujets du même chapitre.
                </p>
              </div>
              {existingSubject && (
                <StatusPill tone="info" dot>
                  Sujet en modification
                </StatusPill>
              )}
            </div>

            {notice && (
              <div
                role="status"
                className="mt-4 flex items-start gap-3 border border-success/30 bg-[#f3faf5] px-4 py-3.5"
              >
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-success"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-[12px] font-medium text-ink">
                    {notice.updated ? 'Sujet mis à jour.' : 'Sujet enregistré.'}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-charcoal">
                    « {notice.title} » est en ligne
                    {notice.metadataOnly
                      ? '. Le contenu et le corrigé déjà enregistrés sont conservés, ainsi que l’historique des tentatives.'
                      : ` avec ${notice.questionCount} question${
                          notice.questionCount > 1 ? 's' : ''
                        } et leur correction. Les étudiants peuvent lancer une série.${
                          notice.updated
                            ? ' Les tentatives déjà enregistrées restent inchangées.'
                            : ''
                        }`}
                  </p>
                </div>
              </div>
            )}

            <form className="mt-5 space-y-5" onSubmit={handleSubmit} noValidate>
              <Field
                label="UE"
                htmlFor="subject-ue"
                required
                error={ueError}
                hint={
                  selectedTheme
                    ? selectedTheme.description
                    : 'Sélectionnez l’une des neuf UE officielles.'
                }
              >
                <div className="relative">
                  <select
                    ref={ueSelectRef}
                    id="subject-ue"
                    className={cn('form-input appearance-none pr-10', ueError && 'border-sale')}
                    value={ueId}
                    onChange={(event) => chooseUe(event.target.value)}
                    aria-invalid={Boolean(ueError)}
                    aria-required="true"
                  >
                    <option value="" disabled>
                      Sélectionner une UE
                    </option>
                    {PACE_THEMES.map((theme, index) => (
                      <option key={theme.id} value={theme.id}>
                        {String(index + 1).padStart(2, '0')} — {theme.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-mute"
                    aria-hidden="true"
                  />
                </div>
              </Field>

              <Field
                label="Chapitre"
                htmlFor="subject-chapter"
                required
                error={chapterError}
                hint={
                  selectedTheme && chapters.length === 0
                    ? 'Les chapitres de cette UE ne sont pas encore disponibles.'
                    : 'Les chapitres sont affichés par ordre alphabétique.'
                }
              >
                <div className="relative">
                  <select
                    id="subject-chapter"
                    className={cn(
                      'form-input appearance-none pr-10',
                      chapterError && 'border-sale',
                    )}
                    value={chapterId}
                    onChange={(event) => chooseChapter(event.target.value)}
                    disabled={!selectedTheme || chapters.length === 0}
                    aria-invalid={Boolean(chapterError)}
                    aria-required="true"
                  >
                    <option value="" disabled>
                      {selectedTheme ? 'Sélectionner un chapitre' : 'Choisissez d’abord une UE'}
                    </option>
                    {chapters.map((chapter: ChapterDefinition) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-mute"
                    aria-hidden="true"
                  />
                </div>
              </Field>

              {selectedTheme && chapters.length === 0 && (
                <p className="border-l-2 border-[#b26b00] bg-[#fff8ec] px-3.5 py-3 text-[10px] leading-relaxed text-charcoal">
                  Les chapitres de « {selectedTheme.title} » seront ajoutés prochainement. En
                  attendant, cette UE ne peut pas recevoir de nouveau sujet.
                </p>
              )}

              <Field
                label="Titre du sujet"
                htmlFor="subject-title"
                required
                error={titleError}
                hint="Par défaut, le titre du chapitre est proposé. Vous pouvez le préciser."
              >
                <input
                  id="subject-title"
                  className={cn('form-input', titleError && 'border-sale')}
                  value={subjectTitle}
                  onChange={(event) => {
                    setSubjectTitle(event.target.value)
                    setTitleError('')
                    setNotice(null)
                  }}
                  placeholder={selectedChapter?.title ?? 'Ex. Digestif — sujet 1'}
                  aria-invalid={Boolean(titleError)}
                  aria-required="true"
                />
              </Field>

              <Field
                label="Description du sujet"
                htmlFor="subject-description"
                hint="Facultative. Elle apparaît sous le titre du sujet dans la liste."
              >
                <Textarea
                  id="subject-description"
                  rows={4}
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value)
                    setNotice(null)
                  }}
                  placeholder="Ex. Révisions des membranes, organites et cycle cellulaire."
                />
              </Field>

              {subjectsInChapter.length > 0 && !editingSubjectId && (
                <p className="border-l-2 border-accent bg-accent-soft/60 px-3.5 py-3 text-[10px] leading-relaxed text-charcoal">
                  Ce chapitre contient déjà {subjectsInChapter.length} sujet
                  {subjectsInChapter.length > 1 ? 's' : ''}. Vous pouvez en ajouter un autre ou
                  modifier un sujet existant avec le crayon dans la liste.
                </p>
              )}

              <div className="space-y-4">
                <SubjectFileField
                  id="subject-questions-file"
                  label="Fichier du sujet (modèle QCM)"
                  hint="Excel (.xlsx/.xls) ou PDF — une ligne par question avec les options A à D."
                  file={questionsFile}
                  existing={Boolean(existingSubject)}
                  existingName={existingSubject?.questionFileName}
                  error={fileErrors.questions}
                  onChoose={(file) => chooseFile('questions', file)}
                  onClear={() => clearFile('questions')}
                />
                <SubjectFileField
                  id="subject-answers-file"
                  label="Fichier de correction"
                  hint="Excel (.xlsx/.xls) ou PDF — réponse exacte et explication pour chaque question."
                  file={answersFile}
                  existing={Boolean(existingSubject)}
                  existingName={existingSubject?.answerFileName}
                  error={fileErrors.answers}
                  onChoose={(file) => chooseFile('answers', file)}
                  onClear={() => clearFile('answers')}
                />
              </div>

              {canReuseContent && existingSubject && (
                <p className="border-l-2 border-accent bg-accent-soft/60 px-3.5 py-3 text-[10px] leading-relaxed text-charcoal">
                  Le contenu actuel de « {existingSubject.title} » (
                  {existingSubject.questionCount} question
                  {existingSubject.questionCount > 1 ? 's' : ''}) et son corrigé seront
                  conservés. Choisissez les deux nouveaux fichiers uniquement pour remplacer les
                  questions.
                </p>
              )}

              <div className="space-y-2" aria-live="polite">
                {parsing && (
                  <p className="flex items-center gap-2 text-[11px] text-mute">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    Lecture et appariement des deux fichiers…
                  </p>
                )}

                {parseIssues.length > 0 && (
                  <div className="border-l-2 border-sale bg-[#fdf0f0] px-3.5 py-3">
                    <p className="flex items-center gap-2 text-[11px] font-medium text-sale">
                      <AlertCircle className="size-3.5" aria-hidden="true" />
                      Enregistrement bloqué
                    </p>
                    <ul className="mt-1.5 space-y-1 pl-5 text-[10px] leading-relaxed text-charcoal">
                      {parseIssues.slice(0, 8).map((issue) => (
                        <li key={issue} className="list-disc">
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {warnings.length > 0 && (
                  <div className="border-l-2 border-[#b26b00] bg-[#fff8ec] px-3.5 py-3">
                    <p className="text-[11px] font-medium text-[#8a5300]">À vérifier</p>
                    <ul className="mt-1.5 space-y-1 pl-5 text-[10px] leading-relaxed text-charcoal">
                      {warnings.slice(0, 8).map((warning) => (
                        <li key={warning} className="list-disc">
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {parsedReady && enoughQuestions && (
                  <p className="flex items-center gap-2 text-[11px] text-success">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    {parsedQuestions.length} questions appariées avec leur corrigé.
                  </p>
                )}

                {parsedReady && !enoughQuestions && (
                  <p className="flex items-start gap-2 border-l-2 border-[#b26b00] bg-[#fff8ec] px-3.5 py-3 text-[10px] leading-relaxed text-charcoal">
                    <AlertCircle
                      className="mt-0.5 size-3.5 shrink-0 text-[#8a5300]"
                      aria-hidden="true"
                    />
                    {parsedQuestions.length} question
                    {parsedQuestions.length > 1 ? 's' : ''} détectée
                    {parsedQuestions.length > 1 ? 's' : ''}. Une série nécessite au moins{' '}
                    {SERIES_SIZE} questions valides.
                  </p>
                )}

                {questionsFile && answersFile && !parsing && parseResult && (
                  <p className="text-[10px] text-mute">
                    Fichiers choisis : {questionsFile.name} · {answersFile.name}
                  </p>
                )}
              </div>

              {formError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 border-l-2 border-sale bg-[#fdf0f0] px-3.5 py-3 text-[11px] leading-relaxed text-sale"
                >
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {formError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-hairline-soft pt-5">
                <Button
                  type="submit"
                  loading={saving}
                  disabled={parsing || !selectedTheme || chapters.length === 0}
                  className="min-w-[150px] gap-2"
                >
                  {!saving && <Save className="size-3.5" aria-hidden="true" />}
                  Enregistrer
                </Button>
                {(ueId || chapterId || subjectTitle || description || hasAnyFile) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Réinitialiser
                  </Button>
                )}
              </div>
            </form>
          </section>

          <section aria-labelledby="saved-subjects-title" className="border border-hairline bg-white">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline-soft p-5 sm:p-6">
              <div>
                <h2 id="saved-subjects-title" className="text-[18px] font-medium tracking-[-0.01em]">
                  Sujets enregistrés
                </h2>
                <p className="mt-1 max-w-md text-[11px] leading-relaxed text-mute">
                  Tous les sujets disponibles côté étudiant, classés par UE et par chapitre.
                  Utilisez le crayon pour recharger un sujet dans le formulaire.
                </p>
              </div>
              <StatusPill tone={subjects.length > 0 ? 'success' : 'neutral'} dot>
                {subjects.length} sujet{subjects.length > 1 ? 's' : ''}
              </StatusPill>
            </div>

            {subjects.length === 0 ? (
              <p className="m-5 border border-dashed border-hairline bg-cloud/30 px-4 py-10 text-center text-[12px] text-mute sm:m-6">
                Aucun sujet enregistré. Choisissez une UE et un chapitre, puis déposez les deux
                fichiers pour publier le premier sujet.
              </p>
            ) : (
              <ul className="divide-y divide-hairline-soft">
                {subjects.map((subject) => {
                  const theme = subjectTheme(subject)
                  const themeIndex = theme
                    ? PACE_THEMES.findIndex((candidate) => candidate.id === theme.id)
                    : -1
                  const loaded = subject.id === editingSubjectId
                  const fileNames = [subject.questionFileName, subject.answerFileName]
                    .filter((name): name is string => Boolean(name?.trim()))
                    .join(' · ')
                  const hasDescription = Boolean(subject.description.trim())
                  const editable = Boolean(subject.chapterId)

                  return (
                    <li
                      key={subject.id}
                      className={cn(
                        'flex gap-3 px-5 py-4 transition-colors sm:px-6',
                        loaded && 'bg-accent-soft/40',
                      )}
                    >
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-cloud text-[10px] font-semibold tabular-nums text-mute">
                        {themeIndex >= 0 ? String(themeIndex + 1).padStart(2, '0') : '—'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.1em] text-mute">
                              {theme?.title ?? 'Ancien format'} · {subjectChapter(subject)}
                            </p>
                            <h3 className="mt-1 text-[13px] font-medium leading-snug text-ink">
                              {subject.title}
                            </h3>
                          </div>
                          {editable ? (
                            <button
                              type="button"
                              onClick={() => startEdit(subject)}
                              aria-label={`Modifier ${subject.title}`}
                              title="Modifier ce sujet"
                              className="-mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-mute transition-colors hover:bg-cloud hover:text-accent"
                            >
                              <PencilLine
                                className="size-3.5"
                                strokeWidth={1.8}
                                aria-hidden="true"
                              />
                            </button>
                          ) : null}
                        </div>
                        {hasDescription && (
                          <p className="mt-1.5 text-[11px] leading-relaxed text-charcoal">
                            {subject.description}
                          </p>
                        )}
                        <p className="mt-2 text-[10px] uppercase tracking-[0.1em] text-mute">
                          {subject.questionCount} question
                          {subject.questionCount > 1 ? 's' : ''} · Enregistré le{' '}
                          {formatDate(subject.publishedAt)}
                        </p>
                        {fileNames && (
                          <p
                            className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[10px] text-mute"
                            title={fileNames}
                          >
                            <FileText
                              className="size-3 shrink-0"
                              strokeWidth={1.6}
                              aria-hidden="true"
                            />
                            <span className="truncate">{fileNames}</span>
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function SubjectFileField({
  id,
  label,
  hint,
  file,
  existing,
  existingName,
  error,
  onChoose,
  onClear,
}: {
  id: string
  label: string
  hint: string
  file: File | null
  existing: boolean
  existingName?: string
  error?: string
  onChoose: (file: File | undefined) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const storedName = existingName?.trim() || (existing ? 'Fichier déjà enregistré' : '')
  const displayName = file?.name || storedName
  const isPdf = /\.pdf$/i.test(displayName)

  const openPicker = () => inputRef.current?.click()

  return (
    <Field label={label} htmlFor={id} required hint={hint} error={error}>
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept={importAccept}
        className="sr-only"
        aria-label={`Choisir le fichier — ${label}`}
        aria-required="true"
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          onChoose(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <div
        className={cn(
          'flex items-stretch overflow-hidden rounded-[10px] border bg-surface transition',
          error ? 'border-sale' : file ? 'border-accent' : 'border-line',
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3">
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center',
              file ? 'bg-accent-soft text-accent' : 'bg-cloud text-mute',
            )}
          >
            {isPdf ? (
              <FileText className="size-4" strokeWidth={1.6} aria-hidden="true" />
            ) : (
              <FileSpreadsheet className="size-4" strokeWidth={1.6} aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0">
            {displayName ? (
              <span className="block truncate text-[13px] font-medium text-ink" title={displayName}>
                {displayName}
              </span>
            ) : (
              <span className="block text-[13px] text-mute">Aucun fichier sélectionné</span>
            )}
            <span className="mt-0.5 block text-[10px] text-mute">
              {file
                ? `${formatBytes(file.size)} · prêt à être enregistré`
                : storedName
                  ? 'Fichier enregistré · conservez-le ou remplacez-le'
                  : 'Excel (.xlsx/.xls) ou PDF'}
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={openPicker}
          aria-label={`Ouvrir l’explorateur de fichiers — ${label}`}
          title="Parcourir les fichiers"
          className="grid w-11 shrink-0 place-items-center border-l border-line text-mute transition-colors hover:bg-cloud hover:text-ink"
        >
          <FolderOpen className="size-4" strokeWidth={1.7} aria-hidden="true" />
        </button>
        {file && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Retirer le fichier — ${label}`}
            title="Retirer ce fichier"
            className="grid w-9 shrink-0 place-items-center border-l border-line text-sale transition-colors hover:bg-danger-soft"
          >
            <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
    </Field>
  )
}
