import type { Attempt, Database, Question, Subject, SubjectAssignment } from '@/types'
import { addDays, monthLabel, SERIES_SIZE, shuffle, sameAnswer } from '@/lib/utils'

type SeedQuestion = Omit<Question, 'id' | 'subjectId'>

export const PROFESSOR_FIRST_NAME = 'Sun'
export const PROFESSOR_LAST_NAME = 'RAZAFIMANDIMBY'

const QUESTIONS: SeedQuestion[] = [
  {
    number: 1,
    matiere: 'Anatomie',
    statement: 'Combien de paires de côtes comporte le squelette thoracique humain ?',
    options: { A: '10 paires', B: '11 paires', C: '12 paires', D: '14 paires' },
    correctAnswers: ['C'],
    explanation:
      "Le thorax comporte 12 paires de côtes : 7 vraies côtes qui s'articulent directement au sternum, 3 fausses côtes qui rejoignent le cartilage sus-jacent et 2 côtes flottantes. Les côtes 11 et 12 sont les seules à ne pas atteindre le sternum.",
  },
  {
    number: 2,
    matiere: 'Anatomie',
    statement: "Quel nerf assure l'innervation motrice principale du diaphragme ?",
    options: { A: 'Le nerf intercostal', B: 'Le nerf phrénique', C: 'Le nerf spinal accessoire', D: 'Le nerf hypoglosse' },
    correctAnswers: ['B'],
    explanation:
      "Le nerf phrénique naît des racines cervicales C3-C4-C5 (« C3, 4, 5 keep the diaphragm alive »). Il innerve la motricité du diaphragme et participe à sa sensibilité. Une lésion bilatérale provoque une paralysie diaphragmatique grave.",
  },
  {
    number: 3,
    matiere: 'Anatomie',
    statement: "L'artère coronaire gauche se divise classiquement en :",
    options: {
      A: 'Artère interventriculaire antérieure et artère circonflexe',
      B: 'Coronaire droite et artère marginale',
      C: 'Artère gastrique et artère splénique',
      D: 'Artère pulmonaire et aorte',
    },
    correctAnswers: ['A'],
    explanation:
      "Le tronc commun gauche se bifurque en artère interventriculaire antérieure (IVA) et artère circonflexe. L'IVA vascularise la paroi antérieure du ventricule gauche et le septum antérieur ; la circonflexe irrigue la paroi latérale.",
  },
  {
    number: 4,
    matiere: 'Anatomie',
    statement: 'Lequel de ces os appartient au membre inférieur ?',
    options: { A: "L'humérus", B: 'Le radius', C: 'Le fémur', D: "La scapula" },
    correctAnswers: ['C'],
    explanation:
      "Le fémur est l'os unique de la cuisse et le plus long du corps. L'humérus, le radius et la scapula appartiennent au membre supérieur. Le fémur s'articule avec le bassin par la hanche et avec le tibia par le genou.",
  },
  {
    number: 5,
    matiere: 'Physiologie',
    statement: 'Dans le nœud sinusal, la phase 0 du potentiel d’action est principalement due à :',
    options: {
      A: 'Une entrée rapide de sodium',
      B: 'Une entrée lente de calcium',
      C: 'Une sortie de potassium',
      D: 'Une sortie de chlore',
    },
    correctAnswers: ['B'],
    explanation:
      "Les cellules pacemaker du nœud sinusal ont un potentiel d'action « lent », dépendant du courant calcique de type L. Contrairement aux cellules myocardiques contractiles, la phase 0 n'est pas portée par le sodium rapide.",
  },
  {
    number: 6,
    matiere: 'Physiologie',
    statement: 'Le débit cardiaque est égal à :',
    options: {
      A: 'Fréquence cardiaque ÷ volume d’éjection systolique',
      B: 'Fréquence cardiaque × volume d’éjection systolique',
      C: 'Volume d’éjection systolique × pression artérielle',
      D: 'Fréquence cardiaque + volume d’éjection systolique',
    },
    correctAnswers: ['B'],
    explanation:
      "Le débit cardiaque (Q) correspond au volume de sang éjecté par minute : Q = FC × VES. Au repos, il est d'environ 5 L/min chez l'adulte. Il augmente à l'effort par élévation de la fréquence et du volume d'éjection.",
  },
  {
    number: 7,
    matiere: 'Physiologie',
    statement: 'Où la pression partielle en oxygène (PaO₂) est-elle la plus élevée ?',
    options: {
      A: 'Dans le sang veineux pulmonaire',
      B: 'Dans les alvéoles pulmonaires',
      C: 'Dans le sang veineux systémique',
      D: 'Dans les tissus périphériques',
    },
    correctAnswers: ['B'],
    explanation:
      "L'air alvéolaire est le compartiment le plus riche en oxygène (PaO₂ ≈ 100 mmHg), ce qui permet le passage de l'O₂ vers le sang capillaire. Le sang artériel systémique est légèrement moins oxygéné (≈ 95 mmHg) en raison du shunt physiologique.",
  },
  {
    number: 8,
    matiere: 'Physiologie',
    statement: 'Quel volume de plasma est filtré chaque jour par les deux reins ?',
    options: { A: '18 litres', B: '80 litres', C: '180 litres', D: '1 800 litres' },
    correctAnswers: ['C'],
    explanation:
      "Le débit de filtration glomérulaire est d'environ 125 mL/min, soit 180 L de plasma filtré par jour. La quasi-totalité est réabsorbée : le volume urinaire final n'est que de 1 à 2 L.",
  },
  {
    number: 9,
    matiere: 'Physiologie',
    statement: 'Quelle hormone abaisse la glycémie ?',
    options: { A: 'Le glucagon', B: "L'insuline", C: 'Le cortisol', D: "L'adrénaline" },
    correctAnswers: ['B'],
    explanation:
      "L'insuline, sécrétée par les cellules β du pancréas, favorise l'entrée du glucose dans les cellules et le stockage sous forme de glycogène. Le glucagon, le cortisol et l'adrénaline sont des hormones hyperglycémiantes.",
  },
  {
    number: 10,
    matiere: 'Biochimie',
    statement: 'La glycolyse anaérobie produit un bilan net de :',
    options: { A: '2 ATP', B: '4 ATP', C: '36 ATP', D: '0 ATP' },
    correctAnswers: ['A'],
    explanation:
      "La glycolyse consomme 2 ATP et en produit 4 : le bilan net est de 2 ATP par molécule de glucose. La voie aérobie, via la phosphorylation oxydative, permet un rendement bien supérieur (environ 30 à 32 ATP).",
  },
  {
    number: 11,
    matiere: 'Biochimie',
    statement: "L'enzyme limitante de la glycolyse est :",
    options: {
      A: "L'hexokinase",
      B: 'La phosphofructokinase-1',
      C: 'La pyruvate kinase',
      D: 'La lactate déshydrogénase',
    },
    correctAnswers: ['B'],
    explanation:
      "La phosphofructokinase-1 (PFK-1) catalyse la conversion du fructose-6-phosphate en fructose-1,6-bisphosphate. C'est l'étape irréversible et le principal point de régulation de la glycolyse, activé par l'AMP et inhibé par l'ATP et le citrate.",
  },
  {
    number: 12,
    matiere: 'Biochimie',
    statement: 'Le cycle de Krebs se déroule dans :',
    options: {
      A: 'Le cytoplasme',
      B: 'La membrane externe mitochondriale',
      C: 'La matrice mitochondriale',
      D: 'Le noyau',
    },
    correctAnswers: ['C'],
    explanation:
      "Le cycle de Krebs (ou cycle de l'acide citrique) se déroule dans la matrice mitochondriale, sauf l'enzyme succinate déshydrogénase, ancrée à la membrane interne. Il génère du NADH, du FADH₂ et du GTP.",
  },
  {
    number: 13,
    matiere: 'Biochimie',
    statement: 'Laquelle de ces vitamines est hydrosoluble ?',
    options: { A: 'La vitamine A', B: 'La vitamine D', C: 'La vitamine C', D: 'La vitamine K' },
    correctAnswers: ['C'],
    explanation:
      "La vitamine C (acide ascorbique) est hydrosoluble : elle est éliminée dans les urines et doit être apportée quotidiennement. Les vitamines A, D, E et K sont liposolubles et peuvent s'accumuler dans l'organisme.",
  },
  {
    number: 14,
    matiere: 'Biologie cellulaire',
    statement: 'Quel organite est le siège de la synthèse protéique ?',
    options: { A: 'Le lysosome', B: 'Le ribosome', C: 'Le peroxysome', D: "L'appareil de Golgi" },
    correctAnswers: ['B'],
    explanation:
      "Les ribosomes assurent la traduction de l'ARN messager en protéines. Libres dans le cytosol, ils synthétisent les protéines intracellulaires ; fixés au réticulum endoplasmique rugueux, ils produisent les protéines sécrétées ou membranaires.",
  },
  {
    number: 15,
    matiere: 'Biologie cellulaire',
    statement: "L'ADN mitochondrial est transmis :",
    options: {
      A: 'Par le père uniquement',
      B: 'Par la mère uniquement',
      C: 'Par les deux parents à parts égales',
      D: 'De façon entièrement aléatoire',
    },
    correctAnswers: ['B'],
    explanation:
      "L'ADN mitochondrial est d'origine maternelle : les mitochondries du spermatozoïde ne persistent pas dans l'ovocyte fécondé. Cette transmission explique l'expression maternelle de certaines maladies mitochondriales.",
  },
  {
    number: 16,
    matiere: 'Biologie cellulaire',
    statement: "L'apoptose correspond à :",
    options: {
      A: 'Une nécrose tissulaire',
      B: 'Une mort cellulaire programmée',
      C: 'Une division cellulaire',
      D: 'Une étape de différenciation',
    },
    correctAnswers: ['B'],
    explanation:
      "L'apoptose est une mort cellulaire programmée, active et physiologique. Elle se distingue de la nécrose par l'absence de réaction inflammatoire, la condensation de la chromatine et la formation de corps apoptotiques.",
  },
  {
    number: 17,
    matiere: 'Biologie cellulaire',
    statement: "La réplication de l'ADN a lieu pendant :",
    options: { A: 'La phase G1', B: 'La phase S', C: 'La phase G2', D: 'La mitose' },
    correctAnswers: ['B'],
    explanation:
      "La phase S (synthèse) du cycle cellulaire correspond à la réplication de l'ADN. La cellule passe ensuite en phase G2, où elle vérifie l'intégrité du génome avant d'entrer en mitose.",
  },
  {
    number: 18,
    matiere: 'Histologie',
    statement: "L'épithélium tapissant les alvéoles pulmonaires est :",
    options: {
      A: 'Un épithélium simple pavimenteux',
      B: 'Un épithélium stratifié pavimenteux',
      C: 'Un épithélium simple cubique',
      D: 'Un épithélium pseudostratifié',
    },
    correctAnswers: ['A'],
    explanation:
      "Les alvéoles sont tapissées d'un épithélium simple pavimenteux, très fin, composé notamment de pneumocytes de type I. Cette finesse est essentielle aux échanges gazeux. Les pneumocytes de type II produisent le surfactant.",
  },
  {
    number: 19,
    matiere: 'Histologie',
    statement: 'Les cellules β des îlots de Langerhans sécrètent :',
    options: { A: 'Le glucagon', B: "L'insuline", C: 'La somatostatine', D: 'Le polypeptide pancréatique' },
    correctAnswers: ['B'],
    explanation:
      "Les cellules β des îlots pancréatiques produisent l'insuline, hormone hypoglycémiante. Les cellules α sécrètent le glucagon, les cellules δ la somatostatine et les cellules PP le polypeptide pancréatique.",
  },
  {
    number: 20,
    matiere: 'Histologie',
    statement: 'Le cartilage hyalin est :',
    options: { A: 'Richement vascularisé', B: 'Avasculaire', C: 'Innervé', D: 'Constitué de 90 % de cellules' },
    correctAnswers: ['B'],
    explanation:
      "Le cartilage est avasculaire et non innervé : il est nourri par diffusion à partir du liquide synovial ou du périchondre. Cette particularité explique sa cicatrisation lente et la nécessité d'une immobilisation prolongée après une lésion.",
  },
  {
    number: 21,
    matiere: 'Sémiologie',
    statement:
      'Une douleur thoracique constrictive, déclenchée par l’effort et irradiant vers le bras gauche, évoque en priorité :',
    options: { A: 'Une péricardite', B: "Un angor d'effort", C: 'Une pleurésie', D: 'Une œsophagite' },
    correctAnswers: ['B'],
    explanation:
      "Cette présentation associe les trois caractéristiques de l'angor : douleur constrictive, déclenchement à l'effort et irradiation au bras gauche. Un angor instable ou un infarctus doit être évoqué si la douleur survient au repos ou se prolonge.",
  },
  {
    number: 22,
    matiere: 'Sémiologie',
    statement: "Une toux est dite chronique lorsqu'elle persiste au-delà de :",
    options: { A: '3 jours', B: '3 semaines', C: '3 mois', D: '1 an' },
    correctAnswers: ['B'],
    explanation:
      "En pratique clinique française, une toux est chronique au-delà de 3 semaines. Les causes principales sont le tabagisme, l'asthme, le reflux gastro-œsophagien et la rhinorrhée postérieure. Une radio de thorax est souvent indiquée.",
  },
  {
    number: 23,
    matiere: 'Sémiologie',
    statement: 'La présence d’un signe de Babinski évoque une atteinte :',
    options: {
      A: 'Du faisceau pyramidal',
      B: 'Du cervelet',
      C: 'Des nerfs périphériques',
      D: 'De la moelle postérieure',
    },
    correctAnswers: ['A'],
    explanation:
      "Le signe de Babinski (extension lente du gros orteil à la stimulation plantaire) traduit une atteinte du faisceau pyramidal chez l'adulte. Il est physiologique chez le nourrisson avant la myélinisation complète.",
  },
  {
    number: 24,
    matiere: 'Pharmacologie',
    statement: 'Quel est l’effet indésirable caractéristique des aminosides ?',
    options: {
      A: 'Une hépatotoxicité isolée',
      B: 'Une néphrotoxicité et une ototoxicité',
      C: 'Une photosensibilisation',
      D: 'Une hypothyroïdie',
    },
    correctAnswers: ['B'],
    explanation:
      "Les aminosides (gentamicine, amikacine) sont néphrotoxiques et ototoxiques, avec un risque de surdité irréversible. Leur administration impose une surveillance de la fonction rénale et des taux plasmatiques.",
  },
  {
    number: 25,
    matiere: 'Pharmacologie',
    statement:
      'Quelle classe thérapeutique réduit la sécrétion gastrique en inhibant la pompe H⁺/K⁺-ATPase ?',
    options: { A: 'Les anti-H₂', B: 'Les inhibiteurs de la pompe à protons', C: 'Les antacides', D: 'Les prokinétiques' },
    correctAnswers: ['B'],
    explanation:
      "Les inhibiteurs de la pompe à protons (oméprazole, ésoméprazole) bloquent la pompe H⁺/K⁺-ATPase des cellules pariétales et réduisent fortement la sécrétion acide. Les anti-H₂ agissent sur le récepteur histaminique, en amont.",
  },
  {
    number: 26,
    matiere: 'Pharmacologie',
    statement: 'Lequel de ces médicaments est un anticoagulant oral direct ?',
    options: { A: 'La warfarine', B: "L'apixaban", C: "L'héparine non fractionnée", D: "L'aspirine" },
    correctAnswers: ['B'],
    explanation:
      "L'apixaban est un inhibiteur direct du facteur Xa, administré par voie orale. La warfarine est un antivitamine K, l'héparine est parentérale et l'aspirine est un antiagrégant plaquettaire, pas un anticoagulant.",
  },
  {
    number: 27,
    matiere: 'Anatomie',
    statement: 'Le cœur se situe dans :',
    options: {
      A: 'Le médiastin antérieur',
      B: 'Le médiastin moyen',
      C: 'Le médiastin postérieur',
      D: 'La cavité pleurale gauche',
    },
    correctAnswers: ['B'],
    explanation:
      "Le cœur siège dans le médiastin moyen, entre les deux poumons, en arrière du sternum et en avant de l'œsophage. Le médiastin antérieur contient le thymus et le médiastin postérieur l'œsophage, l'aorte thoracique et la trachée.",
  },
  {
    number: 28,
    matiere: 'Physiologie',
    statement: "La surface d'échange alvéolaire totale est d'environ :",
    options: { A: '7 m²', B: '70 m²', C: '700 m²', D: '7 000 m²' },
    correctAnswers: ['B'],
    explanation:
      "La surface alvéolaire totale est d'environ 70 m², soit la taille d'un court de tennis, répartie sur des centaines de millions d'alvéoles. Elle est réduite dans l'emphysème, ce qui altère les échanges gazeux.",
  },
  {
    number: 29,
    matiere: 'Biochimie',
    statement: 'Lequel de ces acides aminés est essentiel ?',
    options: { A: "L'alanine", B: 'La glycine', C: 'La leucine', D: 'La glutamine' },
    correctAnswers: ['C'],
    explanation:
      "La leucine fait partie des neuf acides aminés essentiels, non synthétisés par l'organisme et devant être apportés par l'alimentation. L'alanine, la glycine et la glutamine sont synthétisables par l'organisme.",
  },
  {
    number: 30,
    matiere: 'Biologie cellulaire',
    statement: 'Le réticulum endoplasmique rugueux est impliqué dans :',
    options: {
      A: 'La synthèse des protéines sécrétées',
      B: 'La β-oxydation des acides gras',
      C: 'La dégradation des lipides',
      D: "La réplication de l'ADN",
    },
    correctAnswers: ['A'],
    explanation:
      "Le réticulum endoplasmique rugueux est couvert de ribosomes et assure la synthèse des protéines destinées à la sécrétion ou à la membrane. La β-oxydation se déroule dans les mitochondries et la dégradation des lipides dans les lysosomes.",
  },
  {
    number: 31,
    matiere: 'Physiologie',
    statement: 'Parmi ces facteurs, lesquels sont des facteurs de risque cardiovasculaire majeurs ? (plusieurs réponses)',
    options: {
      A: 'Le tabagisme',
      B: 'Le diabète de type 2',
      C: "L'hypertension artérielle",
      D: "L'hypercholestérolémie",
    },
    correctAnswers: ['A', 'B', 'C', 'D'],
    explanation:
      "Le tabagisme, le diabète de type 2, l'hypertension artérielle et l'hypercholestérolémie sont les quatre principaux facteurs de risque cardiovasculaire modifiables. Leur correction réduit significativement le risque d'infarctus et d'AVC.",
  },
  {
    number: 32,
    matiere: 'Histologie',
    statement: 'Quelles cellules sont des granulocytes ? (plusieurs réponses)',
    options: {
      A: 'Les neutrophiles',
      B: 'Les éosinophiles',
      C: 'Les basophiles',
      D: 'Les lymphocytes',
    },
    correctAnswers: ['A', 'B', 'C'],
    explanation:
      "Les neutrophiles, éosinophiles et basophiles sont des granulocytes, caractérisés par leurs granulations cytoplasmiques. Les lymphocytes et les monocytes sont des agranulocytes. Tous dérivent de la lignée myéloïde pour les granulocytes.",
  },
]

const DEMO_AMOUNT = '30,00 €'

function receiptSvg(name: string, reference: string, date: string, amount = DEMO_AMOUNT) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="900" viewBox="0 0 640 900">
  <rect width="640" height="900" fill="#ffffff"/>
  <rect x="0" y="0" width="640" height="108" fill="#111111"/>
  <text x="48" y="66" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#ffffff" letter-spacing="2">MEDQCM L1</text>
  <text x="48" y="88" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="500" fill="#cacacb" letter-spacing="3">REÇU DE PAIEMENT — ACCÈS MENSUEL</text>
  <text x="48" y="158" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#707072" letter-spacing="2">REÇU N°</text>
  <text x="48" y="182" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#111111">${reference}</text>
  <text x="592" y="158" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#707072" letter-spacing="2">DATE</text>
  <text x="592" y="182" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#111111">${date}</text>
  <line x1="48" y1="214" x2="592" y2="214" stroke="#e5e5e5"/>
  <text x="48" y="258" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#707072" letter-spacing="2">REÇU DE</text>
  <text x="48" y="292" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#111111">${name}</text>
  <text x="48" y="350" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#707072" letter-spacing="2">OBJET DU PAIEMENT</text>
  <text x="48" y="380" font-family="Arial, Helvetica, sans-serif" font-size="17" fill="#111111">Accès mensuel à la banque de QCM</text>
  <text x="48" y="404" font-family="Arial, Helvetica, sans-serif" font-size="17" fill="#111111">Entraînement illimité — 30 jours</text>
  <text x="48" y="462" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#707072" letter-spacing="2">MOYEN DE PAIEMENT</text>
  <text x="48" y="490" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#111111">Virement bancaire / espèces</text>
  <text x="48" y="544" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#707072" letter-spacing="2">MONTANT RÉGLÉ</text>
  <text x="48" y="600" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="700" fill="#111111">${amount}</text>
  <rect x="48" y="648" width="180" height="42" rx="21" fill="#111111"/>
  <text x="138" y="674" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" fill="#ffffff" letter-spacing="2">● PAYÉ</text>
  <line x1="48" y1="740" x2="592" y2="740" stroke="#e5e5e5"/>
  <text x="48" y="776" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#707072">Document de démonstration généré pour tester la validation du docteur.</text>
  <text x="48" y="796" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#707072">Aucune valeur comptable. QCM Médecine L1.</text>
  <text x="592" y="844" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="9" fill="#9e9ea0" letter-spacing="1">MEDQCM · FR</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function seedAttempt(
  base: Omit<Attempt, 'id' | 'questionIds' | 'answers' | 'score' | 'total' | 'createdAt'> & { daysAgo: number },
  questions: Question[],
  correctCount: number,
  offset: number,
): Attempt {
  const rotated = [...questions.slice(offset), ...questions.slice(0, offset)]
  const picked = rotated.slice(0, 20)
  const answers: Record<string, string[]> = {}
  picked.forEach((q, index) => {
    if (index < correctCount) {
      answers[q.id] = [...q.correctAnswers]
    } else {
      const wrong = (['A', 'B', 'C', 'D'] as const).find((letter) => !q.correctAnswers.includes(letter)) ?? 'A'
      answers[q.id] = [wrong]
    }
  })
  const score = picked.reduce((sum, q) => sum + (sameAnswer(answers[q.id], q.correctAnswers) ? 1 : 0), 0)
  return {
    ...base,
    id: `attempt_${base.userId}_${base.daysAgo}`,
    questionIds: picked.map((q) => q.id),
    answers,
    score,
    total: picked.length,
    createdAt: addDays(new Date(), -base.daysAgo).toISOString(),
  }
}

export function createSeedDatabase(): Database {
  const now = new Date()
  const currentMonth = monthLabel(now)
  const activeSubjectId = 'subject_active'
  const queueSubject2Id = 'subject_queue_2'
  const queueSubject3Id = 'subject_queue_3'
  const archivedSubjectId = 'subject_archive'

  const activeSubject: Subject = {
    id: activeSubjectId,
    title: 'Sujet 1 — Fondamentaux & Cardiologie',
    description:
      "Un tour complet des fondamentaux de la L1 : anatomie, physiologie, biochimie, biologie cellulaire, histologie, sémiologie et pharmacologie. Chaque corrigé est rédigé par votre docteur.",
    monthLabel: currentMonth,
    publishedAt: addDays(now, -12).toISOString(),
    archived: false,
    questionCount: QUESTIONS.length,
  }

  const queueSubject2: Subject = {
    id: queueSubject2Id,
    title: 'Sujet 2 — Consolidation clinique',
    description:
      'Deuxième sujet de la file. Il sera attribué automatiquement au prochain renouvellement.',
    monthLabel: currentMonth,
    publishedAt: addDays(now, -11).toISOString(),
    archived: false,
    questionCount: QUESTIONS.length,
  }

  const queueSubject3: Subject = {
    id: queueSubject3Id,
    title: 'Sujet 3 — Révisions ciblées',
    description:
      'Troisième sujet de la file, prêt pour le cycle suivant. Le docteur peut retirer un sujet tant qu’il n’a pas été attribué.',
    monthLabel: currentMonth,
    publishedAt: addDays(now, -10).toISOString(),
    archived: false,
    questionCount: QUESTIONS.length,
  }

  const archivedSubject: Subject = {
    id: archivedSubjectId,
    title: 'Sujet archivé — Anatomie & Biologie cellulaire',
    description: 'Sujet archivé de démonstration.',
    monthLabel: monthLabel(addDays(now, -42)),
    publishedAt: addDays(now, -42).toISOString(),
    archived: true,
    questionCount: QUESTIONS.length,
  }

  const activeQuestions: Question[] = QUESTIONS.map((q) => ({
    ...q,
    id: `q_${q.number}`,
    subjectId: activeSubjectId,
  }))
  const queueSubject2Questions: Question[] = QUESTIONS.map((q) => ({
    ...q,
    id: `q2_${q.number}`,
    subjectId: queueSubject2Id,
  }))
  const queueSubject3Questions: Question[] = QUESTIONS.map((q) => ({
    ...q,
    id: `q3_${q.number}`,
    subjectId: queueSubject3Id,
  }))
  const archivedQuestions: Question[] = QUESTIONS.map((q) => ({
    ...q,
    id: `qa_${q.number}`,
    subjectId: archivedSubjectId,
  }))

  const jeanReceipt = receiptSvg(
    'Jean Dupont',
    'MQC-2026-0418',
    new Intl.DateTimeFormat('fr-FR').format(addDays(now, -18)),
  )
  const aminaReceipt = receiptSvg(
    'Amina Benali',
    'MQC-2026-0521',
    new Intl.DateTimeFormat('fr-FR').format(addDays(now, -1)),
    '30,00 €',
  )
  const sarahReceipt = receiptSvg(
    'Sarah Lemoine',
    'MQC-2026-0524',
    new Intl.DateTimeFormat('fr-FR').format(now),
  )
  const thomasReceipt = receiptSvg(
    'Thomas Petit',
    'MQC-2026-0402',
    new Intl.DateTimeFormat('fr-FR').format(addDays(now, -25)),
  )

  const users: Database['users'] = [
    {
      id: 'u_prof',
      role: 'professor',
      firstName: PROFESSOR_FIRST_NAME,
      lastName: PROFESSOR_LAST_NAME,
      email: 'prof@medqcm.fr',
      password: 'prof1234',
      status: 'active',
      createdAt: addDays(now, -180).toISOString(),
    },
    {
      id: 'u_jean',
      role: 'student',
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@email.com',
      password: 'etudiant1234',
      status: 'active',
      createdAt: addDays(now, -18).toISOString(),
      activatedAt: addDays(now, -18).toISOString(),
      expiresAt: addDays(now, 12).toISOString(),
    },
    {
      id: 'u_amina',
      role: 'student',
      firstName: 'Amina',
      lastName: 'Benali',
      email: 'amina.benali@email.com',
      password: 'etudiant1234',
      status: 'pending',
      createdAt: addDays(now, -1).toISOString(),
    },
    {
      id: 'u_lucas',
      role: 'student',
      firstName: 'Lucas',
      lastName: 'Martin',
      email: 'lucas.martin@email.com',
      password: 'etudiant1234',
      status: 'active',
      createdAt: addDays(now, -35).toISOString(),
      activatedAt: addDays(now, -33).toISOString(),
      expiresAt: addDays(now, -3).toISOString(),
    },
    {
      id: 'u_sarah',
      role: 'student',
      firstName: 'Sarah',
      lastName: 'Lemoine',
      email: 'sarah.lemoine@email.com',
      password: 'etudiant1234',
      status: 'active',
      createdAt: addDays(now, -34).toISOString(),
      activatedAt: addDays(now, -31).toISOString(),
      expiresAt: addDays(now, -1).toISOString(),
    },
    {
      id: 'u_yanis',
      role: 'student',
      firstName: 'Yanis',
      lastName: 'Haddad',
      email: 'yanis.haddad@email.com',
      password: 'etudiant1234',
      status: 'active',
      createdAt: addDays(now, -5).toISOString(),
      activatedAt: addDays(now, -5).toISOString(),
      expiresAt: addDays(now, 25).toISOString(),
    },
    {
      id: 'u_clara',
      role: 'student',
      firstName: 'Clara',
      lastName: 'Fontaine',
      email: 'clara.fontaine@email.com',
      password: 'etudiant1234',
      status: 'active',
      createdAt: addDays(now, -27).toISOString(),
      activatedAt: addDays(now, -27).toISOString(),
      expiresAt: addDays(now, 3).toISOString(),
    },
    {
      id: 'u_thomas',
      role: 'student',
      firstName: 'Thomas',
      lastName: 'Petit',
      email: 'thomas.petit@email.com',
      password: 'etudiant1234',
      status: 'rejected',
      createdAt: addDays(now, -25).toISOString(),
      rejectionReason: 'Le reçu transmis est illisible. Merci de joindre une photo nette du justificatif.',
    },
  ]

  const assignments: SubjectAssignment[] = [
    {
      id: 'assign_jean',
      userId: 'u_jean',
      subjectId: activeSubjectId,
      requestId: 'req_jean',
      startedAt: addDays(now, -18).toISOString(),
      expiresAt: addDays(now, 12).toISOString(),
    },
    {
      id: 'assign_yanis',
      userId: 'u_yanis',
      subjectId: activeSubjectId,
      startedAt: addDays(now, -5).toISOString(),
      expiresAt: addDays(now, 25).toISOString(),
    },
    {
      id: 'assign_clara',
      userId: 'u_clara',
      subjectId: activeSubjectId,
      startedAt: addDays(now, -27).toISOString(),
      expiresAt: addDays(now, 3).toISOString(),
    },
    {
      id: 'assign_lucas',
      userId: 'u_lucas',
      subjectId: activeSubjectId,
      startedAt: addDays(now, -33).toISOString(),
      expiresAt: addDays(now, -3).toISOString(),
    },
    {
      id: 'assign_sarah',
      userId: 'u_sarah',
      subjectId: activeSubjectId,
      startedAt: addDays(now, -31).toISOString(),
      expiresAt: addDays(now, -1).toISOString(),
    },
  ]

  const requests: Database['requests'] = [
    {
      id: 'req_jean',
      userId: 'u_jean',
      userName: 'Jean Dupont',
      userEmail: 'jean.dupont@email.com',
      type: 'initial',
      receipt: {
        dataUrl: jeanReceipt,
        name: 'recu-jean-dupont.svg',
        mime: 'image/svg+xml',
        size: 6_400,
      },
      status: 'approved',
      createdAt: addDays(now, -18).toISOString(),
      reviewedAt: addDays(now, -18).toISOString(),
    },
    {
      id: 'req_amina',
      userId: 'u_amina',
      userName: 'Amina Benali',
      userEmail: 'amina.benali@email.com',
      type: 'initial',
      receipt: {
        dataUrl: aminaReceipt,
        name: 'recu-amina-benali.svg',
        mime: 'image/svg+xml',
        size: 6_400,
      },
      status: 'pending',
      createdAt: addDays(now, -1).toISOString(),
    },
    {
      id: 'req_sarah',
      userId: 'u_sarah',
      userName: 'Sarah Lemoine',
      userEmail: 'sarah.lemoine@email.com',
      type: 'renewal',
      receipt: {
        dataUrl: sarahReceipt,
        name: 'recu-sarah-lemoine.svg',
        mime: 'image/svg+xml',
        size: 6_400,
      },
      status: 'pending',
      createdAt: addDays(now, -0.25).toISOString(),
    },
    {
      id: 'req_thomas',
      userId: 'u_thomas',
      userName: 'Thomas Petit',
      userEmail: 'thomas.petit@email.com',
      type: 'initial',
      receipt: {
        dataUrl: thomasReceipt,
        name: 'recu-thomas-petit.svg',
        mime: 'image/svg+xml',
        size: 6_400,
      },
      status: 'rejected',
      createdAt: addDays(now, -25).toISOString(),
      reviewedAt: addDays(now, -24).toISOString(),
      note: 'Reçu illisible.',
    },
  ]

  const attempts: Attempt[] = [
    seedAttempt(
      { userId: 'u_jean', subjectId: activeSubjectId, daysAgo: 2 },
      activeQuestions,
      18,
      0,
    ),
    seedAttempt(
      { userId: 'u_jean', subjectId: activeSubjectId, daysAgo: 5 },
      activeQuestions,
      15,
      7,
    ),
    seedAttempt(
      { userId: 'u_jean', subjectId: activeSubjectId, daysAgo: 9 },
      activeQuestions,
      17,
      13,
    ),
    seedAttempt(
      { userId: 'u_jean', subjectId: activeSubjectId, daysAgo: 14 },
      activeQuestions,
      12,
      3,
    ),
    seedAttempt(
      { userId: 'u_lucas', subjectId: activeSubjectId, daysAgo: 6 },
      activeQuestions,
      11,
      5,
    ),
    seedAttempt(
      { userId: 'u_lucas', subjectId: activeSubjectId, daysAgo: 12 },
      activeQuestions,
      14,
      9,
    ),
    seedAttempt(
      { userId: 'u_sarah', subjectId: activeSubjectId, daysAgo: 4 },
      activeQuestions,
      16,
      2,
    ),
    seedAttempt(
      { userId: 'u_sarah', subjectId: activeSubjectId, daysAgo: 10 },
      activeQuestions,
      19,
      11,
    ),
    seedAttempt(
      { userId: 'u_clara', subjectId: activeSubjectId, daysAgo: 3 },
      activeQuestions,
      13,
      6,
    ),
    seedAttempt(
      { userId: 'u_yanis', subjectId: activeSubjectId, daysAgo: 1 },
      activeQuestions,
      17,
      4,
    ),
  ]

  // Keep attempt ids unique even when two attempts share the same daysAgo key.
  attempts.forEach((attempt, index) => {
    attempt.id = `attempt_seed_${index + 1}`
  })

  return {
    version: 2,
    users,
    requests,
    subjects: [activeSubject, queueSubject2, queueSubject3, archivedSubject],
    assignments,
    questions: [
      ...activeQuestions,
      ...queueSubject2Questions,
      ...queueSubject3Questions,
      ...archivedQuestions,
    ],
    attempts,
  }
}

export function randomQuestionIds(questions: Question[], count = SERIES_SIZE) {
  return shuffle(questions).slice(0, count).map((q) => q.id)
}
