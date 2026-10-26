import { ArrowRight, Check, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ButtonLink } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import { useAuth } from '@/lib/auth'
import { getPublishedSubjects } from '@/lib/db'
import { formatDateLong, monthLabel } from '@/lib/utils'

const steps = [
  {
    number: '1',
    title: 'Déposez votre dossier',
    text: 'Renseignez votre identité, choisissez votre mot de passe et joignez votre reçu de paiement.',
  },
  {
    number: '2',
    title: 'Le docteur vérifie',
    text: 'Chaque reçu est contrôlé manuellement. Votre accès s’ouvre pour 30 jours après validation.',
  },
  {
    number: '3',
    title: 'Travaillez votre sujet',
    text: 'Lancez autant de séries de 20 QCM que vous voulez. La correction détaillée arrive après l’envoi.',
  },
]

const included = [
  'Un sujet mensuel préparé par le docteur',
  '20 questions tirées au hasard à chaque série',
  'Un score immédiat sur 20',
  'Une correction expliquée, question par question',
  'Un historique personnel de vos séries',
  'Le sujet suivant attribué au renouvellement',
]

export function LandingPage() {
  usePageTitle('MEDQCM L1 — L’entraînement mensuel des futurs médecins')
  const { db, user, homePath } = useAuth()
  const subjects = getPublishedSubjects(db)
  const subject = subjects[0]
  const open = subjects.length > 0
  const studentUser = user?.role === 'student' ? user : null
  const startHref = studentUser ? homePath : '/inscription'
  const sessionLabel = subject?.monthLabel ?? monthLabel()

  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-content gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-10 lg:py-20">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-medium text-mute">
              <span className={`h-2 w-2 rounded-full ${open ? 'bg-success-bright' : 'bg-stone'}`} />
              QCM médecine L1 · {sessionLabel}
            </div>

            <h1 className="mt-6 max-w-2xl font-display text-[clamp(2.9rem,6.2vw,5.1rem)] leading-[0.98] tracking-[-0.03em] text-ink">
              Un sujet complet.
              <br />
              Trente jours pour le maîtriser.
            </h1>

            <p className="mt-6 max-w-[34rem] text-[16px] leading-[1.65] text-mute">
              Chaque mois, le docteur publie un nouveau sujet de 20 QCM. Vous travaillez à votre
              rythme, puis vous recevez la correction détaillée pour comprendre chaque réponse.
            </p>

            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
              <ButtonLink to={startHref} size="lg" className="w-full sm:w-auto">
                {studentUser ? 'Ouvrir mon espace' : 'Créer mon dossier'} <ArrowRight size={16} />
              </ButtonLink>
              <Link
                to="/connexion"
                className="inline-flex h-11 items-center text-[14px] font-medium text-ink underline decoration-line underline-offset-4 transition hover:text-accent hover:decoration-accent"
              >
                J’ai déjà un compte
              </Link>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-5">
              {[
                ['20', 'QCM par série'],
                ['30', 'jours d’accès'],
                ['1', 'sujet à la fois'],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="font-display text-[26px] leading-none text-ink">{value}</dt>
                  <dd className="mt-1.5 text-[11px] text-mute">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="absolute -left-3 top-8 hidden h-[calc(100%-4rem)] w-px bg-line lg:block" />
            <div className="rounded-2xl border border-line bg-canvas p-2">
              <div className="rounded-xl border border-line bg-surface">
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                  <div>
                    <p className="text-[11px] font-medium text-mute">Votre cycle</p>
                    <p className="mt-1 text-[13px] font-medium text-ink">
                      {open ? 'Sujet publié' : 'Prochain sujet en préparation'}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      open ? 'bg-accent-soft text-accent' : 'bg-cloud text-mute'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-accent' : 'bg-stone'}`} />
                    {open ? 'Disponible' : 'Bientôt'}
                  </span>
                </div>

                <div className="px-5 pb-5 pt-6">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-mute">
                    Sujet du mois
                  </p>
                  <h2 className="mt-2 font-display text-[1.8rem] leading-[1.1] tracking-[-0.02em] text-ink">
                    {subject?.title ?? 'Fondamentaux & Cardiologie'}
                  </h2>
                  <p className="mt-2 text-[12px] text-mute">
                    {subject
                      ? `Publié le ${formatDateLong(subject.publishedAt)}`
                      : 'Le docteur prépare le prochain sujet.'}
                  </p>

                  <div className="mt-6">
                    <div className="flex items-center justify-between text-[11px] text-mute">
                      <span>Cycle de 30 jours</span>
                      <span>J1 → J30</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cloud">
                      <div className="h-full w-[46%] rounded-full bg-accent" />
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] text-stone">
                      <span>Ouverture</span>
                      <span>Renouvellement</span>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
                    {[
                      ['20', 'questions / série'],
                      ['Corrigé', 'après envoi'],
                    ].map(([value, label]) => (
                      <div key={label} className="bg-surface px-3 py-3">
                        <p className="font-display text-[1.35rem] leading-none text-ink">{value}</p>
                        <p className="mt-1 text-[10px] text-mute">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex items-start gap-2.5 border-t border-line pt-4">
                    <ShieldCheck size={15} className="mt-0.5 shrink-0 text-accent" />
                    <p className="text-[11px] leading-relaxed text-mute">
                      Validation humaine du reçu. Aucun accès au QCM avant l’accord du docteur.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="methode" className="scroll-mt-24 bg-canvas">
        <div className="mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <div className="flex flex-col gap-3 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="max-w-xl font-display text-[clamp(2.1rem,4vw,3.3rem)] leading-[1.05] tracking-[-0.025em] text-ink">
              Trois étapes, sans détour.
            </h2>
            <p className="max-w-sm text-[13px] leading-relaxed text-mute">
              Votre dossier est vérifié par un docteur, pas par un automate. Le QCM reste fermé
              jusqu’à la validation.
            </p>
          </div>

          <div className="grid gap-0 md:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className={`py-7 md:px-7 ${
                  index > 0 ? 'border-t border-line md:border-l md:border-t-0' : ''
                } ${index === 0 ? 'md:pl-0' : ''} ${index === steps.length - 1 ? 'md:pr-0' : ''}`}
              >
                <span className="font-display text-[1.4rem] leading-none text-accent">
                  {step.number.padStart(2, '0')}
                </span>
                <h3 className="mt-4 text-[16px] font-medium text-ink">{step.title}</h3>
                <p className="mt-2 max-w-[19rem] text-[13px] leading-relaxed text-mute">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contenu" className="scroll-mt-24 border-y border-line bg-surface">
        <div className="mx-auto grid max-w-content gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-10 lg:py-24">
          <div>
            <p className="text-[12px] font-medium text-accent">Ce qui est inclus</p>
            <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.2rem)] leading-[1.05] tracking-[-0.025em] text-ink">
              Tout le nécessaire pour réviser sérieusement.
            </h2>
            <p className="mt-5 max-w-md text-[14px] leading-relaxed text-mute">
              Un seul sujet à la fois, pour éviter les listes interminables. Votre historique reste
              accessible pendant et après votre cycle.
            </p>
          </div>

          <ul className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
            {included.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 border-b border-line py-4 text-[14px] leading-relaxed text-ash last:border-b-0"
              >
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <Check size={12} strokeWidth={2.5} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="docteur" className="scroll-mt-24 bg-canvas">
        <div className="mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.36fr_0.64fr] lg:gap-16">
            <div>
              <span className="grid h-16 w-16 place-items-center rounded-full bg-accent font-display text-[1.6rem] text-white">
                SR
              </span>
              <p className="mt-4 text-[14px] font-medium text-ink">Dr Sun RAZAFIMANDIMBY</p>
              <p className="mt-1 text-[12px] text-mute">Docteur · Responsable pédagogique</p>
            </div>
            <blockquote>
              <p className="font-display text-[clamp(1.7rem,3.2vw,2.5rem)] leading-[1.25] tracking-[-0.02em] text-ink">
                « Un QCM ne vaut que par la correction qui suit. L’objectif n’est pas de collectionner
                les scores, mais de comprendre le raisonnement derrière chaque réponse. »
              </p>
              <p className="mt-6 text-[13px] text-mute">
                Chaque sujet est relu et validé avant publication. Chaque reçu est vérifié
                manuellement.
              </p>
            </blockquote>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 border-t border-line bg-surface">
        <div className="mx-auto grid max-w-content gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16 lg:px-10 lg:py-20">
          <div>
            <h2 className="font-display text-[clamp(2rem,3.6vw,2.8rem)] leading-[1.05] tracking-[-0.025em] text-ink">
              Questions fréquentes.
            </h2>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-mute">
              Une autre question ? Écrivez à l’adresse indiquée dans votre confirmation d’inscription.
            </p>
          </div>
          <div className="border-t border-line">
            {[
              {
                q: 'Quand mon accès s’ouvre-t-il ?',
                a: 'Après vérification de votre reçu par le docteur. Votre cycle de 30 jours commence à la validation, pas à l’envoi du dossier.',
              },
              {
                q: 'Que se passe-t-il à la fin des 30 jours ?',
                a: 'Le QCM se ferme, mais votre historique reste consultable. Vous pouvez renouveler votre accès avec un nouveau reçu ; le sujet suivant vous sera attribué automatiquement.',
              },
              {
                q: 'Puis-je refaire une série ?',
                a: 'Oui. Chaque série tire 20 questions au hasard dans la banque du sujet. Le corrigé n’apparaît qu’après l’envoi de vos réponses.',
              },
            ].map((item) => (
              <details key={item.q} className="group border-b border-line py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[15px] font-medium text-ink">
                  {item.q}
                  <span className="text-xl font-normal text-mute transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pt-3 text-[13px] leading-relaxed text-mute">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-canvas">
        <div className="mx-auto max-w-content px-5 py-14 sm:px-8 lg:px-10 lg:py-20">
          <div className="flex flex-col gap-6 rounded-2xl bg-accent-soft p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:p-10">
            <div>
              <h2 className="font-display text-[clamp(1.8rem,3.4vw,2.7rem)] leading-[1.08] tracking-[-0.025em] text-ink">
                Prêt à ouvrir votre dossier ?
              </h2>
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ash">
                Le reçu est la seule pièce demandée. La validation est humaine et l’accès reste
                personnel.
              </p>
            </div>
            <ButtonLink to={startHref} size="lg" className="w-full shrink-0 lg:w-auto">
              {studentUser ? 'Ouvrir mon espace' : 'Créer mon dossier'} <ArrowRight size={16} />
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  )
}
