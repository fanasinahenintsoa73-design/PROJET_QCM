import type { QuestionOptions } from '@/types'

/**
 * Les neuf thèmes PACES publiés ensemble par le docteur.
 * L'ordre de ce tableau est l'ordre officiel affiché aux étudiants.
 */
export interface PaceThemeDefinition {
  id: string
  title: string
  description: string
  /** Noms de feuilles Excel acceptés en plus du titre complet. */
  aliases: readonly string[]
}

export const PACE_THEMES: readonly PaceThemeDefinition[] = [
  {
    id: 'theme_biologie_cellulaire',
    title: 'Biologie cellulaire S1 et S2',
    description:
      'Membrane, organites, cycle cellulaire et mécanismes fondamentaux de la cellule eucaryote.',
    aliases: ['biologie cellulaire', 'biologie de la cellule'],
  },
  {
    id: 'theme_etude_des_tissus',
    title: 'Étude des tissus S1 et S2',
    description:
      'Épithéliums, tissus conjonctifs, muscle, sang et organisation microscopique des organes.',
    aliases: ['etude des tissus', 'histologie', 'tissus'],
  },
  {
    id: 'theme_biomolecules',
    title: 'Structure et fonction des biomolécules',
    description:
      'Glucides, lipides, protéines, acides nucléiques et grandes voies du métabolisme.',
    aliases: ['structure et fonction des biomolecules', 'biomolecules', 'biochimie'],
  },
  {
    id: 'theme_physiologie',
    title: 'Physiologie S1 et S2',
    description:
      'Fonctions cardiovasculaire, respiratoire, rénale, digestive et endocrine chez l’adulte.',
    aliases: ['physiologie', 'physiologie humaine'],
  },
  {
    id: 'theme_anatomie_viscerale',
    title: 'Anatomie viscérale',
    description:
      'Organes du thorax, de l’abdomen et du bassin, rapports anatomiques et vascularisation.',
    aliases: ['anatomie viscerale', 'anatomie des visceres'],
  },
  {
    id: 'theme_biomathematiques',
    title: 'Biomathématiques, Biophysique, Statistiques',
    description:
      'Calculs biologiques, unités, probabilités, statistiques descriptives et biophysique.',
    aliases: [
      'biomathematiques biophysique statistiques',
      'biomathematiques biophysique',
      'biomathematiques',
      'biostatistiques',
    ],
  },
  {
    id: 'theme_medicaments',
    title: 'Initiation à la connaissance des médicaments',
    description:
      'Pharmacocinétique, pharmacodynamie, classes thérapeutiques et effets indésirables.',
    aliases: [
      'initiation a la connaissance des medicaments',
      'medicaments',
      'pharmacologie',
      'initiation aux medicaments',
    ],
  },
  {
    id: 'theme_francais_medical',
    title: 'Français médical',
    description:
      'Vocabulaire clinique, terminologie, abréviations et communication avec le patient.',
    aliases: ['francais medical', 'francais medical et communication', 'terminologie medicale'],
  },
  {
    id: 'theme_ue_specifiques',
    title: 'Unités d’enseignements spécifiques',
    description:
      'Santé publique, éthique, droit de la santé, prévention et qualité des soins.',
    aliases: [
      'unites d enseignements specifiques',
      'unites d enseignements',
      'ue specifiques',
      'ue specifique',
    ],
  },
]

export interface ThemeQuestionInput {
  number: number
  matiere: string
  statement: string
  options: QuestionOptions
  correctAnswers: string[]
  explanation: string
}

export interface ThemePackThemeInput {
  title: string
  description: string
  monthLabel: string
  questions: ThemeQuestionInput[]
}

export interface ThemePackInput {
  themes: ThemePackThemeInput[]
}

/**
 * Enregistrement d'un sujet depuis l'espace docteur. Sans `questions`, seules
 * les informations du sujet sont mises à jour : le contenu déjà publié et son
 * corrigé sont conservés.
 */
export interface SaveSubjectInput {
  themeId: string
  title: string
  description: string
  monthLabel: string
  questions?: ThemeQuestionInput[]
  questionFileName?: string
  answerFileName?: string
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

/** Minuscule, sans accents ni ponctuation : sert à apparier les feuilles Excel. */
export function normalizeThemeKey(value: string) {
  return normalizeSpaces(
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[’']/g, ' ')
      .replace(/[^a-z0-9]+/g, ' '),
  )
}

function stripSheetPrefix(value: string) {
  return normalizeSpaces(
    value
      .replace(/^(?:theme|feuille|onglet)\s*\d{1,2}\s*[-—:.)]?\s*/i, '')
      .replace(/^\d{1,2}\s*[-—:.)]?\s*/, ''),
  )
}

function themeKeys(theme: PaceThemeDefinition) {
  return [theme.title, ...theme.aliases].map((value) =>
    stripSheetPrefix(normalizeThemeKey(value)),
  )
}

/** Retrouve un thème à partir d'un titre complet ou d'un nom de feuille abrégé. */
export function findPaceTheme(value: string): PaceThemeDefinition | undefined {
  const key = stripSheetPrefix(normalizeThemeKey(value))
  if (!key) return undefined
  const matches = PACE_THEMES.filter((theme) =>
    themeKeys(theme).some((candidate) => {
      if (!candidate) return false
      if (candidate === key) return true
      const shortest = Math.min(candidate.length, key.length)
      return shortest >= 8 && (candidate.startsWith(key) || key.startsWith(candidate))
    }),
  )
  return matches.length === 1 ? matches[0] : undefined
}

export function themeNumber(title: string): number | undefined {
  const theme = findPaceTheme(title)
  if (!theme) return undefined
  const index = PACE_THEMES.findIndex((candidate) => candidate.id === theme.id)
  return index >= 0 ? index + 1 : undefined
}

/** Trie les sujets publiés selon l'ordre officiel des neuf thèmes. */
export function sortThemes<T extends { title: string; publishedAt?: string }>(subjects: T[]): T[] {
  const order = new Map(
    PACE_THEMES.map((theme, index) => [normalizeThemeKey(theme.title), index] as const),
  )
  return [...subjects].sort((left, right) => {
    const leftOrder = order.get(normalizeThemeKey(left.title)) ?? 99
    const rightOrder = order.get(normalizeThemeKey(right.title)) ?? 99
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return String(left.publishedAt ?? '').localeCompare(String(right.publishedAt ?? ''))
  })
}

/** Range le pack dans l'ordre officiel et impose les titres exacts du produit. */
export function canonicalizeThemePack(themes: ThemePackThemeInput[]): ThemePackThemeInput[] {
  const byTheme = new Map<PaceThemeDefinition, ThemePackThemeInput>()
  themes.forEach((theme) => {
    const definition = findPaceTheme(theme.title)
    if (definition && !byTheme.has(definition)) byTheme.set(definition, theme)
  })
  return PACE_THEMES.map((definition) => {
    const provided = byTheme.get(definition)
    return {
      title: definition.title,
      description: provided?.description?.trim() || definition.description,
      monthLabel: provided?.monthLabel?.trim() || '',
      questions: provided?.questions ?? [],
    }
  })
}

/**
 * Valide le pack complet avant toute écriture. Un seul thème invalide bloque
 * la publication des neuf, afin de ne jamais laisser un catalogue partiel.
 */
export function validateThemePackInput(themes: ThemePackThemeInput[]): string[] {
  const errors: string[] = []
  if (!Array.isArray(themes) || themes.length !== PACE_THEMES.length) {
    return [`Le pack doit contenir exactement ${PACE_THEMES.length} thèmes.`]
  }

  const seen = new Set<string>()
  themes.forEach((theme, themeIndex) => {
    const definition = findPaceTheme(theme.title)
    const label = definition?.title ?? (theme.title?.trim() || `Thème ${themeIndex + 1}`)
    if (!definition) {
      errors.push(`« ${label} » ne correspond à aucun des neuf thèmes PACES.`)
      return
    }
    if (seen.has(definition.id)) {
      errors.push(`Le thème « ${definition.title} » est présent plusieurs fois.`)
      return
    }
    seen.add(definition.id)

    if (!theme.monthLabel?.trim()) {
      errors.push(`${label} : le libellé du mois est obligatoire.`)
    }
    if (!Array.isArray(theme.questions) || theme.questions.length < 10) {
      errors.push(
        `${label} : au moins 10 questions sont nécessaires (${theme.questions?.length ?? 0} trouvée(s)).`,
      )
      return
    }

    const numbers = new Set<number>()
    theme.questions.forEach((question, questionIndex) => {
      const questionLabel = `${label}, question ${question.number || questionIndex + 1}`
      if (!Number.isInteger(question.number) || question.number < 1) {
        errors.push(`${questionLabel} : numéro de question invalide.`)
        return
      }
      if (numbers.has(question.number)) {
        errors.push(`${questionLabel} : ce numéro apparaît plusieurs fois.`)
      }
      numbers.add(question.number)
      if (!question.statement?.trim()) {
        errors.push(`${questionLabel} : l’énoncé est vide.`)
      }
      for (const letter of ['A', 'B', 'C', 'D'] as const) {
        if (!question.options?.[letter]?.trim()) {
          errors.push(`${questionLabel} : l’option ${letter} est vide.`)
        }
      }
      if (
        !Array.isArray(question.correctAnswers) ||
        question.correctAnswers.length !== 1 ||
        !['A', 'B', 'C', 'D'].includes(question.correctAnswers[0])
      ) {
        errors.push(`${questionLabel} : une seule bonne réponse (A, B, C ou D) est attendue.`)
      }
      if (!question.explanation?.trim()) {
        errors.push(`${questionLabel} : l’explication médicale est vide.`)
      }
    })
  })

  PACE_THEMES.forEach((definition) => {
    if (!seen.has(definition.id)) {
      errors.push(`Feuille manquante pour le thème « ${definition.title} ».`)
    }
  })

  return errors
}
