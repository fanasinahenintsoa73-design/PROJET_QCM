import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  FileText,
  Image as ImageIcon,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { api } from '@/lib/api'
import { chaptersForTheme, PACE_THEMES, themeTitle } from '@/lib/themes'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { usePageTitle } from '@/components/Layouts'
import { formatBytes, readFileAsDataUrl } from '@/lib/utils'
import type { CourseSupport, ExamSubject } from '@/types'

type Kind = 'supports' | 'subjects'

const YEARS = Array.from({ length: 13 }, (_, index) => 2026 - index)

export default function AdminContentPage({ kind }: { kind: Kind }) {
  const isSupports = kind === 'supports'
  usePageTitle(isSupports ? 'Supports du cours — Admin' : 'Sujets de concours — Admin')
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [items, setItems] = useState<Array<CourseSupport | ExamSubject>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [ueId, setUeId] = useState(PACE_THEMES[0]?.id ?? '')
  const [chapterId, setChapterId] = useState('')
  const [year, setYear] = useState(2026)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [existingFile, setExistingFile] = useState<{
    name: string
    mime: string
    path?: string
  } | null>(null)

  const chapters = useMemo(() => chaptersForTheme(ueId), [ueId])

  async function load() {
    setLoading(true)
    try {
      const next = isSupports ? await api.listCourseSupports() : await api.listExamSubjects()
      setItems(next)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les contenus.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [isSupports])

  useEffect(() => {
    if (!chapterId && chapters[0]) setChapterId(chapters[0].id)
    if (chapterId && !chapters.some((chapter) => chapter.id === chapterId)) {
      setChapterId(chapters[0]?.id ?? '')
    }
  }, [chapterId, chapters])

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setFile(null)
    setExistingFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function startEdit(item: CourseSupport | ExamSubject) {
    setEditingId(item.id)
    setUeId(item.ueId)
    setTitle(item.title)
    setDescription(item.description)
    setFile(null)
    setExistingFile({ name: item.fileName, mime: item.mimeType, path: item.storagePath })
    if ('chapterId' in item) setChapterId(item.chapterId)
    if ('year' in item) setYear(item.year)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onFileChange(next: File | null) {
    if (!next) {
      setFile(null)
      return
    }
    const allowed = next.type === 'application/pdf' || next.type.startsWith('image/')
    if (!allowed) {
      setError('Choisissez un fichier PDF ou une image.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if (next.size > 20 * 1024 * 1024) {
      setError('Le fichier doit faire moins de 20 Mo.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setFile(next)
    setError('')
  }

  async function save() {
    if (saving) return
    if (!title.trim()) {
      setError('Le titre est obligatoire.')
      return
    }
    if (isSupports && (!ueId || !chapterId)) {
      setError('Choisissez une UE et un chapitre.')
      return
    }
    if (!file && !existingFile) {
      setError('Ajoutez un fichier PDF ou une image.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const dataUrl = file ? await readFileAsDataUrl(file) : undefined
      const fileName = file?.name ?? existingFile?.name ?? 'document'
      // `file.type` peut être vide sur certains navigateurs : un `??` ne
      // remplacerait pas la chaîne vide et le PDF serait stocké en
      // `application/octet-stream`, impossible à afficher dans le viewer.
      const mimeType = file?.type || existingFile?.mime || 'application/pdf'
      // Sans nouveau fichier, on conserve le chemin déjà stocké.
      const storagePath = file ? undefined : existingFile?.path
      if (isSupports) {
        await api.saveCourseSupport({
          id: editingId ?? undefined,
          ueId,
          chapterId,
          title,
          description,
          fileName,
          mimeType,
          dataUrl,
          storagePath,
        })
      } else {
        await api.saveExamSubject({
          id: editingId ?? undefined,
          year,
          ueId,
          title,
          description,
          fileName,
          mimeType,
          dataUrl,
          storagePath,
        })
      }
      toast(isSupports ? 'Support enregistré.' : 'Sujet enregistré.')
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer le contenu.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: CourseSupport | ExamSubject) {
    if (!window.confirm(`Supprimer « ${item.title} » ?`)) return
    try {
      if (isSupports) await api.deleteCourseSupport(item.id)
      else await api.deleteExamSubject(item.id)
      toast('Contenu supprimé.')
      if (editingId === item.id) resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de supprimer le contenu.')
    }
  }

  return (
    <div className="mx-auto max-w-content px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
            {isSupports ? <BookOpen size={12} /> : <FileText size={12} />}
            {isSupports ? 'Supports du cours' : 'Sujets de concours 2014–2026'}
          </span>
          <h1 className="mt-3 font-display text-[clamp(1.8rem,3.5vw,2.7rem)] leading-tight tracking-[-0.03em] text-ink">
            {isSupports ? 'Gérer les supports' : 'Gérer les sujets de concours'}
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-mute">
            {isSupports
              ? 'Dépose les documents de cours, classe-les par UE et par chapitre. Les étudiants les consultent dans l’application, sans téléchargement.'
              : 'Dépose les sujets d’examen, classe-les par année et par UE. Les étudiants les consultent dans l’application, sans téléchargement.'}
          </p>
        </div>
        <p className="text-[12px] text-mute">{items.length} contenu(s)</p>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-sale/25 bg-sale/5 px-4 py-3 text-[13px] text-sale">
          {error}
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-medium text-ink">
            {editingId ? 'Modifier le contenu' : 'Ajouter un contenu'}
          </h2>
          {editingId && (
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Annuler
            </Button>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {!isSupports && (
            <Field label="Année" required>
              <select
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                className="form-input"
              >
                {YEARS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="UE" required>
            <select
              value={ueId}
              onChange={(event) => setUeId(event.target.value)}
              className="form-input"
            >
              {PACE_THEMES.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.title}
                </option>
              ))}
            </select>
          </Field>

          {isSupports && (
            <Field label="Chapitre" required>
              <select
                value={chapterId}
                onChange={(event) => setChapterId(event.target.value)}
                className="form-input"
              >
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.title}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Titre" required className={isSupports ? '' : 'sm:col-span-2'}>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={isSupports ? 'Ex. Membrane cellulaire — cours' : 'Ex. Sujet 2024 — UE1'}
            />
          </Field>

          <Field label="Description" className="sm:col-span-2">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Description facultative"
            />
          </Field>

          <Field
            label="Fichier PDF ou image"
            hint={
              existingFile
                ? `Fichier actuel : ${existingFile.name}. Choisissez un nouveau fichier pour le remplacer.`
                : 'PDF, JPG, PNG ou WebP. 20 Mo maximum.'
            }
            className="sm:col-span-2"
          >
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line bg-canvas px-4 text-[12px] font-medium text-ink transition hover:border-accent">
                <Upload size={14} /> Choisir un fichier
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(event) => void onFileChange(event.target.files?.[0] ?? null)}
                />
              </label>
              {file ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-mute">
                  {file.type.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
                  {file.name} · {formatBytes(file.size)}
                </span>
              ) : existingFile ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-mute">
                  <FileText size={14} /> {existingFile.name}
                </span>
              ) : (
                <span className="text-[12px] text-mute">Aucun fichier choisi.</span>
              )}
            </div>
          </Field>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={() => void save()} loading={saving}>
            {editingId ? <Pencil size={15} /> : <Plus size={15} />}
            {editingId ? 'Enregistrer les modifications' : 'Ajouter le contenu'}
          </Button>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[14px] font-medium text-ink">Contenus déposés</h2>
        </div>
        {loading ? (
          <div className="flex min-h-[25vh] items-center justify-center">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-mute">
            Aucun contenu pour le moment.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">{item.title}</p>
                  <p className="mt-1 text-[11px] text-mute">
                    {isSupports
                      ? `${themeTitle(item.ueId)} · ${
                          chaptersForTheme(item.ueId).find(
                            (chapter) => chapter.id === (item as CourseSupport).chapterId,
                          )?.title ?? ''
                        }`
                      : `${(item as ExamSubject).year} · ${themeTitle(item.ueId)}`}
                    {' · '}
                    {item.fileName}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="secondary" size="sm" onClick={() => startEdit(item)}>
                    <Pencil size={14} /> Modifier
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => void remove(item)}>
                    <Trash2 size={14} /> Supprimer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export function AdminCourseSupportsPage() {
  return <AdminContentPage kind="supports" />
}

export function AdminExamSubjectsPage() {
  return <AdminContentPage kind="subjects" />
}
