import type { Subject } from '@/types'

/** Ordre du catalogue : publication, puis identifiant pour départager. */
export function sortSubjectsByPublication(subjects: Subject[]): Subject[] {
  return [...subjects].sort((a, b) => {
    const byDate = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id)
  })
}

export function getSubjectNumber(subjectId: string, subjects: Subject[]): number | undefined {
  const subject = subjects.find((candidate) => candidate.id === subjectId)
  // Un étudiant ne reçoit que les sujets qu'il a travaillés ou qui lui sont
  // proposés. Le titre publié reste donc la source la plus fiable de son
  // numéro ; on retombe sur l'ordre de publication quand il n'en porte pas.
  const titleNumber = subject?.title.match(/^Sujet\s+(\d+)\b/i)
  if (titleNumber) {
    const parsed = Number(titleNumber[1])
    if (Number.isInteger(parsed) && parsed > 0) return parsed
  }
  const index = sortSubjectsByPublication(
    subjects.filter((subject) => !subject.archived),
  ).findIndex((subject) => subject.id === subjectId)
  return index >= 0 ? index + 1 : undefined
}

/** Retire un éventuel préfixe « Sujet N — » du titre publié. */
export function getSubjectTitle(subject: Subject, number?: number): string {
  if (!number) return subject.title
  const match = subject.title.match(
    new RegExp(`^Sujet\\s+${number}\\b\\s*(?:[.:—–-]\\s*)?(.*)$`, 'i'),
  )
  return match ? (match[1]?.trim() ?? '') : subject.title
}
