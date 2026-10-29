import { ArrowRight, CalendarX2, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { usePageTitle } from '@/components/Layouts'
import { ButtonLink } from '@/components/ui/Button'
import { StatusPill } from '@/components/ui/StatusPill'
import { formatDateLong, SERIES_LIMIT } from '@/lib/utils'

export function ExpirationPage() {
  usePageTitle('Accès terminé — MEDQCM L1')
  const { user, latestRequest, access } = useAuth()
  if (!user) return null

  const rejected = access === 'rejected'
  const reason = user.rejectionReason || latestRequest?.note

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-12 sm:px-8 lg:px-10 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-16">
          <div>
            <StatusPill tone={rejected ? 'error' : 'warning'} dot>
              {rejected ? 'Dossier non accepté' : 'Cycle terminé'}
            </StatusPill>

            <h1 className="mt-6 max-w-xl font-display text-[clamp(2.5rem,5.4vw,4rem)] leading-[1.03] tracking-[-0.035em] text-ink">
              {rejected ? 'Votre dossier n’a pas été accepté.' : 'Vos 30 séries sont terminées.'}
            </h1>

            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-mute">
              {rejected
                ? 'Votre accès est suspendu. Passez au renouvellement pour ouvrir un nouveau cycle de 30 séries.'
                : 'Votre accès est expiré. Passez au renouvellement pour commencer un nouveau cycle de 30 séries.'}
            </p>

            {rejected && reason ? (
              <div className="mt-6 max-w-lg rounded-xl border border-sale/20 bg-danger-soft p-4">
                <p className="text-[11px] font-medium text-sale">Motif du refus</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ash">{reason}</p>
              </div>
            ) : null}

            <div className="mt-7">
              <ButtonLink to="/reinscription" size="lg">
                Passer au renouvellement <ArrowRight size={16} />
              </ButtonLink>
            </div>
          </div>

          <aside className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent">
                {rejected ? <ShieldCheck size={16} /> : <CalendarX2 size={16} />}
              </span>
              <div>
                <p className="text-[13px] font-medium text-ink">Prochain cycle</p>
                <p className="text-[11px] text-mute">Ouverture immédiate après le renouvellement</p>
              </div>
            </div>

            <dl className="mt-6 space-y-3 border-t border-line pt-5 text-[12px]">
              <div className="flex items-start justify-between gap-5">
                <dt className="text-mute">Compte</dt>
                <dd className="text-right font-medium text-ink">{user.email}</dd>
              </div>
              <div className="flex items-start justify-between gap-5">
                <dt className="text-mute">{rejected ? 'Dernière demande' : 'Cycle'}</dt>
                <dd className="text-right font-medium text-ink">
                  {rejected
                    ? formatDateLong(latestRequest?.createdAt ?? user.createdAt)
                    : `${SERIES_LIMIT} séries terminées`}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-5">
                <dt className="text-mute">Thèmes</dt>
                <dd className="text-right font-medium text-ink">Les 9 thèmes PACES</dd>
              </div>
              <div className="flex items-start justify-between gap-5">
                <dt className="text-mute">Séries incluses</dt>
                <dd className="text-right font-medium text-ink">{SERIES_LIMIT} séries de 10 questions</dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </div>
  )
}
