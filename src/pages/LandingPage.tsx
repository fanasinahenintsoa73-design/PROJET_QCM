import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ButtonLink } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import { useAuth } from '@/lib/auth'
import { getPublishedSubjects } from '@/lib/db'
import { formatDateLong, monthLabel } from '@/lib/utils'

export function LandingPage() {
  usePageTitle('MEDQCM L1 — L\'entraînement mensuel des futurs médecins')
  const { db, user, homePath } = useAuth()
  const subjects = getPublishedSubjects(db)
  const open = subjects.length > 0
  const studentUser = user?.role === 'student' ? user : null
  const startHref = studentUser ? homePath : '/inscription'
  const sessionLabel = subjects[0]?.monthLabel ?? monthLabel()
  const subject = subjects[0]

  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-content gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-10 lg:py-16">
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
              Chaque mois, le docteur publie un nouveau sujet de 20 QCM. Vous travaillez à votre rythme.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
              <ButtonLink to={startHref} size="lg" className="w-full sm:w-auto">
                {studentUser ? 'Ouvrir mon espace' : 'Créer mon dossier'} <ArrowRight size={16} />
              </ButtonLink>
              <Link to="/connexion" className="inline-flex h-11 items-center text-[14px] font-medium text-ink underline decoration-line underline-offset-4 transition hover:text-accent hover:decoration-accent">
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
                    <p className="mt-1 text-[13px] font-medium text-ink">{open ? 'Sujet publié' : 'Prochain sujet en préparation'}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${open ? 'bg-accent-soft text-accent' : 'bg-cloud text-mute'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-accent' : 'bg-stone'}`} />
                    {open ? 'Disponible' : 'Bientôt'}
                  </span>
                </div>
                <div className="px-5 pb-5 pt-6">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-mute">Sujet du mois</p>
                  <h2 className="mt-2 font-display text-[1.8rem] leading-[1.1] tracking-[-0.02em] text-ink">{subject?.title ?? 'Fondamentaux & Cardiologie'}</h2>
                  <p className="mt-2 text-[12px] text-mute">{subject ? `Publié le ${formatDateLong(subject.publishedAt)}` : 'Le docteur prépare le prochain sujet.'}</p>
                  <div className="mt-6">
                    <div className="flex items-center justify-between text-[11px] text-mute"><span>Cycle de 30 jours</span><span>J1 → J30</span></div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cloud"><div className="h-full w-[46%] rounded-full bg-accent" /></div>
                    <div className="mt-2 flex justify-between text-[10px] text-stone"><span>Ouverture</span><span>Renouvellement</span></div>
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
                    <p className="text-[11px] leading-relaxed text-mute">Validation humaine du reçu. Aucun accès au QCM avant l’accord du docteur.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
            <section id="methode" className="scroll-mt-24 bg-canvas">
        <div className="mx-auto max-w-content px-5 py-10 sm:px-8 lg:px-10 lg:py-16">
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] leading-[1.05] tracking-[-0.02em] text-ink">Trois étapes, sans détour.</h2>
          <div className="mt-6 grid gap-0 md:grid-cols-3">
            {[
              { n: '01', title: 'Déposez votre dossier', text: 'Identité, mot de passe et reçu de paiement.' },
              { n: '02', title: 'Le docteur vérifie', text: 'Validation manuelle. Accès de 30 jours après accord.' },
              { n: '03', title: 'Travaillez votre sujet', text: 'Séries de 20 QCM. Correction après envoi.' },
            ].map((step, idx) => (
              <div key={step.n} className={"py-6 md:px-6 " + (idx > 0 ? 'border-t border-line md:border-l md:border-t-0' : '') + ''}>
                <span className="font-display text-[1.4rem] leading-none text-accent">{step.n}</span>
                <h3 className="mt-3 text-[15px] font-medium text-ink">{step.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-mute">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
