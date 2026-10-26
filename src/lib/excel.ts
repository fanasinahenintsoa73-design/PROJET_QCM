import * as XLSX from 'xlsx'
import type { QuestionOptions } from '@/types'
import { answerLetters } from '@/lib/utils'

export interface ParsedQuestionRow {
  number: number
  matiere: string
  statement: string
  options: QuestionOptions
  correctAnswers: string[]
  explanation: string
}

export interface ParseResult {
  questions: ParsedQuestionRow[]
  warnings: string[]
  errors: string[]
}

export interface RawQuestionRow {
  number: number
  matiere: string
  statement: string
  options: QuestionOptions
}

export interface RawAnswerRow {
  number: number
  correctAnswers: string[]
  explanation: string
}

function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function cellString(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

async function readExcelRows(file: File): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Le classeur ne contient aucune feuille.')
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })
}

async function readRows(file: File): Promise<Record<string, unknown>[]> {
  if (isPdfFile(file)) {
    const { readPdfRows } = await import('@/lib/pdf')
    return readPdfRows(file)
  }
  return readExcelRows(file)
}

function findKey(row: Record<string, unknown>, aliases: string[]) {
  const keys = Object.keys(row)
  return keys.find((key) => aliases.includes(normalizeHeader(key)))
}

function pick(row: Record<string, unknown>, aliases: string[]) {
  const key = findKey(row, aliases)
  return key ? cellString(row[key]) : ''
}

const questionAliases = {
  number: ['nquestion', 'no', 'numero', 'num', 'n', 'numquestion', 'questionnumero', 'numeroquestion'],
  matiere: ['matiere', 'discipline', 'module', 'specialite', 'cours'],
  statement: ['enonce', 'question', 'intitule', 'libelle', 'statement', 'enoncequestion'],
  A: ['optiona', 'a', 'reponsea', 'choixa', 'propositiona'],
  B: ['optionb', 'b', 'reponseb', 'choixb', 'propositionb'],
  C: ['optionc', 'c', 'reponsec', 'choixc', 'propositionc'],
  D: ['optiond', 'd', 'reponsed', 'choixd', 'propositiond'],
}

const answerAliases = {
  number: ['nquestion', 'no', 'numero', 'num', 'n', 'numquestion', 'questionnumero', 'numeroquestion'],
  correct: [
    'reponseexacte',
    'reponse',
    'reponses',
    'corrige',
    'bonnereponse',
    'bonnesreponses',
    'answer',
    'answers',
    'solution',
  ],
  explanation: [
    'explicationmedicale',
    'explication',
    'explications',
    'justification',
    'commentaire',
    'explicationmed',
  ],
}

export function parseAnswerLetters(value: string): string[] {
  const cleaned = value
    .toUpperCase()
    .replace(/\bET\b/g, ',')
    .replace(/[^A-D]/g, '')
  return [...new Set(cleaned.split(''))].filter((letter) =>
    answerLetters.includes(letter as (typeof answerLetters)[number]),
  )
}

export async function parseQuestionsFile(file: File): Promise<{ rows: RawQuestionRow[]; errors: string[] }> {
  const rows = await readRows(file)
  const errors: string[] = []
  if (!rows.length) throw new Error('Le fichier Questions est vide.')
  const first = rows[0]
  if (!findKey(first, questionAliases.number)) {
    throw new Error(
      "Colonne « N° Question » introuvable. Le fichier doit contenir : N° Question, Matière, Énoncé, Option A, Option B, Option C, Option D.",
    )
  }
  if (!findKey(first, questionAliases.statement)) {
    throw new Error("Colonne « Énoncé » introuvable dans le fichier Questions.")
  }

  const seen = new Set<number>()
  const parsed: RawQuestionRow[] = []
  rows.forEach((row, index) => {
    const line = index + 2
    const number = Number(pick(row, questionAliases.number))
    const statement = pick(row, questionAliases.statement)
    if (!number || Number.isNaN(number)) {
      errors.push(`Questions, ligne ${line} : numéro de question manquant ou invalide.`)
      return
    }
    if (seen.has(number)) {
      errors.push(`Questions, ligne ${line} : le numéro ${number} apparaît plusieurs fois.`)
      return
    }
    if (!statement) {
      errors.push(`Questions, ligne ${line} : énoncé vide.`)
      return
    }
    const options: QuestionOptions = {
      A: pick(row, questionAliases.A),
      B: pick(row, questionAliases.B),
      C: pick(row, questionAliases.C),
      D: pick(row, questionAliases.D),
    }
    const missing = answerLetters.filter((letter) => !options[letter])
    if (missing.length) {
      errors.push(`Questions, ligne ${line} : option(s) ${missing.join(', ')} vide(s).`)
      return
    }
    seen.add(number)
    parsed.push({
      number,
      matiere: pick(row, questionAliases.matiere) || 'Général',
      statement,
      options,
    })
  })

  if (!parsed.length && !errors.length) errors.push('Aucune question exploitable dans le fichier.')
  if (errors.length) {
    return { rows: parsed, errors: errors.slice(0, 12) }
  }
  return { rows: parsed.sort((a, b) => a.number - b.number), errors: [] }
}

export async function parseAnswersFile(file: File): Promise<{ rows: RawAnswerRow[]; errors: string[] }> {
  const rows = await readRows(file)
  const errors: string[] = []
  if (!rows.length) throw new Error('Le fichier Corrigés est vide.')
  const first = rows[0]
  if (!findKey(first, answerAliases.number)) {
    throw new Error("Colonne « N° Question » introuvable dans le fichier Corrigés.")
  }
  if (!findKey(first, answerAliases.correct)) {
    throw new Error("Colonne « Réponse exacte » introuvable dans le fichier Corrigés.")
  }

  const seen = new Set<number>()
  const parsed: RawAnswerRow[] = []
  rows.forEach((row, index) => {
    const line = index + 2
    const number = Number(pick(row, answerAliases.number))
    const rawAnswer = pick(row, answerAliases.correct)
    const explanation = pick(row, answerAliases.explanation)
    if (!number || Number.isNaN(number)) {
      errors.push(`Corrigés, ligne ${line} : numéro de question invalide.`)
      return
    }
    if (seen.has(number)) {
      errors.push(`Corrigés, ligne ${line} : le numéro ${number} apparaît plusieurs fois.`)
      return
    }
    const correctAnswers = parseAnswerLetters(rawAnswer)
    if (!correctAnswers.length) {
      errors.push(`Corrigés, ligne ${line} : réponse « ${rawAnswer || '—'} » invalide (attendu : A, B, C ou D).`)
      return
    }
    if (!explanation) {
      errors.push(`Corrigés, ligne ${line} : explication médicale manquante.`)
      return
    }
    seen.add(number)
    parsed.push({ number, correctAnswers, explanation })
  })

  if (!parsed.length && !errors.length) errors.push('Aucun corrigé exploitable dans le fichier.')
  if (errors.length) return { rows: parsed, errors: errors.slice(0, 12) }
  return { rows: parsed.sort((a, b) => a.number - b.number), errors: [] }
}

export function mergeQuestionFiles(questionRows: RawQuestionRow[], answerRows: RawAnswerRow[]): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  const answersByNumber = new Map(answerRows.map((row) => [row.number, row]))
  const questionNumbers = new Set(questionRows.map((row) => row.number))

  answerRows.forEach((row) => {
    if (!questionNumbers.has(row.number)) {
      warnings.push(`Le corrigé n° ${row.number} ne correspond à aucune question : il sera ignoré.`)
    }
  })

  const questions = questionRows.flatMap<ParsedQuestionRow>((question) => {
    const answer = answersByNumber.get(question.number)
    if (!answer) {
      errors.push(`La question n° ${question.number} n'a pas de corrigé correspondant.`)
      return []
    }
    return [
      {
        ...question,
        correctAnswers: answer.correctAnswers,
        explanation: answer.explanation,
      },
    ]
  })

  if (errors.length) errors.unshift('Publication bloquée : vérifiez l’appariement des deux fichiers.')
  if (!questions.length && !errors.length) errors.push('Aucune question complète à publier.')
  return { questions, warnings, errors }
}

export async function parseSubjectFiles(questionsFile: File, answersFile: File): Promise<ParseResult> {
  const [questionsResult, answersResult] = await Promise.all([
    parseQuestionsFile(questionsFile),
    parseAnswersFile(answersFile),
  ])
  if (questionsResult.errors.length) {
    return { questions: [], warnings: [], errors: questionsResult.errors }
  }
  if (answersResult.errors.length) {
    return { questions: [], warnings: [], errors: answersResult.errors }
  }
  return mergeQuestionFiles(questionsResult.rows, answersResult.rows)
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

function downloadWorkbook(rows: (string | number)[][], sheetName: string, filename: string) {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = rows[0].map((_, index) => ({ wch: index === 0 ? 12 : index === 2 ? 60 : 28 }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, sheetName)
  XLSX.writeFile(book, filename)
}

export function downloadQuestionsTemplate() {
  downloadWorkbook(
    [
      ['N° Question', 'Matière', 'Énoncé', 'Option A', 'Option B', 'Option C', 'Option D'],
      [
        1,
        'Anatomie',
        'Combien de paires de côtes comporte le squelette thoracique humain ?',
        '10 paires',
        '11 paires',
        '12 paires',
        '14 paires',
      ],
      [
        2,
        'Physiologie',
        'Le débit cardiaque est égal à :',
        'FC ÷ VES',
        'FC × VES',
        'VES × PA',
        'FC + VES',
      ],
    ],
    'Questions',
    'MEDQCM-modele-questions.xlsx',
  )
}

export function downloadAnswersTemplate() {
  downloadWorkbook(
    [
      ['N° Question', 'Réponse exacte', 'Explication médicale'],
      [
        1,
        'C',
        'Le thorax comporte 12 paires de côtes : 7 vraies, 3 fausses et 2 flottantes.',
      ],
      [
        2,
        'B',
        'Le débit cardiaque est le produit de la fréquence cardiaque par le volume d’éjection systolique.',
      ],
    ],
    'Corrigés',
    'MEDQCM-modele-corriges.xlsx',
  )
}
