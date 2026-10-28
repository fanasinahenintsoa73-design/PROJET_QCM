import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Loader2,
  Save,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import {
  getActiveAssignment,
  getPublishedSubjects,
} from '@/lib/db'
import {
  downloadAnswersTemplate,
  downloadQuestionsTemplate,
  parseSubjectFiles,
  type ParseResult,
} from '@/lib/excel'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { StatusPill } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/Toast'
import { usePageTitle } from '@/components/Layouts'
import { cn, formatBytes, formatDate, isExpired, monthLabel } from '@/lib/utils'
import type { Subject } from '@/types'

const importAccept =
  '.xlsx,.xls,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'

export default function AdminSubjectPage() {
  usePageTitle('Sujets — Espace docteur')
  const navigate = useNavigate()
  const { db, refresh } = useAuth()
  const { toast } = useToast()

  const subjects = getPublishedSubjects(db)
  const assignmentsFor = (subjectId: string) =>
    db.assignments.filter((assignment) => assignment.subjectId === subjectId)
  const attemptsFor = (subjectId: string) =>
    db.attempts.filter((attempt) => attempt.subjectId === subjectId)
  const totalAssigned = db.assignments.length

  const [questionsFile, setQuestionsFile] = useState<File | null>(null)
  const [answersFile, setAnswersFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [title, setTitle] = useState(`Sujet ${subjects.length + 1} — ${monthLabel()}`)
  const [description, setDescription] = useState('')
  const [label, setLabel] = useState(monthLabel())
  const [titleError, setTitleError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState<Subject | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Subject | null>(null)
  const [removing, setRemoving] = useState(false)
  const [assignTarget, setAssignTarget] = useState<Subject | null>(null)
  const [assignStudentId, setAssignStudentId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')
  const [embedded, setEmbedded] = useState(false)

  const students = db.users
    .filter((student) => student.role === 'student')
    .sort((left, right) =>
      `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`, 'fr'),
    )

  const assignCandidates = assignTarget
    ? students.map((student) => {
        const alreadyAssigned = db.assignments.some(
          (assignment) =>
            assignment.userId === student.id && assignment.subjectId === assignTarget.id,
        )
        const active = getActiveAssignment(student.id, db)
        const activeSubject = active
          ? db.subjects.find((candidate) => candidate.id === active.subjectId)
          : undefined
        const pending = db.requests.some(
          (request) => request.userId === student.id && request.status === 'pending',
        )
        return {
          student,
          alreadyAssigned,
          active,
          activeSubject,
          pending,
          disabled: alreadyAssigned || Boolean(active),
        }
      })
    : []
  const selectedCandidate = assignCandidates.find(
    (candidate) => candidate.student.id === assignStudentId,
  )

  useEffect(() => {
    setEmbedded(window.self !== window.top)
  }, [])

  useEffect(() => {
    if (window.location.hash !== '#importer') return
    const timer = window.setTimeout(() => {
      document.getElementById('importer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!questionsFile || !answersFile) {
      setParseResult(null)
      setParsing(false)
      return
    }
    let cancelled = false
    setParsing(true)
    setUploadError('')
    parseSubjectFiles(questionsFile, answersFile)
      .then((result) => {
        if (!cancelled) setParseResult(result)
      })
      .catch((caught) => {
        if (cancelled) return
        setParseResult(null)
        setUploadError(
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
  }, [questionsFile, answersFile])

  const questions = parseResult?.questions ?? []
  const ready = questions.length > 0 && !parseResult?.errors.length && !parsing
  const warnings = parseResult?.warnings ?? []
  const errors = [...(uploadError ? [uploadError] : []), ...(parseResult?.errors ?? [])]

  const chooseFile = (file: File | undefined, setter: (value: File | null) => void) => {
    if (!file) return
    if (!/\.(xlsx|xls|pdf)$/i.test(file.name)) {
      setUploadError('Format non pris en charge. Importez un fichier Excel (.xlsx/.xls) ou PDF (.pdf).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Fichier trop volumineux (10 Mo maximum).')
      return
    }
    setUploadError('')
    setPublished(null)
    setter(file)
  }

  const openConfirm = () => {
    if (!ready) {
      setUploadError(
        'Importez les deux fichiers et vérifiez que chaque question possède une bonne réponse et une explication avant l’enregistrement.',
      )
      return
    }
    if (!title.trim()) {
      setTitleError('Donnez un titre au sujet avant de l’enregistrer.')
      return
    }
    if (!label.trim()) {
      setTitleError('Le mois affiché est obligatoire.')
      return
    }
    setTitleError('')
    setConfirming(true)
  }

  const handlePublish = async () => {
    if (!ready || publishing) return
    setPublishing(true)
    try {
      const subject = await api.publishSubject({
        title: title.trim(),
        description: description.trim(),
        monthLabel: label.trim(),
        questions,
      })
      await refresh()
      setConfirming(false)
      setPublished(subject)
      setQuestionsFile(null)
      setAnswersFile(null)
      setParseResult(null)
      setDescription('')
      setTitle(`Sujet ${subjects.length + 1} — ${monthLabel()}`)
      setLabel(monthLabel())
      toast(
        'Sujet enregistré et ajouté à la file. Vous pouvez l’attribuer dès maintenant.',
        'success',
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Enregistrement impossible.', 'error')
    } finally {
      setPublishing(false)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget || removing) return
    setRemoving(true)
    try {
      await api.removeSubject(removeTarget.id)
      await refresh()
      toast('Sujet retiré de la file.', 'success')
      setRemoveTarget(null)
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Retrait impossible.', 'error')
    } finally {
      setRemoving(false)
    }
  }

  const openAssign = (subject: Subject) => {
    setAssignTarget(subject)
    setAssignStudentId('')
    setAssignError('')
  }

  const closeAssign = () => {
    if (assigning) return
    setAssignTarget(null)
    setAssignStudentId('')
    setAssignError('')
  }

  const handleAssign = async () => {
    if (!assignTarget || !selectedCandidate || selectedCandidate.disabled || assigning) return
    setAssigning(true)
    setAssignError('')
    try {
      await api.assignSubjectToStudent(assignTarget.id, selectedCandidate.student.id)
      await refresh()
      toast(
        `Sujet attribué à ${selectedCandidate.student.firstName} ${selectedCandidate.student.lastName}. Accès QCM ouvert pour 30 jours.`,
        'success',
      )
      setAssignTarget(null)
      setAssignStudentId('')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (caught) {
      setAssignError(caught instanceof Error ? caught.message : 'Attribution impossible.')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="bg-canvas">
      <section className="border-b border-hairline-soft">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 sm:py-9 lg:px-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="eyebrow text-mute">Parcours QCM</p>
              <h1 className="display mt-3 text-[clamp(2.8rem,6vw,4.5rem)]">File de sujets.</h1>
              <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-mute">
                Préparez plusieurs sujets à l’avance. Chaque étudiant reçoit un seul sujet à la
                fois, pour 30 jours à partir de l’acceptation de sa demande. Au renouvellement,
                l’étudiant choisit entre reprendre son sujet actuel et passer au suivant dans la
                file.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="#importer"
                className="inline-flex items-center gap-2 border border-hairline bg-white px-3.5 py-2 text-[10px] font-medium transition-colors hover:border-ink"
              >
                <FolderOpen className="size-3.5" aria-hidden="true" />
                Importer des fichiers
              </a>
              <StatusPill tone={subjects.length > 0 ? 'success' : 'neutral'} dot>
                {subjects.length} sujet{subjects.length > 1 ? 's' : ''} en file
              </StatusPill>
              <StatusPill tone="neutral" dot>
                {totalAssigned} attribution{totalAssigned > 1 ? 's' : ''}
              </StatusPill>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {published && (
          <div className="mb-7 flex items-start gap-3 border border-success/30 bg-[#f3faf5] px-4 py-3.5">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={1.8} />
            <div>
              <p className="text-[12px] font-medium text-ink">Sujet enregistré dans la file.</p>
              <p className="mt-1 text-[11px] leading-relaxed text-charcoal">
                « {published.title} » et ses deux fichiers sont enregistrés. Il est maintenant
                dans la file.
                l’accès QCM d’un étudiant, ou laissez-le disponible pour l’acceptation d’une
                demande.
              </p>
            </div>
          </div>
        )}

        <section className="border-b border-hairline pb-8" aria-labelledby="queue-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="queue-title" className="text-[18px] font-medium tracking-[-0.01em]">
                Sujets en file
              </h2>
              <p className="mt-1 text-[11px] text-mute">
                Au renouvellement, l’étudiant choisit le sujet suivant dans cet ordre. Vous pouvez
                aussi attribuer un sujet manuellement à un étudiant.
              </p>
            </div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-mute">
              Ordre d’attribution
            </p>
          </div>

          {subjects.length === 0 ? (
            <p className="mt-4 border border-dashed border-hairline bg-cloud/30 px-4 py-8 text-center text-[12px] text-mute">
              Aucun sujet dans la file. Enregistrez un premier sujet avant d’accepter une demande.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {subjects.map((subject, index) => {
                const assigned = assignmentsFor(subject.id)
                const attempts = attemptsFor(subject.id)
                const canRemove = assigned.length === 0 && attempts.length === 0
                return (
                  <article key={subject.id} className="flex flex-col justify-between border border-hairline bg-white p-4 sm:p-5">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-white">
                          {index + 1}
                        </span>
                        <span className={cn(
                          'text-[9px] font-semibold uppercase tracking-[0.12em]',
                          assigned.length > 0 ? 'text-success' : 'text-mute',
                        )}>
                          {assigned.length > 0
                            ? `${assigned.length} étudiant${assigned.length > 1 ? 's' : ''}`
                            : 'Non attribué'}
                        </span>
                      </div>
                      <h3 className="mt-3 text-[14px] font-medium leading-snug">{subject.title}</h3>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-mute">
                        {subject.monthLabel} · {subject.questionCount} questions
                      </p>
                      {subject.description && (
                        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-charcoal">
                          {subject.description}
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-hairline-soft pt-3">
                      <span className="text-[10px] text-mute">
                        Ajouté le {formatDate(subject.publishedAt)}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openAssign(subject)}
                          className="inline-flex items-center gap-1.5 text-[10px] font-medium text-ink hover:opacity-70"
                        >
                          <UserPlus className="size-3" aria-hidden="true" />
                          Attribuer
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(subject)}
                          disabled={!canRemove}
                          title={
                            canRemove
                              ? undefined
                              : 'Ce sujet a déjà été attribué ou possède un historique et ne peut pas être retiré.'
                          }
                          className={cn(
                            'inline-flex items-center gap-1.5 text-[10px] font-medium',
                            canRemove
                              ? 'text-sale hover:opacity-70'
                              : 'cursor-not-allowed text-mute/50',
                          )}
                        >
                          <Trash2 className="size-3" aria-hidden="true" />
                          Retirer
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section id="importer" className="scroll-mt-[130px] pt-8">
          <div>
            <h2 className="text-[18px] font-medium tracking-[-0.01em]">Importer les fichiers</h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-mute">
              Utilisez le bouton noir ci-dessous pour ouvrir l’explorateur de fichiers. Choisissez
              le fichier des questions puis celui des corrigés, au format Excel ou PDF. Le corrigé
              est obligatoire : chaque question doit avoir une réponse exacte et une explication.
              Un modèle vierge reste téléchargeable en bas de chaque bloc.
            </p>
          </div>

          {embedded && (
            <div className="mt-4 border border-accent bg-accent px-5 py-4 text-white">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
                <div>
                  <p className="text-[12px] font-medium">
                    L’aperçu intégré bloque l’explorateur de fichiers.
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/70">
                    Ouvrez l’application dans un onglet, puis cliquez sur le bouton de sélection
                    des fichiers.
                  </p>
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 bg-white px-4 py-2.5 text-[11px] font-medium text-ink transition hover:bg-cloud"
                  >
                    Ouvrir l’application dans un onglet
                  </a>
                  <p className="mt-2 break-all text-[9px] text-white/50">
                    Adresse : {window.location.href}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <FileDropzone
              id="questions-file"
              label="Questions"
              columns="N° · Matière · Énoncé · Options A à D"
              file={questionsFile}
              onChoose={(file) => chooseFile(file, setQuestionsFile)}
              onRemove={() => setQuestionsFile(null)}
              onTemplate={downloadQuestionsTemplate}
            />
            <FileDropzone
              id="answers-file"
              label="Corrigés"
              columns="N° · Réponse exacte · Explication"
              file={answersFile}
              onChoose={(file) => chooseFile(file, setAnswersFile)}
              onRemove={() => setAnswersFile(null)}
              onTemplate={downloadAnswersTemplate}
            />
          </div>

          <div className="mt-4 space-y-2">
            {parsing && (
              <p className="flex items-center gap-2 text-[11px] text-mute">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Lecture des fichiers…
              </p>
            )}
            {errors.length > 0 && (
              <div className="border-l-2 border-sale bg-[#fdf0f0] px-3.5 py-3">
                <p className="flex items-center gap-2 text-[11px] font-medium text-sale">
                  <AlertCircle className="size-3.5" aria-hidden="true" />
                  Ajout bloqué
                </p>
                <ul className="mt-1.5 space-y-1 pl-5 text-[10px] leading-relaxed text-charcoal">
                  {errors.slice(0, 8).map((error) => (
                    <li key={error} className="list-disc">
                      {error}
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
            {ready && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-success">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                <span>
                  {questions.length} questions appariées. Le corrigé est enregistré avec le sujet.
                </span>
              </div>
            )}
          </div>
        </section>

        {questions.length > 0 && (
          <section className="mt-9 border-t border-hairline pt-7">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-[18px] font-medium tracking-[-0.01em]">Aperçu</h2>
                <p className="mt-1 text-[11px] text-mute">
                  {questions.length} question{questions.length > 1 ? 's' : ''} · corrigé intégré
                </p>
              </div>
            </div>
            <div className="mt-4 max-h-[420px] overflow-auto border border-hairline">
              <table className="w-full min-w-[680px] border-collapse text-left text-[11px]">
                <thead className="sticky top-0 bg-cloud">
                  <tr className="border-b border-hairline">
                    {['N°', 'Matière', 'Énoncé', 'Réponse', 'Explication'].map((heading) => (
                      <th
                        key={heading}
                        className="whitespace-nowrap px-3 py-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-mute"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {questions.map((question) => (
                    <tr key={question.number} className="border-b border-hairline-soft align-top">
                      <td className="px-3 py-3 font-medium tabular-nums">{question.number}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-charcoal">{question.matiere}</td>
                      <td className="max-w-[260px] px-3 py-3 text-charcoal">{question.statement}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-medium">
                        {question.correctAnswers.join(', ')}
                      </td>
                      <td className="max-w-[280px] px-3 py-3 text-mute">{question.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section
          id="enregistrer"
          className="mt-9 scroll-mt-[130px] border-t border-hairline pt-7"
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={openConfirm} className="gap-2">
              <Save className="size-3.5" aria-hidden="true" />
              Enregistrer le sujet
            </Button>
          </div>
        </section>

        <details className="group mt-8 border border-hairline">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[11px] font-medium [&::-webkit-details-marker]:hidden">
            Format attendu des fichiers
            <ChevronDown className="size-4 text-mute transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid gap-5 border-t border-hairline px-4 py-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                Questions
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-charcoal">
                N° Question, Matière, Énoncé, Option A, Option B, Option C, Option D
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                Corrigés
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-charcoal">
                N° Question, Réponse exacte (A, B, C ou D), Explication médicale
              </p>
            </div>
            <p className="text-[10px] leading-relaxed text-mute sm:col-span-2">
              Formats acceptés : Excel (.xlsx/.xls) ou PDF texte. Le PDF doit contenir un tableau
              avec ces mêmes colonnes ; les PDF scannés en image ne sont pas lisibles.
            </p>
          </div>
        </details>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        size="md"
        eyebrow="File de sujets"
        title="Enregistrer ce sujet ?"
        footer={
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={handlePublish}
              loading={publishing}
              disabled={!ready}
              className="gap-2"
            >
              <Save className="size-3.5" aria-hidden="true" />
              Enregistrer le sujet
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-charcoal">
            Le sujet et ses deux fichiers seront enregistrés ensemble, puis placés après les
            sujets déjà en file. Il ne déclenche aucun accès tant que vous ne l’attribuez pas ou
            qu’une demande n’est pas acceptée, et n’archive aucun autre sujet.
          </p>
          <dl className="border-y border-hairline text-[12px]">
            <div className="flex justify-between gap-4 border-b border-hairline py-2.5">
              <dt className="text-mute">Titre</dt>
              <dd className="text-right font-medium">{title || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-hairline py-2.5">
              <dt className="text-mute">Mois</dt>
              <dd className="text-right font-medium">{label || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-hairline py-2.5">
              <dt className="text-mute">Questions</dt>
              <dd className="text-right font-medium">{questions.length}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-mute">Position</dt>
              <dd className="text-right font-medium">Sujet {subjects.length + 1}</dd>
            </div>
          </dl>
          <p className="bg-cloud px-3 py-2.5 text-[10px] leading-relaxed text-mute">
            L’étudiant ne peut pas retirer son sujet. Seul le docteur peut retirer un sujet
            non attribué de la file.
          </p>
        </div>
      </Modal>

      <Modal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        size="md"
        eyebrow="File de sujets"
        title="Retirer ce sujet ?"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setRemoveTarget(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleRemove}
              loading={removing}
              className="gap-2"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Retirer de la file
            </Button>
          </div>
        }
      >
        {removeTarget && (
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-charcoal">
              « {removeTarget.title} » sera supprimé de la file avec ses questions. Cette action
              est définitive.
            </p>
            <p className="bg-cloud px-3 py-2.5 text-[10px] leading-relaxed text-mute">
              Un sujet déjà attribué à un étudiant ne peut pas être retiré, afin de préserver son
              historique. Archivez-le si vous ne voulez plus le proposer.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={!!assignTarget}
        onClose={closeAssign}
        size="md"
        eyebrow="Attribution manuelle"
        title={assignTarget ? `Attribuer « ${assignTarget.title} »` : 'Attribuer un sujet'}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeAssign}
              disabled={assigning}
            >
              Annuler
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAssign}
              loading={assigning}
              disabled={!selectedCandidate || selectedCandidate.disabled}
              className="gap-2"
            >
              <UserPlus className="size-3.5" aria-hidden="true" />
              Attribuer le sujet
            </Button>
          </div>
        }
      >
        {assignTarget && (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-charcoal">
              L’étudiant choisi recevra immédiatement ce sujet et son accès QCM de 30 jours
              démarrera maintenant. Un seul sujet actif est autorisé par étudiant.
            </p>

            {assignError && (
              <p className="border-l-2 border-sale bg-[#fdf0f0] px-3.5 py-3 text-[11px] leading-relaxed text-sale">
                {assignError}
              </p>
            )}

            <div className="border-y border-hairline">
              {assignCandidates.map(
                ({ student, alreadyAssigned, active, activeSubject, pending, disabled }) => (
                  <label
                    key={student.id}
                    className={cn(
                      'flex gap-3 border-b border-hairline-soft px-2 py-3 last:border-b-0',
                      disabled
                        ? 'cursor-not-allowed opacity-55'
                        : 'cursor-pointer hover:bg-cloud/40',
                    )}
                  >
                    <input
                      type="radio"
                      name="assign-student"
                      value={student.id}
                      checked={assignStudentId === student.id}
                      disabled={disabled}
                      onChange={() => {
                        setAssignStudentId(student.id)
                        setAssignError('')
                      }}
                      className="mt-1 size-3.5 shrink-0 accent-ink"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[12px] font-medium">
                          {student.firstName} {student.lastName}
                        </span>
                        {pending && !active && !alreadyAssigned && (
                          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8a5300]">
                            Demande en attente
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-mute">
                        {student.email}
                      </span>
                      <span
                        className={cn(
                          'mt-1 block text-[10px] leading-relaxed',
                          disabled ? 'text-mute' : 'text-charcoal',
                        )}
                      >
                        {alreadyAssigned
                          ? 'Ce sujet lui a déjà été attribué.'
                          : active
                            ? `Cycle actif jusqu’au ${formatDate(active.expiresAt)}${
                                activeSubject ? ` · ${activeSubject.title}` : ''
                              }`
                            : pending
                              ? 'Sa demande en attente sera validée et son accès activé.'
                              : isExpired(student.expiresAt)
                                ? 'Accès expiré — sera réactivé pour 30 jours.'
                                : student.status === 'rejected'
                                  ? 'Accès refusé — sera réactivé pour 30 jours.'
                                  : 'Disponible — aucun cycle actif.'}
                      </span>
                    </span>
                  </label>
                ),
              )}
            </div>

            {assignCandidates.length === 0 && (
              <p className="border border-dashed border-hairline px-4 py-6 text-center text-[11px] text-mute">
                Aucun étudiant n’est enregistré dans la base.
              </p>
            )}

            {assignCandidates.length > 0 && assignCandidates.every((candidate) => candidate.disabled) && (
              <p className="bg-cloud px-3 py-2.5 text-[10px] leading-relaxed text-mute">
                Tous les étudiants ont déjà reçu ce sujet ou disposent d’un cycle actif. Attendez
                la fin d’un cycle ou choisissez un autre sujet.
              </p>
            )}

            <p className="bg-cloud px-3 py-2.5 text-[10px] leading-relaxed text-mute">
              L’attribution est immédiate. Le sujet reste dans la file et peut encore être
              attribué à d’autres étudiants, mais il ne pourra plus être retiré.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}

function FileDropzone({
  id,
  label,
  columns,
  file,
  onChoose,
  onRemove,
  onTemplate,
}: {
  id: string
  label: string
  columns: string
  file: File | null
  onChoose: (file: File | undefined) => void
  onRemove: () => void
  onTemplate: () => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChoose(event.target.files?.[0])
    event.target.value = ''
  }

  const openFilePicker = () => {
    if (window.self !== window.top) {
      window.open(window.location.href, '_blank', 'noopener,noreferrer')
      return
    }
    fileInputRef.current?.click()
  }

  const renderFileInput = (className: string) => (
    <input
      id={id}
      ref={fileInputRef}
      type="file"
      accept={importAccept}
      className={className}
      onChange={handleFile}
      aria-label={`Choisir le fichier — ${label}`}
    />
  )

  if (file) {
    return (
      <div className="flex flex-col border border-hairline bg-white">
        <div className="flex flex-1 flex-col justify-between p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center bg-cloud text-ink">
              {file.name.toLowerCase().endsWith('.pdf') ? (
                <FileText className="size-4" strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <FileSpreadsheet className="size-4" strokeWidth={1.5} aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-success">
                Fichier enregistré
              </p>
              <p className="mt-1 truncate text-[12px] font-medium">{file.name}</p>
              <p className="mt-0.5 text-[10px] text-mute">
                {file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Excel'} ·{' '}
                {formatBytes(file.size)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <button
              type="button"
              onClick={openFilePicker}
              className="inline-flex min-h-9 items-center text-[11px] font-medium underline decoration-1 underline-offset-4 hover:text-mute"
            >
              Remplacer le fichier
            </button>
            {renderFileInput('sr-only')}
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-sale hover:opacity-70"
            >
              <Trash2 className="size-3" aria-hidden="true" />
              Retirer
            </button>
          </div>
                  </div>
              </div>
    )
  }

  return (
    <div className="flex flex-col border border-hairline bg-white">
      <div
        onClick={(event) => {
          const target = event.target as HTMLElement
          if (target.closest('button, input, a')) return
          openFilePicker()
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          onChoose(event.dataTransfer.files[0])
        }}
        className={cn(
          'group flex flex-1 cursor-pointer flex-col items-center justify-center px-5 py-7 text-center transition-colors',
          dragOver ? 'bg-cloud' : 'bg-cloud/25 hover:bg-cloud/60',
        )}
      >
        <span className="grid size-10 place-items-center rounded-full bg-white text-mute transition-colors group-hover:text-ink">
          <Upload className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span className="mt-3 text-[13px] font-medium">{label}</span>
        <span className="mt-1 text-[10px] text-mute">{columns}</span>
        {renderFileInput('sr-only')}
        <span className="mt-2 text-[10px] text-mute">
          Glissez-déposez votre fichier Excel ou PDF
        </span>
      </div>
          </div>
  )
}
