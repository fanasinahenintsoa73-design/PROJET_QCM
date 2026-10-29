import * as XLSX from 'xlsx'
import type { QuestionOptions } from '@/types'
import { answerLetters, monthLabel } from '@/lib/utils'
import {
  PACE_THEMES,
  findPaceTheme,
  type PaceThemeDefinition,
  type ThemePackThemeInput,
  type ThemeQuestionInput,
} from '@/lib/themes'

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

async function readRows(
  file: File,
  mode: 'questions' | 'answers' = 'questions',
): Promise<Record<string, unknown>[]> {
  if (isPdfFile(file)) {
    const { readPdfRows } = await import('@/lib/pdf')
    return readPdfRows(file, mode)
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
  E: ['optione', 'e', 'reponsee', 'choixe', 'propositione'],
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
    .replace(/[^A-E]/g, '')
  return [...new Set(cleaned.split(''))].filter((letter) =>
    answerLetters.includes(letter as (typeof answerLetters)[number]),
  )
}

export async function parseQuestionsFile(file: File): Promise<{ rows: RawQuestionRow[]; errors: string[] }> {
  const rows = await readRows(file, 'questions')
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
    const optionE = pick(row, questionAliases.E)
    const options: QuestionOptions = {
      A: pick(row, questionAliases.A),
      B: pick(row, questionAliases.B),
      C: pick(row, questionAliases.C),
      D: pick(row, questionAliases.D),
      ...(optionE ? { E: optionE } : {}),
    }
    const missing = answerLetters
      .filter((letter) => letter !== 'E')
      .filter((letter) => !options[letter])
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
  const rows = await readRows(file, 'answers')
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
      errors.push(`Corrigés, ligne ${line} : réponse « ${rawAnswer || '—'} » invalide (attendu : A, B, C, D ou E).`)
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

const noneOfTheAboveFallback = 'Aucune de ces réponses n’est exacte.'

function isNoneOfTheAboveOption(value: string) {
  const normalized = normalizeHeader(value)
  return (
    normalized === 'aucunedecesreponsesnestexacte' ||
    normalized === 'aucunedepropositionsnestexacte'
  )
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
    const optionE = question.options.E?.trim() ?? ''
    const options =
      answer.correctAnswers.includes('E') &&
      (!optionE || isNoneOfTheAboveOption(optionE))
        ? { ...question.options, E: noneOfTheAboveFallback }
        : question.options
    return [
      {
        ...question,
        options,
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

/* ------------------------------------------------------------------ */
/* Pack des neuf thèmes PACES                                          */
/* ------------------------------------------------------------------ */

export interface ThemeSheetResult {
  themeId: string
  themeTitle: string
  sheetName: string
  questionCount: number
  questions: ThemeQuestionInput[]
  errors: string[]
}

export interface ThemePackParseResult {
  themes: ThemePackThemeInput[]
  sheets: ThemeSheetResult[]
  errors: string[]
  warnings: string[]
}

const themePackColumns = [
  'N° Question',
  'Énoncé',
  'Option A',
  'Option B',
  'Option C',
  'Option D',
  'Réponse exacte',
  'Explication médicale',
] as const

function sheetToRows(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })
}

function parseThemeSheet(
  theme: PaceThemeDefinition,
  sheetName: string,
  rows: Record<string, unknown>[],
): ThemeSheetResult {
  const errors: string[] = []
  const questions: ThemeQuestionInput[] = []

  if (!rows.length) {
    return {
      themeId: theme.id,
      themeTitle: theme.title,
      sheetName,
      questionCount: 0,
      questions,
      errors: [`« ${sheetName} » : la feuille est vide.`],
    }
  }

  const first = rows[0]
  const requiredHeaders = [
    ['number', questionAliases.number, 'N° Question'],
    ['statement', questionAliases.statement, 'Énoncé'],
    ['A', questionAliases.A, 'Option A'],
    ['B', questionAliases.B, 'Option B'],
    ['C', questionAliases.C, 'Option C'],
    ['D', questionAliases.D, 'Option D'],
    ['correct', answerAliases.correct, 'Réponse exacte'],
    ['explanation', answerAliases.explanation, 'Explication médicale'],
  ] as const

  const missingHeaders = requiredHeaders
    .filter(([, aliases]) => !findKey(first, [...aliases]))
    .map(([, , label]) => label)
  if (missingHeaders.length) {
    errors.push(
      `« ${sheetName} » : colonne(s) manquante(s) — ${missingHeaders.join(', ')}.`,
    )
  }

  const seen = new Set<number>()
  rows.forEach((row, index) => {
    const line = index + 2
    const prefix = `« ${sheetName} », ligne ${line}`
    const number = Number(pick(row, questionAliases.number))
    const statement = pick(row, questionAliases.statement)
    const options: QuestionOptions = {
      A: pick(row, questionAliases.A),
      B: pick(row, questionAliases.B),
      C: pick(row, questionAliases.C),
      D: pick(row, questionAliases.D),
    }
    const rawAnswer = pick(row, answerAliases.correct)
    const correctAnswers = parseAnswerLetters(rawAnswer)
    const explanation = pick(row, answerAliases.explanation)

    let rowValid = true
    if (!Number.isInteger(number) || number < 1) {
      errors.push(`${prefix} : numéro de question manquant ou invalide.`)
      rowValid = false
    } else if (seen.has(number)) {
      errors.push(`${prefix} : le numéro ${number} apparaît plusieurs fois.`)
      rowValid = false
    }
    if (!statement) {
      errors.push(`${prefix} : énoncé vide.`)
      rowValid = false
    }
    const missingOptions = answerLetters
      .filter((letter) => letter !== 'E')
      .filter((letter) => !options[letter]?.trim())
    if (missingOptions.length) {
      errors.push(`${prefix} : option(s) ${missingOptions.join(', ')} vide(s).`)
      rowValid = false
    }
    if (correctAnswers.length !== 1 || correctAnswers.includes('E')) {
      errors.push(
        `${prefix} : réponse « ${rawAnswer || '—'} » invalide (une seule lettre A, B, C ou D attendue).`,
      )
      rowValid = false
    }
    if (!explanation) {
      errors.push(`${prefix} : explication médicale manquante.`)
      rowValid = false
    }

    if (!rowValid) return
    seen.add(number)
    questions.push({
      number,
      matiere: theme.title,
      statement,
      options,
      correctAnswers,
      explanation,
    })
  })

  if (questions.length < 10) {
    errors.push(
      `« ${sheetName} » : au moins 10 questions valides sont nécessaires (${questions.length} trouvée(s)).`,
    )
  }

  return {
    themeId: theme.id,
    themeTitle: theme.title,
    sheetName,
    questionCount: questions.length,
    questions: questions.sort((left, right) => left.number - right.number),
    errors,
  }
}

/**
 * Lit un classeur unique contenant une feuille par thème. Chaque feuille porte
 * à la fois l'énoncé et son corrigé. Le pack reste en mémoire : rien n'est
 * publié tant que les neuf feuilles ne sont pas valides.
 */
export async function parseThemePackFile(file: File): Promise<ThemePackParseResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const errors: string[] = []
  const warnings: string[] = []
  const matched = new Map<string, string>()

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const rows = sheet ? sheetToRows(sheet) : []
    const theme = findPaceTheme(sheetName)
    if (!theme) {
      if (rows.length > 0) {
        errors.push(
          `Feuille « ${sheetName} » : aucun thème PACES reconnu. Utilisez le modèle pour nommer les feuilles.`,
        )
      } else {
        warnings.push(`Feuille vide « ${sheetName} » ignorée.`)
      }
      return
    }
    const existing = matched.get(theme.id)
    if (existing) {
      errors.push(
        `« ${theme.title} » apparaît sur deux feuilles (« ${existing} » et « ${sheetName} »).`,
      )
      return
    }
    matched.set(theme.id, sheetName)
  })

  const month = monthLabel()
  const sheets = PACE_THEMES.map<ThemeSheetResult>((theme) => {
    const sheetName = matched.get(theme.id)
    if (!sheetName) {
      return {
        themeId: theme.id,
        themeTitle: theme.title,
        sheetName: '',
        questionCount: 0,
        questions: [],
        errors: [
          `Feuille manquante pour « ${theme.title} ». Téléchargez le modèle à neuf feuilles.`,
        ],
      }
    }
    const rows = sheetToRows(workbook.Sheets[sheetName]!)
    return parseThemeSheet(theme, sheetName, rows)
  })

  const themes: ThemePackThemeInput[] = sheets.map((sheet, index) => ({
    title: PACE_THEMES[index].title,
    description: PACE_THEMES[index].description,
    monthLabel: month,
    questions: sheet.questions,
  }))

  return {
    themes,
    sheets,
    errors: [...errors, ...sheets.flatMap((sheet) => sheet.errors)],
    warnings,
  }
}

/* ------------------------------------------------------------------ */
/* Modèle à neuf feuilles                                              */
/* ------------------------------------------------------------------ */

const templateSheetNames = [
  'Biologie cellulaire',
  'Étude des tissus',
  'Biomolécules',
  'Physiologie',
  'Anatomie viscérale',
  'Biomathématiques',
  'Médicaments',
  'Français médical',
  'UE spécifiques',
]

export function downloadThemePackTemplate() {
  const book = XLSX.utils.book_new()
  PACE_THEMES.forEach((theme, index) => {
    const rows: (string | number)[][] = [
      [...themePackColumns],
      [
        1,
        `Remplacer par l’énoncé de la question 1 — ${theme.title}`,
        'Proposition A',
        'Proposition B',
        'Proposition C',
        'Proposition D',
        'A',
        'Remplacer par l’explication médicale et le raisonnement du corrigé.',
      ],
    ]
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    sheet['!cols'] = [
      { wch: 12 },
      { wch: 70 },
      { wch: 28 },
      { wch: 28 },
      { wch: 28 },
      { wch: 28 },
      { wch: 15 },
      { wch: 70 },
    ]
    XLSX.utils.book_append_sheet(book, sheet, templateSheetNames[index])
  })
  XLSX.writeFile(book, 'MEDQCM-modele-9-themes.xlsx')
}

