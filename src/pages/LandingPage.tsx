import { ArrowRight } from 'lucide-react'
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
    <section className="border-b border-line bg-surface">
      <div className="mx-auto grid max-w-content gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:px-10 lg:py-20">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-medium text-mute">
            <span className={`h-2 w-2 rounded-full ${open ? 'bg-success-bright' : 'bg-stone'}`} />
            QCM médecine L1 · {sessionLabel}
          </div>
          <h1 className="mt-6 max-w-2xl font-display text-[clamp(2.8rem,6vw,5rem)] leading-[0.98] tracking-[-0.03em] text-ink">
            Un sujet complet.
            <br />
            Trente jours pour le maîtriser.
          </h1>
          <p className="mt-6 max-w-[32rem] text-[16px] leading-[1.65] text-mute">
            Le docteur publie un sujet. Vous le travaillez à votre rythme, puis vous lisez la correction.
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
        </div>

        <aside id="cycle" className="scroll-mt-24 border-t border-line pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
          <p className="eyebrow">Le cycle</p>
          <p className="mt-4 font-display text-[clamp(1.5rem,2.5vw,2rem)] leading-[1.15] tracking-[-0.02em] text-ink">
            {subject?.title ?? 'Le prochain sujet est en préparation.'}
          </p>
          <p className="mt-2 text-[12px] text-mute">
            {subject ? `Publié le ${formatDateLong(subject.publishedAt)}` : 'Le docteur le publiera dès qu’il sera prêt.'}
          </p>
          <ol className="mt-8 border-t border-line">
            {[
              ['Déposez votre dossier', 'Identité, reçu de paiement, puis validation par le docteur.'],
              ['Recevez votre sujet', 'L’accès s’ouvre après validation, pour un seul sujet à la fois.'],
              ['Travaillez et corrigez', 'Des séries de dix questions, correction après envoi.'],
            ].map(([title, text]) => (
              <li key={title} className="border-b border-line py-4">
                <p className="text-[13px] font-medium text-ink">{title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-mute">{text}</p>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  )
}
