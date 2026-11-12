import { CalendarX2, Phone, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { usePageTitle } from '@/components/Layouts'
import { StatusPill } from '@/components/ui/StatusPill'
import { doctorContactLine } from '@/lib/contact'
import { getSeriesUsage } from '@/lib/db'
import { SERIES_LIMIT } from '@/lib/utils'

export function ExpirationPage() {
  usePageTitle('Accès terminé — MEDQCM mada')
  const { user, access, ticketBlocked, db, ticketType, ticketExpiresAt } = useAuth()
  if (!user) return null

  const ankiExpired =
    ticketType === 'anki' && ticketExpiresAt
      ? new Date(ticketExpiresAt).getTime() < Date.now()
      : false
  const suspended = (ticketBlocked && !ankiExpired) || access === 'rejected'
  const usage = user.role === 'student' ? getSeriesUsage(user.id, db) : null

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-12 sm:px-8 lg:px-10 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-16">
          <div>
            <StatusPill tone={suspended ? 'error' : 'warning'} dot>
              {suspended ? 'Accès suspendu' : 'Ticket terminé'}
            </StatusPill>

            <h1 className="mt-6 max-w-xl font-display text-[clamp(2.5rem,5.4vw,4rem)] leading-[1.03] tracking-[-0.035em] text-ink">
              {suspended
                ? 'Votre accès est suspendu.'
                : ankiExpired
                  ? 'Votre ticket MEDGAME a expiré.'
                  : 'Vos 30 séries sont terminées.'}
            </h1>

            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-mute">
              {suspended
                ? 'Contactez le docteur pour plus d’informations.'
                : ankiExpired
                  ? 'Ton ticket MEDGAME d’un mois est terminé. Contacte le docteur pour un nouveau ticket et choisir 5 nouveaux chapitres.'
                  : 'Ton ticket est terminé. Contacte le docteur pour un nouveau ticket et continuer tes séries.'}
            </p>

            <div className="mt-6 flex max-w-lg items-start gap-2.5 rounded-xl border border-line bg-surface px-4 py-3.5 text-[13px] leading-relaxed text-mute">
              <Phone size={15} className="mt-0.5 shrink-0 text-accent" />
              <span>{doctorContactLine()}</span>
            </div>
          </div>

          <aside className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent">
                {suspended ? <ShieldCheck size={16} /> : <CalendarX2 size={16} />}
              </span>
              <div>
                <p className="text-[13px] font-medium text-ink">{suspended ? 'Accès suspendu' : 'Prochain ticket'}</p>
                <p className="text-[11px] text-mute">
                  {suspended
                    ? 'Le docteur peut réactiver ton accès'
                    : ankiExpired
                      ? 'Un nouveau ticket rouvre 5 chapitres'
                      : 'Un nouveau ticket rouvre 30 séries'}
                </p>
              </div>
            </div>

            <dl className="mt-6 space-y-3 border-t border-line pt-5 text-[12px]">
              <div className="flex items-start justify-between gap-5">
                <dt className="text-mute">Identifiant</dt>
                <dd className="text-right font-medium text-ink">
                  {`${user.firstName} ${user.lastName}`.trim()}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-5">
                <dt className="text-mute">Séries faites</dt>
                <dd className="text-right font-medium text-ink">
                  {usage ? `${usage.used} / ${SERIES_LIMIT}` : `${SERIES_LIMIT} / ${SERIES_LIMIT}`}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-5">
                <dt className="text-mute">Thèmes</dt>
                <dd className="text-right font-medium text-ink">Les 9 thèmes PACES</dd>
              </div>
              <div className="flex items-start justify-between gap-5">
                <dt className="text-mute">Par ticket</dt>
                <dd className="text-right font-medium text-ink">{SERIES_LIMIT} séries de 10 questions</dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </div>
  )
}
