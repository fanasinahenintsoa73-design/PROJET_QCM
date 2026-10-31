import type { QuestionOptions } from '@/types'

/**
 * Les neuf UE fixes. L'ordre de ce tableau est l'ordre officiel affiché aux
 * étudiants et au docteur.
 */
export interface ChapterDefinition {
  id: string
  title: string
}

export interface PaceThemeDefinition {
  id: string
  title: string
  description: string
  /** Noms de feuilles Excel acceptés en plus du titre complet. */
  aliases: readonly string[]
  /** Chapitres de l'UE. Vide lorsque la liste n'a pas encore été fournie. */
  chapters: readonly ChapterDefinition[]
}

export const PACE_THEMES: readonly PaceThemeDefinition[] = [
  {
    id: 'theme_biologie_cellulaire',
    title: 'Biocel (Biologie Cellulaire)',
    description:
      'Membrane, organites, cycle cellulaire et mécanismes fondamentaux de la cellule eucaryote.',
    aliases: [
      'biologie cellulaire s1 et s2',
      'biologie cellulaire',
      'biologie de la cellule',
      'biocel',
    ],
    chapters: [
      { id: 'biocel__methodes_etude', title: 'Méthodes d’étude' },
      { id: 'biocel__membrane_biologique', title: 'Membrane biologique' },
      { id: 'biocel__noyau_interphasique', title: 'Noyau interphasique' },
      { id: 'biocel__mitochondrie', title: 'Mitochondrie' },
      { id: 'biocel__lysosome', title: 'Lysosome' },
      { id: 'biocel__cytosquelette', title: 'Cytosquelette' },
      { id: 'biocel__synthese_proteique', title: 'Synthèse protéique (Protéine)' },
      { id: 'biocel__appareil_de_golgi', title: 'Appareil de Golgi' },
      { id: 'biocel__reticulum_endoplasmique', title: 'Réticulum endoplasmique' },
    ],
  },
  {
    id: 'theme_etude_des_tissus',
    title: 'Tissus (Histologie)',
    description:
      'Épithéliums, tissus conjonctifs, muscle, sang et organisation microscopique des organes.',
    aliases: ['etude des tissus s1 et s2', 'etude des tissus', 'histologie', 'tissus'],
    chapters: [
      { id: 'tissus__epithelium_de_revetement', title: 'Épithélium de revêtement' },
      { id: 'tissus__epithelium_glandulaire', title: 'Épithélium glandulaire' },
    ],
  },
  {
    id: 'theme_biomolecules',
    title: 'Structure Biomolécules (Struct Bio)',
    description:
      'Glucides, lipides, protéines, acides nucléiques et grandes voies du métabolisme.',
    aliases: [
      'structure et fonction des biomolecules',
      'structure biomolecules',
      'struct bio',
      'biomolecules',
      'biochimie',
    ],
    chapters: [
      { id: 'struct_bio__protides', title: 'Protides' },
      { id: 'struct_bio__chimie', title: 'Chimie' },
      { id: 'struct_bio__lipides', title: 'Lipides' },
      { id: 'struct_bio__glucides', title: 'Glucides' },
      { id: 'struct_bio__enzymes', title: 'Enzymes' },
      { id: 'struct_bio__coenzymes', title: 'Coenzymes' },
      { id: 'struct_bio__acides_nucleiques', title: 'Acides Nucléiques' },
    ],
  },
  {
    id: 'theme_physiologie',
    title: 'Physiologie (Physio)',
    description:
      'Fonctions cardiovasculaire, respiratoire, rénale, digestive et endocrine chez l’adulte.',
    aliases: ['physiologie s1 et s2', 'physiologie', 'physio', 'physiologie humaine'],
    chapters: [
      { id: 'physio__uro_renale', title: 'Uro-Rénale' },
      { id: 'physio__respiratoire', title: 'Respiratoire' },
      { id: 'physio__digestif', title: 'Digestif' },
      { id: 'physio__hormonal', title: 'Hormonal' },
      { id: 'physio__thermoregulation', title: 'Thermorégulation' },
      { id: 'physio__cardiaque', title: 'Cardiaque' },
      { id: 'physio__vasculaire', title: 'Vasculaire' },
      { id: 'physio__integratif', title: 'Intégratif' },
      { id: 'physio__neurophysiologie', title: 'Neurophysiologie' },
      { id: 'physio__sang', title: 'Sang' },
    ],
  },
  {
    id: 'theme_anatomie_viscerale',
    title: 'Anatomie Viscérale',
    description:
      'Organes du thorax, de l’abdomen et du bassin, rapports anatomiques et vascularisation.',
    aliases: ['anatomie viscerale', 'anatomie des visceres'],
    chapters: [
      { id: 'anatomie_viscerale__digestif', title: 'Digestif' },
      { id: 'anatomie_viscerale__urologie', title: 'Urologie' },
      { id: 'anatomie_viscerale__systeme_nerveux', title: 'Système Nerveux' },
      { id: 'anatomie_viscerale__thorax', title: 'Thorax' },
      { id: 'anatomie_viscerale__coeur', title: 'Cœur' },
    ],
  },
  {
    id: 'theme_biomathematiques',
    title: 'Biochimie / Biophysique',
    description:
      'Biochimie et biophysique appliquées à la médecine. Les chapitres seront ajoutés prochainement.',
    aliases: [
      'biomathematiques biophysique statistiques',
      'biomathematiques biophysique',
      'biomathematiques',
      'biostatistiques',
      'biochimie biophysique',
    ],
    chapters: [],
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
    chapters: [],
  },
  {
    id: 'theme_francais_medical',
    title: 'Français médical',
    description:
      'Vocabulaire clinique, terminologie, abréviations et communication avec le patient.',
    aliases: ['francais medical', 'francais medical et communication', 'terminologie medicale'],
    chapters: [],
  },
  {
    id: 'theme_ue_specifiques',
    title: 'Spécifique (UE Spé)',
    description:
      'Santé publique, éthique, droit de la santé, prévention et qualité des soins.',
    aliases: [
      'unites d enseignements specifiques',
      'unites d enseignements',
      'ue specifiques',
      'ue specifique',
      'specifique',
      'ue spe',
    ],
    chapters: [
      { id: 'specifique__medecine_humaine', title: 'Médecine Humaine' },
      { id: 'specifique__veterinaire', title: 'Vétérinaire' },
      { id: 'specifique__pharmacie', title: 'Pharmacie' },
      { id: 'specifique__sage_femme', title: 'Sage-femme' },
      { id: 'specifique__infirmiere', title: 'Infirmière' },
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

/**
 * Enregistrement d'un sujet rattaché à un chapitre. `subjectId` est fourni
 * lors d'une modification ; il est absent pour une création.
 */
export interface SaveChapterSubjectInput {
  subjectId?: string
  themeId: string
  chapterId: string
  title: string
  description: string
  monthLabel: string
  questions?: ThemeQuestionInput[]
  questionFileName?: string
  answerFileName?: string
}

/** Chapitre à partir de son identifiant stable. */
export function findChapter(chapterId: string): ChapterDefinition | undefined {
  return PACE_THEMES.flatMap((theme) => theme.chapters).find(
    (chapter) => chapter.id === chapterId,
  )
}

/** UE qui contient un chapitre donné. */
export function findThemeForChapter(chapterId: string): PaceThemeDefinition | undefined {
  return PACE_THEMES.find((theme) =>
    theme.chapters.some((chapter) => chapter.id === chapterId),
  )
}

/** Chapitres d'une UE, triés alphabétiquement pour l'étudiant. */
export function chaptersForTheme(themeId: string): ChapterDefinition[] {
  const theme = PACE_THEMES.find((candidate) => candidate.id === themeId)
  return [...(theme?.chapters ?? [])].sort((left, right) =>
    left.title.localeCompare(right.title, 'fr', { sensitivity: 'base' }),
  )
}

/** Tous les chapitres, dans l'ordre officiel des UE puis alphabétique. */
export function allChapters(): Array<ChapterDefinition & { themeId: string; themeTitle: string }> {
  return PACE_THEMES.flatMap((theme) =>
    chaptersForTheme(theme.id).map((chapter) => ({
      ...chapter,
      themeId: theme.id,
      themeTitle: theme.title,
    })),
  )
}

export function chapterTitle(chapterId?: string): string {
  return (chapterId && findChapter(chapterId)?.title) || ''
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

/** Retrouve un thème à partir de son identifiant, d'un titre ou d'un nom de feuille. */
export function findPaceTheme(value: string): PaceThemeDefinition | undefined {
  const direct = PACE_THEMES.find((theme) => theme.id === value.trim())
  if (direct) return direct
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
