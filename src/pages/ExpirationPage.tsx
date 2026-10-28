import { ArrowRight, CalendarX2, FileText, RotateCcw, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getSeriesUsage } from '@/lib/db'
import { usePageTitle } from '@/components/Layouts'
import { ButtonLink } from '@/components/ui/Button'
import { StatusPill } from '@/components/ui/StatusPill'
import { formatDateLong, SERIES_LIMIT } from '@/lib/utils'

export function ExpirationPage() {
  usePageTitle('Accès terminé — MEDQCM L1')
  const { user, db, latestRequest, access } = useAuth()
  if (!user) return null

  const rejected = access === 'rejected'
  const reason = user.rejectionReason || latestRequest?.note
  const usage = getSeriesUsage(user.id, db)
  const expiredDaysAgo = user.expiresAt
    ? Math.max(0, Math.floor((Date.now() - new Date(user.expiresAt).getTime()) / 86_400_000))
    : null

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-12 sm:px-8 lg:px-10 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-16">
          <div>
            <StatusPill tone={rejected ? 'error' : 'warning'} dot>
              {rejected ? 'Dossier non accepté' : 'Cycle terminé'}
            </StatusPill>

            <h1 className="mt-6 max-w-xl font-display text-[clamp(2.5rem,5.4vw,4rem)] leading-[1.03] tracking-[-0.035em] text-ink">
              {rejected ? 'Votre dossier n’a pas été accepté.' : 'Votre cycle est terminé.'}
            </h1>

            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-mute">
              {rejected
                ? 'Le justificatif transmis n’a pas permis d’ouvrir votre accès. Vous pouvez déposer un nouveau reçu pour une nouvelle vérification.'
                : `Votre accès de 30 jours s’est achevé le ${formatDateLong(user.expiresAt)}${
                    expiredDaysAgo && expiredDaysAgo > 0
                      ? `, il y a ${expiredDaysAgo} jour${expiredDaysAgo > 1 ? 's' : ''}`
                      : ''
                  }. Les neuf thèmes et vos ${SERIES_LIMIT} séries reviennent dès le renouvellement validé.`}
            </p>

            {rejected && reason ? (
              <div className="mt-6 max-w-lg rounded-xl border border-sale/20 bg-danger-soft p-4">
                <p className="text-[11px] font-medium text-sale">Motif du refus</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ash">{reason}</p>
              </div>
            ) : null}

            <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <ButtonLink to="/reinscription" size="lg">
                {rejected ? 'Déposer un nouveau reçu' : 'Renouveler mon accès'} <ArrowRight size={16} />
              </ButtonLink>
              <p className="text-[12px] leading-relaxed text-mute">
                Le nouveau cycle démarre dès la validation, pour 30 jours.
              </p>
            </div>

            <div className="mt-10 flex items-start gap-3 border-t border-line pt-6">
              <FileText size={16} className="mt-0.5 shrink-0 text-mute" />
              <p className="max-w-md text-[12px] leading-relaxed text-mute">
                L’historique du cycle précédent est archivé et n’est plus affiché dans votre
                espace étudiant. Vos résultats restent enregistrés côté docteur.
              </p>
            </div>
          </div>

          <aside className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent">
                {rejected ? <ShieldCheck size={16} /> : <CalendarX2 size={16} />}
              </span>
              <div>
                <p className="text-[13px] font-medium text-ink">
                  {rejected ? 'Nouvelle demande' : 'Prochain cycle'}
                </p>
                <p className="text-[11px] text-mute">
                  {rejected ? 'Un nouveau reçu suffit' : 'Ouverture immédiate après validation'}
                </p>
              </div>
            </div>

            <dl className="mt-6 space-y-3 border-t border-line pt-5 text-[12px]">
              <div className="flex items-start justify-between gap-5">
                <dt className="text-mute">Compte</dt>
                <dd className="text-right font-medium text-ink">{user.email}</dd>
              </div>
              <div className="flex items-start justify-between gap-5">
                <dt className="text-mute">{rejected ? 'Dernière demande' : 'Fin de l’accès'}</dt>
                <dd className="text-right font-medium text-ink">
                  {rejected
                    ? formatDateLong(latestRequest?.createdAt ?? user.createdAt)
                    : formatDateLong(user.expiresAt)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-5">
                <dt className="text-mute">Séries du cycle</dt>
                <dd className="text-right font-medium text-ink">
                  {usage.used} / {SERIES_LIMIT}
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

            <div className="mt-6 rounded-xl bg-accent-soft p-4">
              <div className="flex items-start gap-2.5">
                <RotateCcw size={14} className="mt-0.5 shrink-0 text-accent" />
                <p className="text-[11px] leading-relaxed text-ash">
                  {rejected
                    ? 'Le docteur vérifie chaque nouveau justificatif. Vous conservez le même compte et le même mot de passe.'
                    : 'Après validation, votre compteur repart à zéro et les neuf thèmes sont immédiatement accessibles. Les résultats du cycle précédent restent archivés.'}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
