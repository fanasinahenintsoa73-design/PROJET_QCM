import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Clock3, Layers, LockKeyhole } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { usePageTitle } from '@/components/Layouts'
import { Button } from '@/components/ui/Button'
import { StatusPill } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/Toast'
import { getSubjectNumber, getSubjectTitle } from '@/lib/subjects'
import { cn, SERIES_SIZE } from '@/lib/utils'

export function SubjectChoicePage() {
  usePageTitle('Choisir mon sujet — MEDQCM L1')
  const { user, db, access, homePath, pendingChoice, refresh } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!user) return null
  if (access !== 'choosing') return <Navigate to={homePath} replace />
  if (!pendingChoice) return <ChoiceUnavailable />

  const currentSubject = pendingChoice.currentSubjectId
    ? db.subjects.find(
        (subject) =>
          subject.id === pendingChoice.currentSubjectId &&
          !subject.archived &&
          subject.questionCount > 0,
      )
    : undefined
  const nextSubject = pendingChoice.nextSubjectId
    ? db.subjects.find(
        (subject) =>
          subject.id === pendingChoice.nextSubjectId &&
          !subject.archived &&
          subject.questionCount > 0,
      )
    : undefined

  if (!currentSubject) return <ChoiceUnavailable />

  const userId = user.id
  const requestId = pendingChoice.id
  const currentNumber = getSubjectNumber(currentSubject.id, db.subjects)
  const nextNumber = nextSubject
    ? getSubjectNumber(nextSubject.id, db.subjects)
    : undefined

  async function handleConfirm() {
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      await api.chooseRenewalSubject(userId, requestId, selected)
      await refresh()
      toast('Votre sujet est choisi. Votre nouveau cycle de 30 jours est ouvert.', 'success')
      navigate('/app', { replace: true })
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Choix impossible.', 'error')
      setSubmitting(false)
    }
  }

  const options = [
    {
      subject: currentSubject,
      number: currentNumber,
      eyebrow: 'Reprendre mon sujet',
      detail: 'Vous gardez le même sujet pour approfondir et consolider vos bases.',
    },
    ...(nextSubject
      ? [
          {
            subject: nextSubject,
            number: nextNumber,
            eyebrow: 'Passer au sujet suivant',
            detail: 'Vous avancez sur le sujet publié suivant dans la file du docteur.',
          },
        ]
      : []),
  ]

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-10 sm:px-8 lg:px-10 lg:py-16">
        <div className="flex flex-col justify-between gap-3 border-b border-line pb-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent">
              Renouvellement validé · Choix du sujet
            </p>
            <h1 className="mt-1 font-display text-[clamp(2.1rem,4.6vw,3.2rem)] leading-[1.05] tracking-[-0.03em] text-ink">
              Choisissez votre prochain sujet.
            </h1>
          </div>
          <StatusPill tone="warning" dot>
            Choix obligatoire
          </StatusPill>
        </div>

        <div className="mt-7 flex items-start gap-3 rounded-xl border border-warning/25 bg-warning-soft p-4">
          <LockKeyhole size={17} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="text-[13px] font-medium text-ink">
              Faites votre choix pour accéder au sujet QCM.
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ash">
              Tant qu’aucun sujet n’est sélectionné, l’accès aux questions reste fermé. Votre
              cycle de 30 jours démarre au moment de votre choix.
            </p>
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="Choix du sujet"
          className={cn(
            'mt-7 grid gap-4',
            options.length > 1 ? 'lg:grid-cols-2' : 'max-w-2xl',
          )}
        >
          {options.map((option) => {
            const active = selected === option.subject.id
            const questionCount = Math.min(SERIES_SIZE, option.subject.questionCount)
            return (
              <button
                key={option.subject.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(option.subject.id)}
                className={cn(
                  'group relative flex h-full flex-col rounded-2xl border p-5 text-left transition sm:p-6',
                  active
                    ? 'border-accent bg-accent-soft ring-1 ring-accent'
                    : 'border-line bg-surface hover:border-accent/40',
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">
                      Sujet {option.number ?? '—'}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.1em] text-mute">
                      {option.eyebrow}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full border transition',
                      active
                        ? 'border-accent bg-accent text-white'
                        : 'border-line bg-white text-transparent',
                    )}
                  >
                    <Check size={13} strokeWidth={2.6} />
                  </span>
                </span>

                <span className="mt-5 font-display text-[1.55rem] leading-[1.12] tracking-[-0.02em] text-ink">
                  {getSubjectTitle(option.subject, option.number)}
                </span>
                <span className="mt-2 text-[13px] leading-relaxed text-mute">
                  {option.subject.description}
                </span>

                <span className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/80 pt-4 text-[11px] text-mute">
                  <span className="inline-flex items-center gap-1.5">
                    <Layers size={13} />
                    {questionCount} question
                    {questionCount > 1 ? 's' : ''}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 size={13} />
                    30 jours
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {!nextSubject && (
          <p className="mt-4 max-w-2xl text-[12px] leading-relaxed text-mute">
            Le sujet suivant n’est pas encore publié par le docteur. Vous pouvez reprendre votre
            sujet actuel ; un nouveau choix vous sera proposé au prochain renouvellement.
          </p>
        )}

        <div className="mt-7 flex flex-col items-start gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-[11px] leading-relaxed text-mute">
            Vous conservez tout votre historique et vos corrections. Un nouveau cycle vierge
            s’ouvre sur le sujet choisi.
          </p>
          <Button
            type="button"
            size="lg"
            className="w-full sm:w-auto"
            disabled={!selected}
            loading={submitting}
            onClick={handleConfirm}
          >
            Ouvrir mon cycle <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}

function ChoiceUnavailable() {
  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-content px-5 py-16 sm:px-8 lg:px-10">
        <div className="max-w-xl rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent">
            Choix du sujet
          </p>
          <h1 className="mt-2 font-display text-[1.9rem] leading-[1.1] tracking-[-0.02em] text-ink">
            Ce choix n’est plus disponible.
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-mute">
            Le sujet proposé a peut-être été retiré ou votre dossier a déjà été mis à jour.
            Actualisez la page ; si le problème persiste, contactez votre docteur.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-5"
            onClick={() => window.location.reload()}
          >
            Actualiser
          </Button>
        </div>
      </div>
    </div>
  )
}
