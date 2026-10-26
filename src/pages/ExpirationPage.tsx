import { ArrowRight, ArrowUpRight, CalendarX2, Check, Clock3, LockKeyhole, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { getNextSubjectForUser } from '@/lib/db'
import { usePageTitle } from '@/components/Layouts'
import { ButtonLink } from '@/components/ui/Button'
import { StatusPill } from '@/components/ui/StatusPill'
import { formatDateLong } from '@/lib/utils'

export function ExpirationPage() {
  usePageTitle('Accès expiré — MEDQCM L1')
  const { user, db, latestRequest, access } = useAuth()
  if (!user) return null

  const rejected = access === 'rejected'
  const reason = user.rejectionReason || latestRequest?.note
  const subject = getNextSubjectForUser(user.id, db)
  const expiredDaysAgo = user.expiresAt
    ? Math.max(0, Math.floor((Date.now() - new Date(user.expiresAt).getTime()) / 86_400_000))
    : null

  return (
    <>
      <section className="relative overflow-hidden bg-ink text-white">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 top-1/2 hidden -translate-y-1/2 select-none font-display text-[420px] leading-none text-white/[0.04] lg:block"
        >
          {rejected ? '!' : '30'}
        </span>
        <div className="relative mx-auto max-w-content px-5 py-12 sm:px-10 lg:px-10 lg:py-20">
          <div className="flex flex-col justify-between gap-4 border-b border-white/15 pb-5 sm:flex-row sm:items-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/50">
              Accès mensuel — Médecine L1
            </p>
            <StatusPill tone="error">{rejected ? 'Demande refusée' : 'Accès expiré'}</StatusPill>
          </div>

          <div className="grid gap-10 pt-10 lg:grid-cols-12 lg:gap-16 lg:pt-14">
            <div className="lg:col-span-8">
              <h1 className="display text-[clamp(3.5rem,9vw,7.5rem)]">
                {rejected ? (
                  <>
                    Justificatif
                    <br />
                    à revoir.
                  </>
                ) : (
                  <>
                    Cycle
                    <br />
                    terminé.
                  </>
                )}
              </h1>

              {rejected ? (
                <p className="mt-7 max-w-2xl text-[15px] leading-[1.7] text-white/65">
                  Votre demande n’a pas pu être validée. Vous pouvez transmettre un nouveau justificatif
                  dès maintenant : votre docteur le vérifiera sous 24 heures.
                </p>
              ) : (
                <p className="mt-7 max-w-2xl text-[15px] leading-[1.7] text-white/65">
                  Votre cycle de 30 jours est arrivé à expiration. Le prochain sujet de votre
                  parcours sera attribué automatiquement dès que votre renouvellement sera accepté.
                </p>
              )}

              {rejected && reason && (
                <div className="mt-6 max-w-2xl border-l-2 border-sale bg-white/5 px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">
                    Motif indiqué par le docteur
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/80">{reason}</p>
                </div>
              )}

              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <ButtonLink to="/reinscription" variant="white" size="lg" className="w-full sm:w-auto">
                  {rejected
                    ? 'Transmettre un nouveau justificatif'
                    : 'Faire une nouvelle demande pour le nouveau sujet'}
                  <ArrowRight size={16} />
                </ButtonLink>
                <Link
                  to="/"
                  className="py-2 text-[12px] font-medium text-white/60 underline decoration-white/30 underline-offset-[6px] transition hover:text-white"
                >
                  Retour à l’accueil
                </Link>
              </div>

              <p className="mt-5 flex items-start gap-2 text-[10px] leading-relaxed text-white/40">
                <LockKeyhole size={11} className="mt-0.5 shrink-0" />
                {rejected
                  ? 'Aucun accès QCM n’est ouvert tant que le docteur n’a pas validé un justificatif conforme.'
                  : 'L’accès est bloqué immédiatement au terme des 30 jours. Vos résultats passés restent conservés.'}
              </p>
            </div>

            <div className="lg:col-span-4">
              <div className="border border-white/15 p-5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  Récapitulatif du compte
                </p>
                <div className="mt-4 divide-y divide-white/10">
                  {[
                    ['Titulaire', `${user.firstName} ${user.lastName}`],
                    ['Email', user.email],
                    rejected
                      ? ['Demande', latestRequest ? formatDateLong(latestRequest.createdAt) : '—']
                      : ['Expiré le', user.expiresAt ? formatDateLong(user.expiresAt) : '—'],
                    rejected
                      ? ['Statut', 'Justificatif refusé']
                      : [
                          'Depuis',
                          expiredDaysAgo === 0
                            ? 'Aujourd’hui'
                            : `${expiredDaysAgo} jour${expiredDaysAgo && expiredDaysAgo > 1 ? 's' : ''}`,
                        ],
                  ].map(([label, value]) => (
                    <div key={label} className="py-3">
                      <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/35">
                        {label}
                      </p>
                      <p className="mt-1 text-[12px] text-white/85">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-canvas">
        <div className="mx-auto max-w-content px-5 py-14 sm:px-10 lg:px-10 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <p className="eyebrow">La suite</p>
              <h2 className="display mt-4 text-[clamp(2.6rem,5vw,4rem)]">
                Trois temps.
                <br />
                Un nouveau mois.
              </h2>
              <p className="mt-5 max-w-xs text-[13px] leading-[1.7] text-ash">
                Le prochain sujet de votre parcours est déjà prêt. Il ne manque que votre nouveau
                justificatif pour rouvrir l’accès.
              </p>
              <ButtonLink to="/reinscription" size="md" className="mt-6">
                Renouveler mon accès <ArrowRight size={15} />
              </ButtonLink>
            </div>

            <div className="lg:col-span-8">
              <div className="border-t border-ink">
                {[
                  {
                    icon: RotateCcw,
                    number: '01',
                    title: 'Le sujet suivant est prêt',
                    text: 'Votre parcours avance dans la file des sujets préparés par le docteur. Votre historique de résultats reste conservé.',
                  },
                  {
                    icon: CalendarX2,
                    number: '02',
                    title: 'Vous joignez un nouveau reçu',
                    text: 'La demande de renouvellement prend moins d’une minute. Le justificatif est obligatoire.',
                  },
                  {
                    icon: Check,
                    number: '03',
                    title: '30 jours sont réactivés',
                    text: 'Après vérification, votre docteur active un nouveau cycle complet de 30 jours.',
                  },
                ].map((step) => {
                  const Icon = step.icon
                  return (
                    <div
                      key={step.number}
                      className="grid gap-4 border-b border-hairline-soft py-6 sm:grid-cols-[56px_1fr] sm:gap-6"
                    >
                      <div className="flex items-center gap-3 sm:block">
                        <span className="font-display text-[30px] leading-none text-mute">{step.number}</span>
                        <Icon size={16} className="text-mute sm:mt-3 sm:block" />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-medium">{step.title}</h3>
                        <p className="mt-1.5 max-w-lg text-[12px] leading-relaxed text-ash">{step.text}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {subject && (
                <div className="mt-8 flex flex-col justify-between gap-4 bg-cloud p-5 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white">
                      <Clock3 size={15} />
                    </span>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mute">
                        Prochain sujet de votre parcours · {subject.monthLabel}
                      </p>
                      <p className="mt-1 text-[13px] font-medium">{subject.title}</p>
                    </div>
                  </div>
                  <Link
                    to="/#sujet"
                    className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium underline decoration-1 underline-offset-4"
                  >
                    Voir le programme <ArrowUpRight size={12} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
