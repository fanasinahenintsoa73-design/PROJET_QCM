import { getDocument, GlobalWorkerOptions, type PDFPageProxy } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerSrc

interface PdfCell {
  text: string
  x: number
  width: number
  height: number
}

interface PdfLine {
  y: number
  cells: PdfCell[]
  text: string
}

interface PositionedText extends PdfCell {
  y: number
}

interface PdfTextItem {
  str: string
  transform: number[]
  width: number
  height: number
}

const numberHeaderAliases = new Set([
  'nquestion',
  'no',
  'numero',
  'num',
  'n',
  'numquestion',
  'questionnumero',
  'numeroquestion',
])

const headerHints = [
  'question',
  'matiere',
  'enonce',
  'optiona',
  'optionb',
  'optionc',
  'optiond',
  'reponse',
  'explication',
  'corrige',
]

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function isNumberHeader(value: string) {
  return numberHeaderAliases.has(normalize(value))
}

function mergeHeaderCells(cells: PdfCell[]): PdfCell[] {
  const merged: PdfCell[] = []

  for (let index = 0; index < cells.length; index += 1) {
    const current = cells[index]
    const next = cells[index + 1]
    if (!next) {
      merged.push({ ...current })
      continue
    }

    const left = normalize(current.text)
    const right = normalize(next.text)
    const shouldMerge =
      ((left === 'n' || left === 'no' || left === 'num' || left === 'numero') &&
        (right === 'question' || right === 'questions')) ||
      (left === 'option' && /^[abcd]$/.test(right)) ||
      ((left === 'reponse' || left === 'bonne') &&
        (right === 'exacte' || right === 'exactes')) ||
      (left === 'explication' && (right === 'medicale' || right === 'medical')) ||
      (left === 'reponses' && (right === 'exactes' || right === 'exacte'))

    if (shouldMerge) {
      merged.push({
        text: `${current.text} ${next.text}`.replace(/\s+/g, ' ').trim(),
        x: current.x,
        width: next.x + next.width - current.x,
        height: Math.max(current.height, next.height),
      })
      index += 1
    } else {
      merged.push({ ...current })
    }
  }

  return merged
}

function isHeaderLine(cells: PdfCell[]) {
  const merged = mergeHeaderCells(cells)
  const normalized = merged.map((cell) => normalize(cell.text))
  const joined = normalized.join(' ')
  const score = headerHints.filter((hint) => joined.includes(hint)).length
  const hasNumber = merged.some((cell) => isNumberHeader(cell.text))
  return hasNumber && score >= 2
}

function mergeHeaderBlock(lines: PdfLine[], headerIndex: number): PdfCell[] {
  const base = mergeHeaderCells(lines[headerIndex].cells).map((cell) => ({ ...cell }))
  const fragments = new Set([
    'n',
    'no',
    'num',
    'numero',
    'question',
    'questions',
    'option',
    'reponse',
    'reponses',
    'bonne',
    'exacte',
    'exactes',
    'explication',
    'medicale',
    'medical',
    'corrige',
  ])

  for (let index = headerIndex - 1; index <= headerIndex + 1; index += 1) {
    const line = lines[index]
    if (!line || index === headerIndex) continue
    if (Math.abs(line.y - lines[headerIndex].y) > 12) continue

    for (const cell of line.cells) {
      const value = normalize(cell.text)
      if (!fragments.has(value)) continue
      const target = nearestHeader(cell, base)
      const baseValue = normalize(target.text)
      if (!fragments.has(baseValue) || baseValue.includes(value)) continue
      target.text = `${target.text} ${cell.text}`.replace(/\s+/g, ' ').trim()
      target.width = Math.max(target.width, cell.x + cell.width - target.x)
    }
  }

  return base
}

function cellsFromItems(items: PdfCell[]): PdfCell[] {
  const sorted = [...items].sort((left, right) => left.x - right.x)
  const cells: PdfCell[] = []

  for (const item of sorted) {
    const last = cells[cells.length - 1]
    if (!last) {
      cells.push({ ...item })
      continue
    }

    const gap = item.x - (last.x + last.width)
    const tolerance = Math.max(4, ((last.height + item.height) / 2) * 0.7)
    if (gap <= tolerance) {
      last.text = `${last.text} ${item.text}`.replace(/\s+/g, ' ').trim()
      last.width = Math.max(last.width, item.x + item.width - last.x)
      last.height = Math.max(last.height, item.height)
    } else {
      cells.push({ ...item })
    }
  }

  return cells
}

async function extractPageLines(page: PDFPageProxy): Promise<PdfLine[]> {
  const content = await page.getTextContent()
  const positioned: PositionedText[] = []

  for (const item of content.items) {
    if (!('str' in item)) continue
    const textItem = item as PdfTextItem
    const text = textItem.str.replace(/\s+/g, ' ').trim()
    if (!text) continue

    const transform = textItem.transform
    const height = Math.abs(textItem.height || Number(transform[3]) || 10) || 10
    positioned.push({
      text,
      x: Number(transform[4]) || 0,
      y: Number(transform[5]) || 0,
      width: textItem.width || 0,
      height,
    })
  }

  positioned.sort((left, right) => right.y - left.y || left.x - right.x)

  const rawLines: { y: number; items: PositionedText[] }[] = []
  for (const item of positioned) {
    const last = rawLines[rawLines.length - 1]
    const tolerance = Math.max(2, item.height * 0.45)
    if (last && Math.abs(last.y - item.y) <= tolerance) {
      last.items.push(item)
    } else {
      rawLines.push({ y: item.y, items: [item] })
    }
  }

  return rawLines.map((line) => {
    const cells = cellsFromItems(line.items)
    return { y: line.y, cells, text: cells.map((cell) => cell.text).join(' ') }
  })
}

function nearestHeader(cell: PdfCell, headers: PdfCell[]) {
  let nearest = headers[0]
  let distance = Number.POSITIVE_INFINITY

  for (const header of headers) {
    const current = Math.abs(cell.x - header.x)
    if (current < distance) {
      distance = current
      nearest = header
    }
  }

  return nearest
}

function cellsToRecord(cells: PdfCell[], headers: PdfCell[]) {
  const record: Record<string, string> = {}
  for (const cell of cells) {
    const key = nearestHeader(cell, headers).text
    record[key] = `${record[key] ?? ''} ${cell.text}`.trim()
  }
  return record
}

function isNoiseLine(text: string) {
  const cleaned = text.trim()
  return (
    /^\d{1,4}$/.test(cleaned) ||
    /^page\s+\d+/i.test(cleaned) ||
    /^\d+\s*\/\s*\d+$/.test(cleaned)
  )
}

export async function readPdfRows(file: File): Promise<Record<string, unknown>[]> {
  let loadingTask: ReturnType<typeof getDocument> | null = null

  try {
    const data = new Uint8Array(await file.arrayBuffer())
    loadingTask = getDocument({ data })
    const pdf = await loadingTask.promise

    const pages: PdfLine[][] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      pages.push(await extractPageLines(page))
      page.cleanup()
    }

    const withText = pages.some((lines) => lines.length > 0)
    if (!withText) {
      throw new Error(
        'Le PDF ne contient pas de texte sélectionnable. Utilisez un PDF texte ou un fichier Excel.',
      )
    }

    let headers: PdfCell[] | null = null
    const rows: Record<string, string>[] = []

    for (const lines of pages) {
      const headerLine = lines.find((line) => isHeaderLine(line.cells))
      if (headerLine) headers = mergeHeaderBlock(lines, lines.indexOf(headerLine))
      if (!headers) continue

      const numberKey = headers.find((header) => isNumberHeader(header.text))?.text
      if (!numberKey) continue

      const start = headerLine ? lines.indexOf(headerLine) + 1 : 0
      let lastRow: Record<string, string> | undefined

      for (const line of lines.slice(start)) {
        if (isHeaderLine(line.cells) || line.cells.length === 0) continue

        const record = cellsToRecord(line.cells, headers)
        const rawNumber = (record[numberKey] ?? '').trim()

        if (rawNumber && /\d/.test(rawNumber)) {
          record[numberKey] = rawNumber.replace(/[^\d]/g, '') || rawNumber
          const hasContent = headers.some(
            (header) => header.text !== numberKey && (record[header.text] ?? '').trim(),
          )
          if (!hasContent) continue
          rows.push(record)
          lastRow = record
          continue
        }

        if (lastRow && !isNoiseLine(line.text)) {
          for (const cell of line.cells) {
            const key = nearestHeader(cell, headers).text
            if (key === numberKey) continue
            lastRow[key] = `${lastRow[key] ?? ''} ${cell.text}`.trim()
          }
        }
      }
    }

    if (!headers) {
      throw new Error(
        'Impossible de détecter le tableau dans le PDF. Il doit contenir les colonnes N° Question, Matière, Énoncé et Option A à D (ou N° Question, Réponse exacte, Explication médicale).',
      )
    }

    if (!rows.length) {
      throw new Error(
        'Aucune ligne de données détectée dans le PDF. Vérifiez que le tableau est lisible et numéroté.',
      )
    }

    return rows
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'PasswordException') {
        throw new Error('Le PDF est protégé par un mot de passe. Retirez-le avant l’import.')
      }
      if (
        error.message.includes('Impossible de détecter') ||
        error.message.includes('Aucune ligne') ||
        error.message.includes('ne contient pas de texte')
      ) {
        throw error
      }
    }
    throw new Error(
      'Impossible de lire le PDF. Vérifiez qu’il s’agit d’un PDF texte contenant le tableau attendu.',
    )
  } finally {
    if (loadingTask) await loadingTask.destroy()
  }
}
