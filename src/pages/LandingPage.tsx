import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ButtonLink } from '@/components/ui/Button'
import { usePageTitle } from '@/components/Layouts'
import { useAuth } from '@/lib/auth'
import { getPublishedSubjects } from '@/lib/db'
import { PACE_THEMES } from '@/lib/themes'
import { formatDateLong, SERIES_LIMIT, SERIES_SIZE } from '@/lib/utils'

export function LandingPage() {
  usePageTitle('MEDQCM L1 — Les neuf thèmes PACES')
  const { db, user, homePath } = useAuth()
  const subjects = getPublishedSubjects(db)
  const open = subjects.length > 0
  const studentUser = user?.role === 'student' ? user : null
  const startHref = studentUser ? homePath : '/inscription'
  const lastPublished = subjects.reduce(
    (latest, subject) => (subject.publishedAt > latest ? subject.publishedAt : latest),
    '',
  )

  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto grid max-w-content gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:px-10 lg:py-20">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-medium text-mute">
            <span className={`h-2 w-2 rounded-full ${open ? 'bg-success-bright' : 'bg-stone'}`} />
            PACES (Première Année Commune des Études de Santé)
          </div>
          <h1 className="mt-6 max-w-2xl font-display text-[clamp(2.8rem,6vw,5rem)] leading-[0.98] tracking-[-0.03em] text-ink">
            Neuf thèmes PACES.
            <br />
            Trente séries pour progresser.
          </h1>
          <p className="mt-6 max-w-[32rem] text-[16px] leading-[1.65] text-mute">
            Neuf thèmes PACES. Des séries de dix questions, à votre rythme. Trente séries par
            cycle, avec la correction détaillée après chaque envoi.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
            <ButtonLink to={startHref} size="lg" className="w-full sm:w-auto">
              {studentUser ? 'Ouvrir mon espace' : 'Créer compte'} <ArrowRight size={16} />
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
            {PACE_THEMES.length} thèmes. {SERIES_LIMIT} séries.
          </p>
          <p className="mt-2 text-[12px] text-mute">
            {lastPublished
              ? `Catalogue publié le ${formatDateLong(lastPublished)}`
              : 'Le catalogue sera publié dès que le docteur l’aura validé.'}
          </p>
          <ol className="mt-8 border-t border-line">
            {[
              ['Déposez votre dossier', 'Identité, reçu de paiement, puis validation par le docteur.'],
              ['Choisissez vos thèmes', 'Les neuf thèmes PACES sont ouverts dès l’activation du cycle.'],
              [
                'Travaillez et corrigez',
                `${SERIES_LIMIT} séries de ${SERIES_SIZE} questions, correction après envoi.`,
              ],
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
