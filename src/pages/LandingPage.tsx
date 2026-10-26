import { ArrowRight, ArrowUpRight, BookOpenCheck, Check, LockKeyhole, RefreshCcw, Shuffle, Smartphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ButtonLink } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import { QuizPreview } from '@/components/landing/QuizPreview'
import { Faq } from '@/components/landing/Faq'
import { useAuth } from '@/lib/auth'
import { getPublishedSubjects } from '@/lib/db'
import { formatDateLong, monthLabel } from '@/lib/utils'

const steps = [
  {
    number: '01',
    title: 'Demandez votre accès',
    text: 'Créez votre dossier en quelques minutes et joignez votre reçu de paiement. Votre docteur vérifie chaque justificatif sous 24 heures.',
    meta: 'Pièce jointe obligatoire',
  },
  {
    number: '02',
    title: 'Entrez dans votre mois',
    text: 'Votre accès s’ouvre pour 30 jours. Chaque série tire 20 questions au hasard dans la banque du sujet qui vous est attribué.',
    meta: 'Séries illimitées',
  },
  {
    number: '03',
    title: 'Maîtrisez le corrigé',
    text: 'Score immédiat sur 20, réponses exactes en vert, erreurs en rouge et explication médicale détaillée pour chaque question.',
    meta: 'Corrigé du docteur',
  },
]

const features = [
  {
    icon: Shuffle,
    title: 'Aléatoire, vraiment',
    text: '20 questions tirées dans la banque à chaque série. Rejouez sans jamais apprendre une série par cœur.',
  },
  {
    icon: BookOpenCheck,
    title: 'Expliqué, pas seulement noté',
    text: 'Chaque bonne réponse est reliée à un raisonnement médical. Comprendre vaut mieux que retenir.',
  },
  {
    icon: Smartphone,
    title: 'Partout avec vous',
    text: 'PC, Mac, iPhone, Android. Une seule adresse, aucun téléchargement, vos résultats toujours disponibles.',
  },
  {
    icon: LockKeyhole,
    title: 'Un accès maîtrisé',
    text: 'Validation humaine du reçu, accès personnel et expiration automatique au terme de vos 30 jours.',
  },
]

const benefits = [
  '20 questions tirées au sort',
  'Corrigé immédiat sur 20',
  'Explication médicale détaillée',
  'Accès personnel 30 jours',
  'Zéro installation',
]

export function LandingPage() {
  usePageTitle('MEDQCM L1 — L’entraînement mensuel des futurs médecins')
  const { db, user, homePath } = useAuth()
  const subjects = getPublishedSubjects(db)
  const subject = subjects[0]
  const open = subjects.length > 0
  const startHref = user ? homePath : '/inscription'
  const sessionLabel = subject?.monthLabel ?? monthLabel()

  return (
    <>
      {/* Hero */}
      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-content lg:min-h-[calc(100svh-100px)] lg:max-h-[840px] lg:grid-cols-[1.02fr_1fr]">
          <div className="order-2 flex flex-col justify-between px-5 py-10 sm:px-10 lg:order-1 lg:px-14 lg:py-12 xl:px-20">
            <div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/60">
                  <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-success-bright' : 'bg-stone'}`} />
                  QCM Médecine L1 · Session {sessionLabel}
                </span>
              </div>

              <h1 className="display mt-7 text-[clamp(3.35rem,10.5vw,7rem)] lg:mt-10 lg:text-[clamp(4.4rem,6.9vw,7.25rem)]">
                La médecine
                <br />
                ne se devine
                <br />
                <span className="text-stone">pas.</span>
              </h1>

              <p className="mt-4 font-display text-[clamp(1.6rem,4vw,2.5rem)] uppercase leading-none tracking-[0.02em] text-white/90 lg:mt-5">
                Elle se maîtrise. Un QCM à la fois.
              </p>

              <p className="mt-6 max-w-[370px] text-[14px] leading-[1.6] text-white/60">
                20 questions. 30 jours. Un corrigé détaillé signé par votre docteur.
                L’entraînement mensuel qui ne vous laisse aucune zone d’ombre.
              </p>

              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <ButtonLink to={startHref} variant="white" size="lg" className="w-full sm:w-auto">
                  Démarrer mon accès <ArrowRight size={16} />
                </ButtonLink>
                <a
                  href="#methode"
                  className="group inline-flex items-center gap-2 py-2 text-[13px] font-medium text-white underline decoration-white/40 underline-offset-[6px] transition hover:decoration-white"
                >
                  Découvrir la méthode
                  <ArrowRight size={14} className="transition group-hover:translate-x-1" />
                </a>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-3 border-t border-white/15 pt-5 lg:mt-12">
              {[
                ['20', 'questions / série'],
                ['30', 'jours d’accès'],
                ['24 h', 'de validation'],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="font-display text-[26px] leading-none text-white lg:text-[30px]">{value}</p>
                  <p className="mt-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-white/45 sm:text-[9px]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative order-1 flex min-h-[310px] flex-col justify-between overflow-hidden bg-[#202020] px-5 py-5 sm:min-h-[420px] sm:px-8 sm:py-7 lg:order-2 lg:min-h-full lg:px-10 lg:py-9">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-6 top-10 select-none font-display text-[210px] leading-[0.7] text-white/[0.04] sm:text-[280px]"
            >
              QCM
            </span>

            <div className="relative flex items-start justify-between gap-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-sale" />
                {open ? 'Parcours QCM disponible' : 'Parcours bientôt disponible'}
              </span>
              <span className="hidden bg-ink/90 px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-white/70 sm:block">
                N° 01 — L1
              </span>
            </div>

            <div className="relative mt-14 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-white/15 pt-7 sm:mt-20">
              <div>
                <p className="display text-[clamp(3.4rem,7vw,5.8rem)] leading-none text-white">30</p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-white/45">
                  jours d’accès
                </p>
              </div>
              <div>
                <p className="display text-[clamp(3.4rem,7vw,5.8rem)] leading-none text-white">20</p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-white/45">
                  questions par série
                </p>
              </div>
              <div className="col-span-2 max-w-sm border-t border-white/10 pt-5">
                <p className="text-[13px] leading-[1.65] text-white/55">
                  Un seul sujet à la fois, choisi dans la file préparée par le docteur. Au
                  renouvellement, le sujet suivant est attribué automatiquement.
                </p>
              </div>
            </div>

            <div className="relative mt-12 flex items-end justify-between gap-3">
              <a
                href="#sujet"
                className="group inline-flex items-center gap-3 rounded-full bg-white px-4 py-2.5 text-ink transition hover:bg-cloud sm:px-5 sm:py-3"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-white">
                  <ArrowUpRight size={14} className="transition group-hover:rotate-45" />
                </span>
                <span className="text-left">
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-mute">
                    La série
                  </span>
                  <span className="block text-[12px] font-medium">20 questions, corrigé immédiat</span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="overflow-hidden border-y border-white/10 bg-ink py-3.5 text-white">
        <div className="flex w-max animate-marquee">
          {[0, 1].map((group) => (
            <div key={group} className="flex shrink-0 items-center" aria-hidden={group === 1}>
              {benefits.map((label) => (
                <span key={label} className="flex items-center">
                  <span className="whitespace-nowrap px-6 font-display text-[18px] uppercase tracking-[0.06em] text-white/85 sm:text-[22px]">
                    {label}
                  </span>
                  <span className="font-sans text-[10px] text-white/30">+</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Method */}
      <section id="methode" className="scroll-mt-[100px] bg-canvas">
        <div className="mx-auto max-w-content px-5 py-16 sm:px-10 lg:px-10 lg:py-24">
          <div className="grid gap-8 border-t border-hairline-soft pt-7 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-3">
              <p className="eyebrow">01 — La méthode</p>
              <p className="mt-5 max-w-[220px] text-[13px] leading-relaxed text-ash">
                Pas de contenu infini. Pas de promesse floue. Un cadre mensuel, court et exigeant.
              </p>
            </div>
            <div className="lg:col-span-9">
              <h2 className="display text-[clamp(3rem,7vw,5.5rem)]">
                Un mois. Un sujet.
                <br />
                Zéro impasse.
              </h2>
              <p className="mt-6 max-w-xl text-[14px] leading-[1.7] text-ash">
                Le concours ne se prépare pas en survolant cent PDF. Il se prépare en répétant, en se
                trompant, puis en comprenant pourquoi. Votre mois est calibré pour cela.
              </p>
            </div>
          </div>

          <div className="mt-14 grid gap-x-8 gap-y-0 border-t border-ink md:grid-cols-3 lg:mt-20">
            {steps.map((step) => (
              <div key={step.number} className="flex flex-col border-b border-hairline-soft py-7 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-[46px] leading-none text-ink">{step.number}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mute">
                    {step.meta}
                  </span>
                </div>
                <h3 className="mt-8 text-[18px] font-medium tracking-[-0.01em]">{step.title}</h3>
                <p className="mt-3 max-w-[320px] text-[13px] leading-[1.65] text-ash">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product / editorial split */}
      <section className="bg-cloud">
        <div className="mx-auto max-w-content">
          <div className="grid lg:grid-cols-2">
            <div className="relative flex min-h-[360px] flex-col overflow-hidden bg-ink p-6 text-white sm:min-h-[480px] lg:min-h-full lg:p-8">
              <div className="relative flex items-center justify-between gap-4 border-b border-white/15 pb-4">
                <span className="rounded-full border border-white/20 px-3.5 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  Une série · 12 minutes
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
                  Tirage aléatoire
                </span>
              </div>
              <span
                aria-hidden
                className="pointer-events-none absolute -right-6 bottom-2 select-none font-display text-[260px] leading-none text-white/[0.045]"
              >
                20
              </span>
              <div className="relative mt-auto max-w-[300px] pt-16">
                <p className="font-display text-[clamp(5rem,11vw,8rem)] leading-[0.78]">20</p>
                <p className="mt-4 text-[12px] leading-relaxed text-white/55">
                  questions tirées dans la banque du sujet. Aucune liste à réciter.
                </p>
              </div>
              <div className="relative mt-8 grid grid-cols-2 border-t border-white/15 pt-4 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
                <span>Correction immédiate</span>
                <span className="text-right">Sans limite</span>
              </div>
            </div>

            <div className="bg-cloud px-5 py-14 sm:px-10 lg:px-14 lg:py-16 xl:px-20">
              <p className="eyebrow text-ink">02 — La série</p>
              <h2 className="display mt-5 text-[clamp(2.9rem,5.8vw,4.8rem)]">
                20 questions.
                <br />
                Une vérité.
              </h2>
              <p className="mt-5 max-w-md text-[14px] leading-[1.7] text-ash">
                À chaque série, un tirage aléatoire dans la banque du mois. Vous ne révisez pas une
                liste : vous testez votre raisonnement, jusqu’à ce qu’il tienne.
              </p>

              <div className="mt-8">
                <QuizPreview />
              </div>

              <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
                <ButtonLink to={startHref} size="md">
                  Rejoindre le sujet <ArrowRight size={15} />
                </ButtonLink>
                <p className="text-[11px] leading-relaxed text-mute">
                  Chaque série est corrigée instantanément.
                  <br className="hidden sm:block" /> Sans limite pendant votre mois.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Subject of the month */}
      <section id="sujet" className="relative scroll-mt-[100px] overflow-hidden bg-ink text-white">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 bottom-0 hidden select-none font-display text-[430px] leading-[0.68] text-white/[0.04] lg:block"
        >
          30
        </span>
        <div className="relative mx-auto max-w-content px-5 py-16 sm:px-10 lg:px-10 lg:py-24">
          <div className="flex flex-col justify-between gap-5 border-t border-white/20 pt-6 md:flex-row md:items-center">
            <p className="eyebrow text-white/50">03 — Le parcours QCM</p>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 px-3.5 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">
              <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-success-bright' : 'bg-sale'}`} />
              {open ? `${subjects.length} sujet${subjects.length > 1 ? 's' : ''} en file` : 'Préparation en cours'}
            </span>
          </div>

          <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-7">
              <h2 className="display text-[clamp(3.4rem,8vw,6.8rem)]">
                Votre parcours
                <br />
                est {open ? 'prêt.' : 'en préparation.'}
              </h2>
              <p className="mt-6 max-w-lg text-[14px] leading-[1.7] text-white/60">
                {subject
                  ? subject.description
                  : 'Le prochain sujet est en cours de préparation. Revenez bientôt pour découvrir le nouveau programme.'}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {['20 par série', 'Tirage aléatoire', 'Corrigé détaillé'].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/20 px-3.5 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="border-t border-white/20">
                {[
                  ['Premier sujet', subject?.title ?? 'Prochain sujet en préparation'],
                  ['Questions au programme', subject ? `${subject.questionCount}` : '—'],
                  ['Série', '20 questions aléatoires'],
                  ['Accès', '30 jours complets'],
                  ['Ouverture', subject ? formatDateLong(subject.publishedAt) : 'À venir'],
                  ['Sujets en file', open ? `${subjects.length}` : 'À venir'],
                  ['Renouvellement', 'Sujet suivant automatique'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-6 border-b border-white/10 py-3.5"
                  >
                    <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      {label}
                    </span>
                    <span className="max-w-[240px] text-right text-[12px] leading-snug text-white/85">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <ButtonLink
                to={startHref}
                variant="white"
                size="lg"
                className="mt-7 w-full"
              >
                {user ? 'Accéder à mon espace' : 'Demander mon accès'} <ArrowRight size={16} />
              </ButtonLink>
              <p className="mt-3 text-center text-[10px] text-white/40">
                Validation du justificatif sous 24 h · Accès immédiat
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Professor */}
      <section id="docteur" className="scroll-mt-[100px] bg-canvas">
        <div className="mx-auto max-w-content px-5 py-16 sm:px-10 lg:px-10 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-6 xl:col-span-7">
              <p className="eyebrow">04 — Le docteur</p>
              <h2 className="display mt-5 text-[clamp(3rem,6.4vw,5.6rem)]">
                Pas de corrigé
                <br />
                sans explication.
              </h2>
              <p className="mt-6 max-w-xl text-[14px] leading-[1.7] text-ash">
                Votre docteur sélectionne les questions, valide chaque réponse et rédige les
                explications. Pas de correction automatique derrière un écran : un raisonnement
                médical, remis dans son contexte.
              </p>

              <blockquote className="mt-8 border-l border-ink pl-5 sm:pl-6">
                <p className="max-w-lg text-[19px] font-medium leading-snug tracking-[-0.01em] sm:text-[22px]">
                  « Comprendre pourquoi on se trompe vaut mieux que mémoriser la bonne réponse. »
                </p>
                <footer className="mt-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-mute">
                  L’équipe pédagogique MEDQCM
                </footer>
              </blockquote>

              <div className="mt-9 divide-y divide-hairline-soft border-t border-hairline-soft">
                {[
                  ['Chaque question relue', 'Avant publication, pas après.'],
                  ['Chaque corrigé argumenté', 'Une explication pour chaque bonne réponse.'],
                  ['Chaque sujet renouvelé', 'Un nouveau programme chaque mois.'],
                ].map(([title, text]) => (
                  <div key={title} className="flex items-start justify-between gap-5 py-4">
                    <div className="flex items-start gap-3">
                      <Check size={14} className="mt-0.5 shrink-0" />
                      <span className="text-[13px] font-medium">{title}</span>
                    </div>
                    <span className="text-right text-[11px] text-mute">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex min-h-[360px] flex-col border border-hairline bg-cloud p-5 sm:min-h-[460px] lg:col-span-6 lg:min-h-[560px] xl:col-span-5">
              <div className="flex items-center justify-between gap-4 border-b border-hairline pb-3">
                <span className="eyebrow">Le corrigé</span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mute">
                  Réponse argumentée
                </span>
              </div>
              <div className="my-auto bg-white p-5 sm:p-6">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mute">
                  Question 08 · Anatomie
                </p>
                <p className="mt-4 text-[16px] font-medium leading-snug tracking-[-0.01em] sm:text-[18px]">
                  Quel nerf assure l’innervation motrice principale du diaphragme ?
                </p>
                <div className="mt-5 flex items-start gap-2.5 border-t border-hairline-soft pt-4 text-[12px] font-medium">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-white">
                    <Check size={11} />
                  </span>
                  B — Le nerf phrénique
                </div>
                <p className="mt-4 border-l border-hairline pl-3 text-[11px] leading-relaxed text-mute">
                  Il naît des racines cervicales C3-C4-C5 et assure la motricité du diaphragme.
                </p>
              </div>
              <div className="mt-5 flex items-center gap-3 border-t border-hairline pt-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-white">
                  <BookOpenCheck size={16} />
                </span>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mute">
                    Contenu validé
                  </p>
                  <p className="text-[12px] font-medium">Sujet relu et publié par le docteur</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="bg-cloud">
        <div className="mx-auto max-w-content px-5 py-14 sm:px-10 lg:px-10 lg:py-20">
          <div className="flex flex-col justify-between gap-4 border-b border-hairline pb-5 sm:flex-row sm:items-end">
            <h2 className="font-sans text-[22px] font-medium tracking-[-0.02em]">Ce qui change tout.</h2>
            <span className="eyebrow">Pensé pour la L1</span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.title}
                  className="border-b border-hairline-soft py-7 md:px-6 md:odd:pl-0 md:even:border-l lg:border-b-0 lg:border-l lg:first:border-l-0 lg:first:pl-0 lg:last:pr-0"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white">
                    <Icon size={16} strokeWidth={1.6} />
                  </span>
                  <h3 className="mt-5 text-[14px] font-medium">{feature.title}</h3>
                  <p className="mt-2 max-w-[260px] text-[12px] leading-[1.65] text-ash">{feature.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-[100px] bg-canvas">
        <div className="mx-auto max-w-content px-5 py-16 sm:px-10 lg:px-10 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <p className="eyebrow">05 — FAQ</p>
              <h2 className="display mt-5 text-[clamp(3rem,5.6vw,4.8rem)]">
                Des questions
                <br />
                légitimes.
              </h2>
              <p className="mt-5 max-w-xs text-[13px] leading-[1.7] text-ash">
                Tout ce qu’il faut savoir avant de confier votre entraînement mensuel à MEDQCM.
              </p>
              <div className="mt-8 border border-hairline-soft p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Une autre question ?</p>
                <p className="mt-2 text-[12px] leading-relaxed text-mute">
                  Le docteur répond aux étudiants validés directement depuis leur espace.
                </p>
                <Link
                  to={user ? homePath : '/connexion'}
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium underline decoration-1 underline-offset-4"
                >
                  {user ? 'Ouvrir mon espace' : 'Accéder à mon espace'}
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
            <div className="lg:col-span-8">
              <Faq />
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-ink text-white">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 top-1/2 hidden -translate-y-1/2 select-none font-display text-[520px] leading-none text-white/[0.035] lg:block"
        >
          +
        </span>
        <div className="relative mx-auto max-w-content px-5 py-16 sm:px-10 lg:px-10 lg:py-24">
          <p className="eyebrow text-white/50">La prochaine série est pour vous</p>
          <div className="mt-5 flex flex-col justify-between gap-9 lg:flex-row lg:items-end">
            <h2 className="display text-[clamp(3.8rem,10vw,8.5rem)]">
              Prêt pour
              <br />
              le concours ?
            </h2>
            <div className="shrink-0 lg:pb-3">
              <ButtonLink to={startHref} variant="white" size="lg" className="w-full sm:w-auto">
                {user ? 'Reprendre l’entraînement' : 'Créer ma demande'} <ArrowRight size={16} />
              </ButtonLink>
              <p className="mt-3 text-[10px] text-white/40">
                Reçu obligatoire · Validation sous 24 h · 30 jours d’accès
              </p>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 border-t border-white/15 pt-6 text-[10px] text-white/45 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <RefreshCcw size={13} />
              <span>Un nouveau sujet chaque mois</span>
            </div>
            <div className="flex items-center gap-2">
              <LockKeyhole size={13} />
              <span>Accès personnel, non partageable</span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone size={13} />
              <span>PC · Mac · iPhone · Android</span>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
