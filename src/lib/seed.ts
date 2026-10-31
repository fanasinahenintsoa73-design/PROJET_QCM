import type { Attempt, Database, Question, Subject, SubjectAssignment } from '@/types'
import { addDays, monthLabel, SERIES_SIZE, shuffle, sameAnswer } from '@/lib/utils'
import { PACE_THEMES } from '@/lib/themes'

interface SeedQuestion {
  statement: string
  options: [string, string, string, string]
  correct: 'A' | 'B' | 'C' | 'D'
  explanation: string
}

function toSeedQuestion(
  question: SeedQuestion,
  theme: (typeof PACE_THEMES)[number],
  index: number,
): Question {
  const [A, B, C, D] = question.options
  return {
    id: `q_${theme.id}_${index + 1}`,
    subjectId: theme.id,
    number: index + 1,
    matiere: theme.title,
    statement: question.statement,
    options: { A, B, C, D },
    correctAnswers: [question.correct],
    explanation: question.explanation,
  }
}

export const PROFESSOR_FIRST_NAME = 'Sun'
export const PROFESSOR_LAST_NAME = 'RAZAFIMANDIMBY'

/**
 * Dix questions à réponse unique par thème PACES. Les banques de démonstration
 * couvrent volontairement les neuf thèmes pour que chaque carte du tableau de
 * bord ouvre une série complète.
 */
const THEME_BANKS: SeedQuestion[][] = [
  [
    {
      statement: 'Quel organite est le siège de la synthèse protéique ?',
      options: ['Le lysosome', 'Le ribosome', 'Le peroxysome', "L'appareil de Golgi"],
      correct: 'B',
      explanation:
        "Les ribosomes assurent la traduction de l'ARN messager en protéines. Libres dans le cytosol, ils synthétisent les protéines intracellulaires ; fixés au réticulum endoplasmique rugueux, ils produisent les protéines sécrétées ou membranaires.",
    },
    {
      statement: "La réplication de l'ADN a lieu pendant :",
      options: ['La phase G1', 'La phase S', 'La phase G2', 'La mitose'],
      correct: 'B',
      explanation:
        "La phase S (synthèse) du cycle cellulaire correspond à la réplication de l'ADN. La cellule passe ensuite en phase G2, où elle vérifie l'intégrité du génome avant d'entrer en mitose.",
    },
    {
      statement: "L'apoptose correspond à :",
      options: [
        'Une nécrose tissulaire',
        'Une mort cellulaire programmée',
        'Une division cellulaire',
        'Une étape de différenciation',
      ],
      correct: 'B',
      explanation:
        "L'apoptose est une mort cellulaire programmée, active et physiologique. Elle se distingue de la nécrose par l'absence de réaction inflammatoire, la condensation de la chromatine et la formation de corps apoptotiques.",
    },
    {
      statement: "L'ADN mitochondrial est transmis :",
      options: [
        'Par le père uniquement',
        'Par la mère uniquement',
        'Par les deux parents à parts égales',
        'De façon entièrement aléatoire',
      ],
      correct: 'B',
      explanation:
        "L'ADN mitochondrial est d'origine maternelle : les mitochondries du spermatozoïde ne persistent pas dans l'ovocyte fécondé. Cette transmission explique l'expression maternelle de certaines maladies mitochondriales.",
    },
    {
      statement: 'Le modèle de la mosaïque fluide décrit :',
      options: [
        'La structure de la membrane plasmique',
        'La disposition des chromosomes',
        'La synthèse des protéines',
        'La dégradation des organites',
      ],
      correct: 'A',
      explanation:
        "Le modèle de la mosaïque fluide représente la membrane comme une bicouche lipidique dans laquelle les protéines se déplacent latéralement. Cette organisation dynamique explique la perméabilité sélective et la fluidité membranaire.",
    },
    {
      statement: 'Le réticulum endoplasmique rugueux est impliqué dans :',
      options: [
        'La synthèse des protéines sécrétées',
        'La β-oxydation des acides gras',
        'La dégradation des lipides',
        "La réplication de l'ADN",
      ],
      correct: 'A',
      explanation:
        "Le réticulum endoplasmique rugueux est couvert de ribosomes et assure la synthèse des protéines destinées à la sécrétion ou à la membrane. La β-oxydation se déroule dans les mitochondries et la dégradation des lipides dans les lysosomes.",
    },
    {
      statement: 'Quel organite contient les enzymes hydrolytiques de la digestion intracellulaire ?',
      options: ['Le noyau', 'La mitochondrie', 'Le lysosome', 'Le centriole'],
      correct: 'C',
      explanation:
        "Les lysosomes sont des vésicules riches en hydrolases acides. Ils dégradent les macromolécules, les organites usés et les particules captées par endocytose. Leur pH interne acide est maintenu par une pompe à protons.",
    },
    {
      statement: 'La condensation des chromosomes devient visible pendant :',
      options: ['La prophase', 'La télophase', "L'anaphase", 'La phase G1'],
      correct: 'A',
      explanation:
        "La prophase est la première phase de la mitose : la chromatine se condense en chromosomes visibles, l'enveloppe nucléaire commence à se dissocier et le fuseau mitotique se met en place.",
    },
    {
      statement: 'La différenciation cellulaire correspond à :',
      options: [
        'Une augmentation du nombre de cellules',
        'Une spécialisation structurelle et fonctionnelle',
        'Une fragmentation de la membrane',
        'Une réplication de l’ADN',
      ],
      correct: 'B',
      explanation:
        "La différenciation est le processus par lequel une cellule acquiert une structure et des fonctions spécialisées, malgré un patrimoine génétique identique. Elle repose sur une expression génique sélective.",
    },
    {
      statement: 'Le transport actif se distingue du transport passif par :',
      options: [
        'Sa direction toujours descendante',
        "Sa consommation d'énergie",
        'Son absence de protéine',
        'Sa rapidité toujours supérieure',
      ],
      correct: 'B',
      explanation:
        "Le transport actif déplace une substance contre son gradient de concentration et nécessite de l'énergie, souvent fournie par l'ATP. Le transport passif se fait selon le gradient, par diffusion simple ou facilitée.",
    },
  ],
  [
    {
      statement: "L'épithélium tapissant les alvéoles pulmonaires est :",
      options: [
        'Un épithélium simple pavimenteux',
        'Un épithélium stratifié pavimenteux',
        'Un épithélium simple cubique',
        'Un épithélium pseudostratifié',
      ],
      correct: 'A',
      explanation:
        "Les alvéoles sont tapissées d'un épithélium simple pavimenteux, très fin, composé notamment de pneumocytes de type I. Cette finesse est essentielle aux échanges gazeux. Les pneumocytes de type II produisent le surfactant.",
    },
    {
      statement: 'Le cartilage hyalin est :',
      options: [
        'Richement vascularisé',
        'Avasculaire',
        'Innervé',
        'Constitué de 90 % de cellules',
      ],
      correct: 'B',
      explanation:
        "Le cartilage est avasculaire et non innervé : il est nourri par diffusion à partir du liquide synovial ou du périchondre. Cette particularité explique sa cicatrisation lente et la nécessité d'une immobilisation prolongée après une lésion.",
    },
    {
      statement: 'Les cellules β des îlots de Langerhans sécrètent :',
      options: [
        'Le glucagon',
        "L'insuline",
        'La somatostatine',
        'Le polypeptide pancréatique',
      ],
      correct: 'B',
      explanation:
        "Les cellules β des îlots pancréatiques produisent l'insuline, hormone hypoglycémiante. Les cellules α sécrètent le glucagon, les cellules δ la somatostatine et les cellules PP le polypeptide pancréatique.",
    },
    {
      statement: 'Quel leucocyte est le plus abondant dans le sang circulant ?',
      options: ['Le lymphocyte', 'Le neutrophile', "L'éosinophile", 'Le basophile'],
      correct: 'B',
      explanation:
        "Les neutrophiles représentent environ 50 à 70 % des leucocytes circulants. Ils constituent la première ligne de défense contre les bactéries et sont recrutés rapidement sur le site de l'inflammation.",
    },
    {
      statement: 'La principale protéine fibreuse du tissu conjonctif est :',
      options: ['La kératine', 'Le collagène', 'La myosine', "L'actine"],
      correct: 'B',
      explanation:
        "Le collagène est la protéine la plus abondante du tissu conjonctif et de l'organisme. Il forme des fibres résistantes à la traction et participe à l'architecture de la peau, des tendons, des os et des vaisseaux.",
    },
    {
      statement: "L'épiderme est un épithélium :",
      options: [
        'Simple cubique non kératinisé',
        'Stratifié pavimenteux kératinisé',
        'Pseudostratifié cilié',
        'Simple pavimenteux',
      ],
      correct: 'B',
      explanation:
        "L'épiderme est un épithélium stratifié pavimenteux kératinisé. Les cellules se renouvellent depuis la couche basale et se différencient progressivement en cornéocytes riches en kératine, qui forment la barrière cutanée.",
    },
    {
      statement: 'Les cellules musculaires striées squelettiques possèdent :',
      options: [
        'Un noyau central unique',
        'De nombreux noyaux périphériques',
        'Aucun noyau',
        'Deux noyaux centraux',
      ],
      correct: 'B',
      explanation:
        "Les fibres musculaires squelettiques sont des cellules plurinucléées issues de la fusion de myoblastes. Leurs noyaux sont situés à la périphérie, sous la membrane plasmique, contrairement au muscle cardiaque dont les noyaux sont centraux.",
    },
    {
      statement: 'Le tissu osseux compact est organisé en :',
      options: ['Ostéons', 'Alvéoles', 'Villosités', 'Glomérules'],
      correct: 'A',
      explanation:
        "Le tissu osseux compact est constitué d'ostéons, unités cylindriques formées de lamelles osseuses concentriques autour d'un canal de Havers. Cette organisation donne à l'os sa résistance mécanique.",
    },
    {
      statement: 'Le plasma représente environ quelle proportion du volume sanguin ?',
      options: ['10 %', '25 %', '55 %', '90 %'],
      correct: 'C',
      explanation:
        "Le plasma correspond à environ 55 % du volume sanguin ; les éléments figurés (globules rouges, globules blancs et plaquettes) représentent le reste. Le plasma est composé d'eau, de protéines, d'électrolytes et de nutriments.",
    },
    {
      statement: 'Une glande exocrine se distingue d’une glande endocrine par :',
      options: [
        'L’absence de vaisseaux',
        'L’émission de sa sécrétion par un canal',
        'La production d’hormones uniquement',
        'Sa localisation exclusivement hépatique',
      ],
      correct: 'B',
      explanation:
        "Une glande exocrine déverse sa sécrétion à la surface ou dans un conduit, tandis qu'une glande endocrine libère ses hormones directement dans le sang. Le pancréas possède les deux types de sécrétion.",
    },
  ],
  [
    {
      statement: 'La glycolyse anaérobie produit un bilan net de :',
      options: ['2 ATP', '4 ATP', '36 ATP', '0 ATP'],
      correct: 'A',
      explanation:
        "La glycolyse consomme 2 ATP et en produit 4 : le bilan net est de 2 ATP par molécule de glucose. La voie aérobie, via la phosphorylation oxydative, permet un rendement bien supérieur (environ 30 à 32 ATP).",
    },
    {
      statement: "L'enzyme limitante de la glycolyse est :",
      options: [
        "L'hexokinase",
        'La phosphofructokinase-1',
        'La pyruvate kinase',
        'La lactate déshydrogénase',
      ],
      correct: 'B',
      explanation:
        "La phosphofructokinase-1 (PFK-1) catalyse la conversion du fructose-6-phosphate en fructose-1,6-bisphosphate. C'est l'étape irréversible et le principal point de régulation de la glycolyse, activé par l'AMP et inhibé par l'ATP et le citrate.",
    },
    {
      statement: 'Le cycle de Krebs se déroule dans :',
      options: [
        'Le cytoplasme',
        'La membrane externe mitochondriale',
        'La matrice mitochondriale',
        'Le noyau',
      ],
      correct: 'C',
      explanation:
        "Le cycle de Krebs (ou cycle de l'acide citrique) se déroule dans la matrice mitochondriale, sauf l'enzyme succinate déshydrogénase, ancrée à la membrane interne. Il génère du NADH, du FADH₂ et du GTP.",
    },
    {
      statement: 'Laquelle de ces vitamines est hydrosoluble ?',
      options: ['La vitamine A', 'La vitamine D', 'La vitamine C', 'La vitamine K'],
      correct: 'C',
      explanation:
        "La vitamine C (acide ascorbique) est hydrosoluble : elle est éliminée dans les urines et doit être apportée quotidiennement. Les vitamines A, D, E et K sont liposolubles et peuvent s'accumuler dans l'organisme.",
    },
    {
      statement: 'Lequel de ces acides aminés est essentiel ?',
      options: ["L'alanine", 'La glycine', 'La leucine', 'La glutamine'],
      correct: 'C',
      explanation:
        "La leucine fait partie des neuf acides aminés essentiels, non synthétisés par l'organisme et devant être apportés par l'alimentation. L'alanine, la glycine et la glutamine sont synthétisables par l'organisme.",
    },
    {
      statement: 'La liaison peptidique s’établit entre :',
      options: [
        'Deux acides gras',
        'Le groupe carboxyle d’un acide aminé et le groupe amine d’un autre',
        'Deux bases azotées',
        'Un glucose et un phosphate',
      ],
      correct: 'B',
      explanation:
        "La liaison peptidique résulte d'une condensation entre le groupe carboxyle d'un acide aminé et le groupe amine du suivant, avec libération d'une molécule d'eau. Elle forme le squelette des protéines.",
    },
    {
      statement: 'Dans la double hélice d’ADN, l’adénine s’apparie avec :',
      options: ['La guanine', 'La cytosine', 'La thymine', "L'uracile"],
      correct: 'C',
      explanation:
        "L'adénine s'apparie avec la thymine par deux liaisons hydrogène, tandis que la guanine s'apparie avec la cytosine par trois liaisons. Dans l'ARN, l'adénine s'apparie avec l'uracile.",
    },
    {
      statement: 'Une enzyme accélère une réaction en :',
      options: [
        'Augmentant l’énergie d’activation',
        'Abaissant l’énergie d’activation',
        'Consommant les produits',
        'Modifiant le patrimoine génétique',
      ],
      correct: 'B',
      explanation:
        "Les enzymes sont des catalyseurs biologiques : elles abaissent l'énergie d'activation nécessaire à la réaction sans être consommées. Elles augmentent ainsi la vitesse de réaction sans modifier l'équilibre final.",
    },
    {
      statement: 'Un acide gras saturé possède :',
      options: [
        'Une ou plusieurs doubles liaisons',
        'Aucune double liaison carbone-carbone',
        'Un groupement phosphate',
        'Toujours une chaîne cyclique',
      ],
      correct: 'B',
      explanation:
        "Un acide gras saturé ne comporte aucune double liaison entre ses atomes de carbone ; sa chaîne est linéaire. Les acides gras insaturés possèdent une ou plusieurs doubles liaisons, souvent cis.",
    },
    {
      statement: 'Une solution de pH 5 est :',
      options: ['Acide', 'Neutre', 'Basique', 'Inclassable'],
      correct: 'A',
      explanation:
        "Le pH mesure l'acidité d'une solution. Un pH inférieur à 7 est acide, un pH égal à 7 est neutre et un pH supérieur à 7 est basique. Le pH 5 correspond donc à une solution acide.",
    },
  ],
  [
    {
      statement: 'Le débit cardiaque est égal à :',
      options: [
        'Fréquence cardiaque ÷ volume d’éjection systolique',
        'Fréquence cardiaque × volume d’éjection systolique',
        'Volume d’éjection systolique × pression artérielle',
        'Fréquence cardiaque + volume d’éjection systolique',
      ],
      correct: 'B',
      explanation:
        "Le débit cardiaque (Q) correspond au volume de sang éjecté par minute : Q = FC × VES. Au repos, il est d'environ 5 L/min chez l'adulte. Il augmente à l'effort par élévation de la fréquence et du volume d'éjection.",
    },
    {
      statement: 'Dans le nœud sinusal, la phase 0 du potentiel d’action est principalement due à :',
      options: [
        'Une entrée rapide de sodium',
        'Une entrée lente de calcium',
        'Une sortie de potassium',
        'Une sortie de chlore',
      ],
      correct: 'B',
      explanation:
        "Les cellules pacemaker du nœud sinusal ont un potentiel d'action « lent », dépendant du courant calcique de type L. Contrairement aux cellules myocardiques contractiles, la phase 0 n'est pas portée par le sodium rapide.",
    },
    {
      statement: 'Où la pression partielle en oxygène (PaO₂) est-elle la plus élevée ?',
      options: [
        'Dans le sang veineux pulmonaire',
        'Dans les alvéoles pulmonaires',
        'Dans le sang veineux systémique',
        'Dans les tissus périphériques',
      ],
      correct: 'B',
      explanation:
        "L'air alvéolaire est le compartiment le plus riche en oxygène (PaO₂ ≈ 100 mmHg), ce qui permet le passage de l'O₂ vers le sang capillaire. Le sang artériel systémique est légèrement moins oxygéné (≈ 95 mmHg) en raison du shunt physiologique.",
    },
    {
      statement: 'Quel volume de plasma est filtré chaque jour par les deux reins ?',
      options: ['18 litres', '80 litres', '180 litres', '1 800 litres'],
      correct: 'C',
      explanation:
        "Le débit de filtration glomérulaire est d'environ 125 mL/min, soit 180 L de plasma filtré par jour. La quasi-totalité est réabsorbée : le volume urinaire final n'est que de 1 à 2 L.",
    },
    {
      statement: 'Quelle hormone abaisse la glycémie ?',
      options: ['Le glucagon', "L'insuline", 'Le cortisol', "L'adrénaline"],
      correct: 'B',
      explanation:
        "L'insuline, sécrétée par les cellules β du pancréas, favorise l'entrée du glucose dans les cellules et le stockage sous forme de glycogène. Le glucagon, le cortisol et l'adrénaline sont des hormones hyperglycémiantes.",
    },
    {
      statement: "La surface d'échange alvéolaire totale est d'environ :",
      options: ['7 m²', '70 m²', '700 m²', '7 000 m²'],
      correct: 'B',
      explanation:
        "La surface alvéolaire totale est d'environ 70 m², soit la taille d'un court de tennis, répartie sur des centaines de millions d'alvéoles. Elle est réduite dans l'emphysème, ce qui altère les échanges gazeux.",
    },
    {
      statement: 'Le volume courant respiratoire chez l’adulte au repos est d’environ :',
      options: ['50 mL', '500 mL', '2 500 mL', '5 000 mL'],
      correct: 'B',
      explanation:
        "Le volume courant est le volume d'air mobilisé lors d'une respiration normale, soit environ 500 mL. Il ne faut pas le confondre avec la capacité vitale, qui atteint environ 4 à 5 L.",
    },
    {
      statement: 'La clairance de la créatinine permet d’estimer :',
      options: [
        'Le débit de filtration glomérulaire',
        'La concentration plasmatique en glucose',
        'Le volume sanguin total',
        'La pression artérielle moyenne',
      ],
      correct: 'A',
      explanation:
        "La clairance de la créatinine reflète la capacité du rein à éliminer la créatinine et sert à estimer le débit de filtration glomérulaire. Une baisse de la clairance traduit une insuffisance rénale.",
    },
    {
      statement: "L'hormone antidiurétique (ADH) favorise :",
      options: [
        'La réabsorption rénale de l’eau',
        'L’excrétion rénale de l’eau',
        'La sécrétion de sodium',
        'La diurèse abondante',
      ],
      correct: 'A',
      explanation:
        "L'ADH, sécrétée par l'hypothalamus et libérée par la post-hypophyse, augmente la perméabilité des canaux collecteurs à l'eau. Elle réduit ainsi le volume urinaire et concentre les urines.",
    },
    {
      statement: 'La fréquence cardiaque normale de repos chez l’adulte est de :',
      options: ['20 à 40 bpm', '40 à 60 bpm', '60 à 100 bpm', '120 à 160 bpm'],
      correct: 'C',
      explanation:
        "La fréquence cardiaque de repos chez l'adulte est habituellement comprise entre 60 et 100 battements par minute. Une fréquence inférieure à 60 bpm définit une bradycardie et une fréquence supérieure à 100 bpm une tachycardie.",
    },
  ],
  [
    {
      statement: 'Combien de paires de côtes comporte le squelette thoracique humain ?',
      options: ['10 paires', '11 paires', '12 paires', '14 paires'],
      correct: 'C',
      explanation:
        "Le thorax comporte 12 paires de côtes : 7 vraies côtes qui s'articulent directement au sternum, 3 fausses côtes qui rejoignent le cartilage sus-jacent et 2 côtes flottantes. Les côtes 11 et 12 sont les seules à ne pas atteindre le sternum.",
    },
    {
      statement: "Quel nerf assure l'innervation motrice principale du diaphragme ?",
      options: [
        'Le nerf intercostal',
        'Le nerf phrénique',
        'Le nerf spinal accessoire',
        'Le nerf hypoglosse',
      ],
      correct: 'B',
      explanation:
        "Le nerf phrénique naît des racines cervicales C3-C4-C5 (« C3, 4, 5 keep the diaphragm alive »). Il innerve la motricité du diaphragme et participe à sa sensibilité. Une lésion bilatérale provoque une paralysie diaphragmatique grave.",
    },
    {
      statement: "L'artère coronaire gauche se divise classiquement en :",
      options: [
        'Artère interventriculaire antérieure et artère circonflexe',
        'Coronaire droite et artère marginale',
        'Artère gastrique et artère splénique',
        'Artère pulmonaire et aorte',
      ],
      correct: 'A',
      explanation:
        "Le tronc commun gauche se bifurque en artère interventriculaire antérieure (IVA) et artère circonflexe. L'IVA vascularise la paroi antérieure du ventricule gauche et le septum antérieur ; la circonflexe irrigue la paroi latérale.",
    },
    {
      statement: 'Le cœur se situe dans :',
      options: [
        'Le médiastin antérieur',
        'Le médiastin moyen',
        'Le médiastin postérieur',
        'La cavité pleurale gauche',
      ],
      correct: 'B',
      explanation:
        "Le cœur siège dans le médiastin moyen, entre les deux poumons, en arrière du sternum et en avant de l'œsophage. Le médiastin antérieur contient le thymus et le médiastin postérieur l'œsophage, l'aorte thoracique et la trachée.",
    },
    {
      statement: 'Lequel de ces os appartient au membre inférieur ?',
      options: ["L'humérus", 'Le radius', 'Le fémur', 'La scapula'],
      correct: 'C',
      explanation:
        "Le fémur est l'os unique de la cuisse et le plus long du corps. L'humérus, le radius et la scapula appartiennent au membre supérieur. Le fémur s'articule avec le bassin par la hanche et avec le tibia par le genou.",
    },
    {
      statement: 'L’estomac se projette principalement dans :',
      options: [
        'L’hypochondre gauche et l’épigastre',
        'L’hypochondre droit et la fosse iliaque droite',
        'Le flanc droit',
        'Le pelvis',
      ],
      correct: 'A',
      explanation:
        "L'estomac occupe l'épigastre et l'hypochondre gauche. Sa situation explique la douleur épigastrique des gastrites et des ulcères, ainsi que la possibilité d'une irradiation dorsale.",
    },
    {
      statement: 'Le foie est situé dans :',
      options: [
        'Le quadrant supérieur droit de l’abdomen',
        'Le quadrant inférieur gauche',
        'La cavité thoracique gauche',
        'Le rétropéritoine gauche',
      ],
      correct: 'A',
      explanation:
        "Le foie occupe principalement l'hypochondre droit et l'épigastre, sous le diaphragme. Il est protégé par la cage thoracique et reste mobile avec la respiration.",
    },
    {
      statement: 'Les reins sont des organes :',
      options: ['Intrapéritonéaux', 'Rétropéritonéaux', 'Sous-cutanés', 'Intrathoraciques'],
      correct: 'B',
      explanation:
        "Les reins sont situés dans l'espace rétropéritonéal, de part et d'autre de la colonne lombaire. Cette position explique la douleur lombaire des pyélonéphrites et la possibilité d'une atteinte des organes voisins.",
    },
    {
      statement: 'La trachée se divise en :',
      options: [
        'Deux bronches souches',
        'Quatre bronchioles',
        'Une bronche unique',
        'Deux œsophages',
      ],
      correct: 'A',
      explanation:
        "La trachée bifurque au niveau de la carène en deux bronches souches, droite et gauche. La bronche souche droite est plus verticale, ce qui favorise l'inhalation de corps étrangers dans le poumon droit.",
    },
    {
      statement: 'L’aorte thoracique descendante se situe dans :',
      options: [
        'Le médiastin postérieur',
        'Le médiastin antérieur',
        'La cavité péricardique',
        'Le médiastin moyen',
      ],
      correct: 'A',
      explanation:
        "L'aorte thoracique descendante chemine dans le médiastin postérieur, le long de la colonne vertébrale, avant de traverser le diaphragme. Elle donne notamment les artères intercostales et œsophagiennes.",
    },
  ],
  [
    {
      statement: 'La moyenne des valeurs 4, 6, 8 et 10 est :',
      options: ['6', '7', '8', '9'],
      correct: 'B',
      explanation:
        "La moyenne se calcule en additionnant les valeurs puis en divisant par leur nombre : (4 + 6 + 8 + 10) / 4 = 28 / 4 = 7.",
    },
    {
      statement: 'La probabilité d’obtenir pile lors d’un lancer d’une pièce équilibrée est :',
      options: ['0', '1/4', '1/2', '1'],
      correct: 'C',
      explanation:
        "Une pièce équilibrée présente deux issues equiprobables, pile et face. La probabilité de chaque issue est donc de 1/2, soit 50 %.",
    },
    {
      statement: 'La médiane de la série 3, 5, 7, 9, 11 est :',
      options: ['5', '6', '7', '9'],
      correct: 'C',
      explanation:
        "La médiane est la valeur centrale d'une série ordonnée. Ici, la troisième valeur parmi cinq est 7 : elle sépare la série en deux groupes de même effectif.",
    },
    {
      statement: 'Un litre correspond à :',
      options: ['10 mL', '100 mL', '1 000 mL', '10 000 mL'],
      correct: 'C',
      explanation:
        "1 L = 1 000 mL = 1 dm³. Cette conversion est indispensable pour les calculs de concentration et de débit de perfusion.",
    },
    {
      statement: 'Une concentration de 2 g pour 100 mL correspond à :',
      options: ['2 g/L', '10 g/L', '20 g/L', '200 g/L'],
      correct: 'C',
      explanation:
        "2 g dans 100 mL représente 20 g dans 1 000 mL, soit 20 g/L. Le passage de 100 mL à 1 L multiplie la quantité par 10.",
    },
    {
      statement: 'La loi de Beer-Lambert indique que l’absorbance est proportionnelle à :',
      options: [
        'La concentration de la solution',
        'La température corporelle',
        'La fréquence cardiaque',
        'La masse osseuse',
      ],
      correct: 'A',
      explanation:
        "L'absorbance est proportionnelle à la concentration de la substance absorbante et à la longueur du trajet optique. Cette relation est utilisée en spectrophotométrie pour doser des solutions.",
    },
    {
      statement: 'L’écart-type mesure :',
      options: [
        'La valeur centrale d’une série',
        'La dispersion des valeurs autour de la moyenne',
        'Le nombre total de valeurs',
        'La valeur maximale',
      ],
      correct: 'B',
      explanation:
        "L'écart-type quantifie la dispersion des observations autour de la moyenne. Un écart-type faible indique des valeurs proches de la moyenne ; un écart-type élevé indique une plus grande hétérogénéité.",
    },
    {
      statement: 'Un mètre correspond à :',
      options: ['10 cm', '100 cm', '1 000 cm', '10 000 cm'],
      correct: 'B',
      explanation:
        "1 m = 100 cm = 1 000 mm. Les unités de longueur doivent être homogènes avant tout calcul de surface ou de volume.",
    },
    {
      statement: '20 % de 250 est égal à :',
      options: ['25', '40', '50', '100'],
      correct: 'C',
      explanation:
        "20 % de 250 = 0,20 × 250 = 50. Les pourcentages sont également utiles pour interpréter les réductions de risque et les prévalences.",
    },
    {
      statement: 'La sensibilité d’un test mesure :',
      options: [
        'La proportion de vrais positifs parmi les malades',
        'La proportion de vrais négatifs parmi les bien portants',
        'La précision de la moyenne',
        'Le nombre de tests réalisés',
      ],
      correct: 'A',
      explanation:
        "La sensibilité est la capacité d'un test à détecter les personnes malades : elle correspond au nombre de vrais positifs divisé par le nombre total de malades. Elle s'oppose à la spécificité, qui mesure les vrais négatifs chez les bien portants.",
    },
  ],
  [
    {
      statement: 'Quel est l’effet indésirable caractéristique des aminosides ?',
      options: [
        'Une hépatotoxicité isolée',
        'Une néphrotoxicité et une ototoxicité',
        'Une photosensibilisation',
        'Une hypothyroïdie',
      ],
      correct: 'B',
      explanation:
        "Les aminosides (gentamicine, amikacine) sont néphrotoxiques et ototoxiques, avec un risque de surdité irréversible. Leur administration impose une surveillance de la fonction rénale et des taux plasmatiques.",
    },
    {
      statement:
        'Quelle classe thérapeutique réduit la sécrétion gastrique en inhibant la pompe H⁺/K⁺-ATPase ?',
      options: [
        'Les anti-H₂',
        'Les inhibiteurs de la pompe à protons',
        'Les antacides',
        'Les prokinétiques',
      ],
      correct: 'B',
      explanation:
        "Les inhibiteurs de la pompe à protons (oméprazole, ésoméprazole) bloquent la pompe H⁺/K⁺-ATPase des cellules pariétales et réduisent fortement la sécrétion acide. Les anti-H₂ agissent sur le récepteur histaminique, en amont.",
    },
    {
      statement: 'Lequel de ces médicaments est un anticoagulant oral direct ?',
      options: ['La warfarine', "L'apixaban", "L'héparine non fractionnée", "L'aspirine"],
      correct: 'B',
      explanation:
        "L'apixaban est un inhibiteur direct du facteur Xa, administré par voie orale. La warfarine est un antivitamine K, l'héparine est parentérale et l'aspirine est un antiagrégant plaquettaire, pas un anticoagulant.",
    },
    {
      statement: 'Le paracétamol peut provoquer une atteinte grave de quel organe en cas de surdosage ?',
      options: ['Le foie', 'Le poumon', 'Le cœur', 'La thyroïde'],
      correct: 'A',
      explanation:
        "Le paracétamol est hépatotoxique à forte dose : son métabolite toxique épuise le glutathion hépatique et provoque une nécrose. Le traitement repose sur l'arrêt du médicament et l'administration précoce de N-acétylcystéine.",
    },
    {
      statement: 'La pharmacocinétique étudie :',
      options: [
        'Le devenir du médicament dans l’organisme',
        'La seule action du médicament sur le récepteur',
        'La fabrication industrielle',
        'Le prix du médicament',
      ],
      correct: 'A',
      explanation:
        "La pharmacocinétique décrit l'absorption, la distribution, le métabolisme et l'élimination d'un médicament. Elle s'oppose à la pharmacodynamie, qui étudie les effets du médicament sur l'organisme.",
    },
    {
      statement: 'Après une administration intraveineuse, la biodisponibilité est :',
      options: ['0 %', '25 %', '50 %', '100 %'],
      correct: 'D',
      explanation:
        "La voie intraveineuse contourne l'absorption et le premier passage hépatique : la totalité du médicament atteint la circulation systémique, ce qui définit une biodisponibilité de 100 %.",
    },
    {
      statement: 'La demi-vie d’élimination correspond au temps nécessaire pour :',
      options: [
        'Éliminer la moitié de la concentration plasmatique',
        'Éliminer la totalité du médicament',
        'Atteindre la concentration maximale',
        'Apparaître le premier effet indésirable',
      ],
      correct: 'A',
      explanation:
        "La demi-vie est le temps au bout duquel la concentration plasmatique diminue de moitié. Elle conditionne la fréquence d'administration et le temps nécessaire pour atteindre l'état d'équilibre.",
    },
    {
      statement: 'Un médicament inhibiteur de la cyclo-oxygénase (COX) appartient à la classe des :',
      options: ['Antibiotiques', 'Anti-inflammatoires non stéroïdiens', 'Anticoagulants', 'Antihypertenseurs'],
      correct: 'B',
      explanation:
        "Les AINS, comme l'ibuprofène ou le diclofénac, inhibent la cyclo-oxygénase et réduisent la synthèse des prostaglandines. Ils ont des effets antalgiques, antipyrétiques et anti-inflammatoires, avec un risque digestif et rénal.",
    },
    {
      statement: 'Une réaction d’hypersensibilité immédiate aux pénicillines peut provoquer :',
      options: [
        'Un choc anaphylactique',
        'Une hyperglycémie isolée',
        'Une augmentation de la diurèse',
        'Une mydriase',
      ],
      correct: 'A',
      explanation:
        "Les pénicillines peuvent déclencher une réaction allergique immédiate, parfois un choc anaphylactique. La recherche d'antécédents allergiques est systématique avant prescription, et l'adrénaline est le traitement d'urgence.",
    },
    {
      statement: 'Un effet indésirable médicamenteux est :',
      options: [
        'Un effet néfaste lié au médicament',
        'L’effet thérapeutique recherché',
        'Un effet réservé aux vaccins',
        'Une interaction alimentaire uniquement',
      ],
      correct: 'A',
      explanation:
        "Un effet indésirable est une réaction nocive et non désirée liée à l'utilisation d'un médicament. Il peut survenir aux doses thérapeutiques et doit être déclaré au système de pharmacovigilance.",
    },
  ],
  [
    {
      statement: 'Le terme « dyspnée » désigne :',
      options: [
        'Une difficulté à respirer',
        'Une douleur thoracique',
        'Une perte de connaissance',
        'Une augmentation de l’appétit',
      ],
      correct: 'A',
      explanation:
        "La dyspnée est la perception subjective d'une difficulté respiratoire. Elle peut être d'origine pulmonaire, cardiaque, métabolique ou psychique et doit être qualifiée par son mode d'apparition et son intensité.",
    },
    {
      statement: 'Une « céphalée » correspond à :',
      options: ['Un mal de tête', 'Une douleur abdominale', 'Une douleur dentaire', 'Une douleur lombaire'],
      correct: 'A',
      explanation:
        "La céphalée est une douleur de la tête. Elle peut être primaire (migraine, céphalée de tension) ou secondaire à une cause infectieuse, vasculaire, tumorale ou toxique.",
    },
    {
      statement: 'L’« hématurie » désigne la présence de sang :',
      options: ['Dans les urines', 'Dans les selles', 'Dans les crachats', 'Dans le liquide céphalorachidien'],
      correct: 'A',
      explanation:
        "L'hématurie est l'émission de sang dans les urines. Elle peut être macroscopique ou microscopique et impose une enquête étiologique : infection, lithiase, tumeur ou maladie glomérulaire.",
    },
    {
      statement: 'L’« apyrexie » correspond à :',
      options: [
        'L’absence de fièvre',
        'Une fièvre élevée',
        'Une baisse de la tension artérielle',
        'Une accélération du pouls',
      ],
      correct: 'A',
      explanation:
        "L'apyrexie est l'absence de fièvre, c'est-à-dire une température corporelle normale. Le préfixe « a- » indique la privation, comme dans apnée ou anurie.",
    },
    {
      statement: 'La « bradypnée » est :',
      options: [
        'Une respiration lente',
        'Une respiration rapide',
        'Une absence de respiration',
        'Une respiration bruyante',
      ],
      correct: 'A',
      explanation:
        "La bradypnée est une diminution de la fréquence respiratoire. Elle peut témoigner d'une dépression du centre respiratoire, d'une intoxication ou d'une cause neurologique.",
    },
    {
      statement: 'La « tachycardie » désigne :',
      options: [
        'Une fréquence cardiaque élevée',
        'Une fréquence cardiaque basse',
        'Une pression artérielle élevée',
        'Une température élevée',
      ],
      correct: 'A',
      explanation:
        "La tachycardie correspond à une fréquence cardiaque supérieure à 100 battements par minute chez l'adulte au repos. Elle peut être sinusale ou liée à un trouble du rythme.",
    },
    {
      statement: 'La « polyurie » se définit par :',
      options: [
        'Une production excessive d’urines',
        'Une absence d’urines',
        'Une douleur à la miction',
        'Une infection urinaire',
      ],
      correct: 'A',
      explanation:
        "La polyurie est une augmentation du volume urinaire, souvent supérieure à 3 L par jour. Elle peut être liée au diabète, à un diabète insipide ou à une prise excessive de diurétiques.",
    },
    {
      statement: 'L’« anamnèse » correspond à :',
      options: [
        'L’histoire de la maladie racontée par le patient',
        'L’examen physique',
        'La prescription du traitement',
        'La réalisation d’une prise de sang',
      ],
      correct: 'A',
      explanation:
        "L'anamnèse est le recueil des antécédents et de l'histoire de la maladie auprès du patient ou de son entourage. Elle précède l'examen clinique et oriente les examens complémentaires.",
    },
    {
      statement: 'Une maladie « idiopathique » est :',
      options: [
        'De cause inconnue',
        'D’origine infectieuse certaine',
        'Toujours héréditaire',
        'Toujours bénigne',
      ],
      correct: 'A',
      explanation:
        "Le terme idiopathique qualifie une maladie dont la cause n'est pas identifiée. Il ne signifie pas que la maladie est bénigne ou non traitable, mais que son mécanisme initial reste inconnu.",
    },
    {
      statement: 'Le « pronostic » d’une maladie désigne :',
      options: [
        'L’évolution prévisible de la maladie',
        'Le mode de transmission',
        'Le traitement de référence',
        'Le résultat d’un examen biologique',
      ],
      correct: 'A',
      explanation:
        "Le pronostic est l'évaluation de l'évolution probable de la maladie et de ses conséquences. Il se distingue du diagnostic, qui identifie la maladie, et du traitement, qui vise à la prendre en charge.",
    },
  ],
  [
    {
      statement: 'La prévention primaire intervient :',
      options: [
        'Avant l’apparition de la maladie',
        'Après le diagnostic',
        'Pendant la rééducation',
        'Uniquement en fin de vie',
      ],
      correct: 'A',
      explanation:
        "La prévention primaire vise à empêcher l'apparition d'une maladie chez des personnes indemnes : vaccination, lutte contre le tabagisme, alimentation équilibrée. La prévention secondaire concerne le dépistage précoce.",
    },
    {
      statement: 'Une épidémie correspond à :',
      options: [
        'Une augmentation inhabituelle du nombre de cas',
        'La disparition d’une maladie',
        'Une maladie uniquement génétique',
        'Un accident isolé',
      ],
      correct: 'A',
      explanation:
        "Une épidémie est l'apparition d'un nombre de cas d'une maladie supérieur à ce que l'on attend dans une population et une période données. Elle peut être infectieuse ou non.",
    },
    {
      statement: 'Le consentement éclairé du patient suppose :',
      options: [
        'Une information compréhensible avant l’acte',
        'Une signature sans explication',
        'L’accord de la famille uniquement',
        'Une décision imposée par le soignant',
      ],
      correct: 'A',
      explanation:
        "Le consentement éclairé repose sur une information claire et adaptée sur les bénéfices, les risques et les alternatives, puis sur un accord libre du patient. Il est un principe fondamental de la relation de soin.",
    },
    {
      statement: 'Le secret médical impose au soignant de :',
      options: [
        'Ne pas divulguer les informations de santé du patient',
        'Publier les diagnostics pour la recherche',
        'Partager les dossiers sans limite',
        'Informer l’employeur systématiquement',
      ],
      correct: 'A',
      explanation:
        "Le secret médical protège les informations de santé confiées au soignant. Il ne peut être levé que dans des situations strictement prévues par la loi, par exemple en cas de danger imminent pour autrui.",
    },
    {
      statement: 'Un dépistage a pour objectif :',
      options: [
        'Repérer une maladie à un stade précoce',
        'Guérir toutes les maladies',
        'Remplacer la vaccination',
        'Créer une immunité collective',
      ],
      correct: 'A',
      explanation:
        "Le dépistage consiste à identifier une maladie ou un facteur de risque avant l'apparition des symptômes, afin de permettre une prise en charge précoce. Il relève de la prévention secondaire.",
    },
    {
      statement: 'La vaccination est un exemple de prévention :',
      options: ['Primaire', 'Secondaire', 'Tertiaire', 'Quaternaire'],
      correct: 'A',
      explanation:
        "La vaccination vise à prévenir l'apparition d'une maladie infectieuse chez une personne indemne : il s'agit de prévention primaire. Elle protège aussi indirectement l'entourage par l'immunité collective.",
    },
    {
      statement: 'L’incidence d’une maladie mesure :',
      options: [
        'Le nombre de nouveaux cas sur une période',
        'Le nombre total de cas existants',
        'La mortalité globale',
        'Le nombre de guérisons',
      ],
      correct: 'A',
      explanation:
        "L'incidence correspond aux nouveaux cas apparus dans une population pendant une période donnée. La prévalence, elle, compte tous les cas présents à un moment donné, anciens et nouveaux.",
    },
    {
      statement: 'La prévalence d’une maladie correspond :',
      options: [
        'Au nombre total de cas présents à un instant donné',
        'Au nombre de nouveaux cas par an',
        'Au nombre de décès',
        'Au nombre de tests réalisés',
      ],
      correct: 'A',
      explanation:
        "La prévalence mesure la proportion de personnes atteintes dans une population à un moment donné. Elle dépend à la fois de l'incidence et de la durée de la maladie.",
    },
    {
      statement: 'Le développement durable en santé vise à :',
      options: [
        'Concilier santé, environnement et ressources',
        'Augmenter uniquement les dépenses de soins',
        'Supprimer toute prévention',
        'Réserver les soins aux villes',
      ],
      correct: 'A',
      explanation:
        "Le développement durable appliqué à la santé cherche à répondre aux besoins actuels sans compromettre ceux des générations futures. Il intègre la qualité des soins, la protection de l'environnement et l'équité d'accès.",
    },
    {
      statement: 'Le principe de bienfaisance en éthique médicale consiste à :',
      options: [
        'Agir dans l’intérêt du patient',
        'Refuser toute information au patient',
        'Privilégier uniquement le coût',
        'Éviter tout traitement',
      ],
      correct: 'A',
      explanation:
        "La bienfaisance impose au soignant de rechercher le bien du patient et de proposer les soins les plus appropriés. Elle s'articule avec la non-malfaisance, l'autonomie du patient et la justice.",
    },
  ],
]

const DEMO_AMOUNT = '30,00 €'

function receiptSvg(name: string, reference: string, date: string, amount = DEMO_AMOUNT) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="900" viewBox="0 0 640 900">
  <rect width="640" height="900" fill="#ffffff"/>
  <rect x="0" y="0" width="640" height="108" fill="#111111"/>
  <text x="48" y="66" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#ffffff" letter-spacing="2">MEDQCM mada</text>
  <text x="48" y="88" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="500" fill="#cacacb" letter-spacing="3">REÇU DE PAIEMENT — ACCÈS MENSUEL</text>
  <text x="48" y="158" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#707072" letter-spacing="2">REÇU N°</text>
  <text x="48" y="182" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#111111">${reference}</text>
  <text x="592" y="158" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#707072" letter-spacing="2">DATE</text>
  <text x="592" y="182" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#111111">${date}</text>
  <line x1="48" y1="214" x2="592" y2="214" stroke="#e5e5e5"/>
  <text x="48" y="258" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#707072" letter-spacing="2">REÇU DE</text>
  <text x="48" y="292" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#111111">${name}</text>
  <text x="48" y="350" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#707072" letter-spacing="2">OBJET DU PAIEMENT</text>
  <text x="48" y="380" font-family="Arial, Helvetica, sans-serif" font-size="17" fill="#111111">Accès mensuel aux 9 thèmes PACES</text>
  <text x="48" y="404" font-family="Arial, Helvetica, sans-serif" font-size="17" fill="#111111">30 séries de 10 questions</text>
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

function seedAttempt(input: {
  userId: string
  themeIndex: number
  daysAgo: number
  correctCount: number
  offset?: number
}): Attempt {
  const theme = PACE_THEMES[input.themeIndex]
  const questions = THEME_BANKS[input.themeIndex].map((question, index) =>
    toSeedQuestion(question, theme, index),
  )
  const offset = input.offset ?? 0
  const rotated = [...questions.slice(offset), ...questions.slice(0, offset)]
  const picked = rotated.slice(0, SERIES_SIZE)
  const answers: Record<string, string[]> = {}
  picked.forEach((question, index) => {
    if (index < input.correctCount) {
      answers[question.id] = [...question.correctAnswers]
    } else {
      const wrong =
        (['A', 'B', 'C', 'D'] as const).find(
          (letter) => !question.correctAnswers.includes(letter),
        ) ?? 'A'
      answers[question.id] = [wrong]
    }
  })
  const score = picked.reduce(
    (sum, question) => sum + (sameAnswer(answers[question.id], question.correctAnswers) ? 1 : 0),
    0,
  )
  return {
    id: '',
    userId: input.userId,
    subjectId: theme.id,
    questionIds: picked.map((question) => question.id),
    answers,
    score,
    total: picked.length,
    createdAt: addDays(new Date(), -input.daysAgo).toISOString(),
  }
}

export function createSeedDatabase(): Database {
  const now = new Date()
  const currentMonth = monthLabel(now)

  const subjects: Subject[] = PACE_THEMES.map((theme, index) => ({
    id: theme.id,
    title: theme.title,
    description: theme.description,
    monthLabel: currentMonth,
    publishedAt: addDays(now, -12).toISOString(),
    archived: false,
    questionCount: THEME_BANKS[index].length,
  }))

  const questions: Question[] = PACE_THEMES.flatMap((theme, themeIndex) =>
    THEME_BANKS[themeIndex].map((question, index) => toSeedQuestion(question, theme, index)),
  )

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
      subjectId: null,
      requestId: 'req_jean',
      startedAt: addDays(now, -18).toISOString(),
      expiresAt: addDays(now, 12).toISOString(),
    },
    {
      id: 'assign_yanis',
      userId: 'u_yanis',
      subjectId: null,
      startedAt: addDays(now, -5).toISOString(),
      expiresAt: addDays(now, 25).toISOString(),
    },
    {
      id: 'assign_clara',
      userId: 'u_clara',
      subjectId: null,
      startedAt: addDays(now, -27).toISOString(),
      expiresAt: addDays(now, 3).toISOString(),
    },
    {
      id: 'assign_lucas',
      userId: 'u_lucas',
      subjectId: null,
      startedAt: addDays(now, -33).toISOString(),
      expiresAt: addDays(now, -3).toISOString(),
    },
    {
      id: 'assign_sarah',
      userId: 'u_sarah',
      subjectId: null,
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
    seedAttempt({ userId: 'u_jean', themeIndex: 0, daysAgo: 2, correctCount: 9 }),
    seedAttempt({ userId: 'u_jean', themeIndex: 1, daysAgo: 5, correctCount: 7, offset: 3 }),
    seedAttempt({ userId: 'u_jean', themeIndex: 2, daysAgo: 9, correctCount: 8, offset: 5 }),
    seedAttempt({ userId: 'u_jean', themeIndex: 3, daysAgo: 12, correctCount: 6, offset: 2 }),
    seedAttempt({ userId: 'u_jean', themeIndex: 4, daysAgo: 14, correctCount: 10, offset: 7 }),
    seedAttempt({ userId: 'u_jean', themeIndex: 5, daysAgo: 16, correctCount: 7, offset: 1 }),
    seedAttempt({ userId: 'u_lucas', themeIndex: 0, daysAgo: 6, correctCount: 6, offset: 4 }),
    seedAttempt({ userId: 'u_lucas', themeIndex: 3, daysAgo: 12, correctCount: 8, offset: 2 }),
    seedAttempt({ userId: 'u_sarah', themeIndex: 1, daysAgo: 4, correctCount: 9, offset: 6 }),
    seedAttempt({ userId: 'u_sarah', themeIndex: 4, daysAgo: 10, correctCount: 7, offset: 3 }),
    seedAttempt({ userId: 'u_yanis', themeIndex: 5, daysAgo: 1, correctCount: 9, offset: 4 }),
    // Clara a terminé ses 30 séries : son tableau de bord montre le renouvellement.
    ...Array.from({ length: 30 }, (_, index) =>
      seedAttempt({
        userId: 'u_clara',
        themeIndex: index % PACE_THEMES.length,
        daysAgo: 26 - index * 0.8,
        correctCount: 5 + (index % 6),
        offset: index % SERIES_SIZE,
      }),
    ),
  ]

  // Keep attempt ids unique and readable in the demo inspector.
  attempts.forEach((attempt, index) => {
    attempt.id = `attempt_seed_${index + 1}`
  })

  return {
    version: 3,
    users,
    requests,
    subjects,
    assignments,
    questions,
    attempts,
  }
}

export function randomQuestionIds(questions: Question[], count = SERIES_SIZE) {
  return shuffle(questions).slice(0, count).map((question) => question.id)
}
