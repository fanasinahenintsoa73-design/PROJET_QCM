import { Link, useLocation, useParams } from 'react-router-dom'
import { usePageTitle } from '@/components/Layouts'
import { chapterTitle } from '@/lib/themes'
import { LevelBilan } from '@/components/anki/LevelBilan'
import type { AnkiLevelResult, Question } from '@/types'

type BilanState = {
  result: AnkiLevelResult
  questions: Question[]
  answers: Record<string, string[]>
}

/** Le bilan d'un niveau : verdict + correction des 5 questions. */
export default function AnkiLevelResultPage() {
  const { chapterId = '', level = '1' } = useParams()
  const location = useLocation()
  usePageTitle(`Bilan — ${chapterTitle(chapterId)} — MEDGAME — MEDQCM mada`)

  const state = (location.state ?? null) as BilanState | null

  if (!state?.result) {
    return (
      <div className="bg-canvas">
        <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-12">
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="text-[13px] text-mute">
              Le bilan de ce niveau n’est plus disponible. Rejoue le niveau pour le retrouver.
            </p>
            <Link
              to={`/app/medgame/${chapterId}/niveau/${level}`}
              className="mt-4 inline-block rounded-xl bg-accent px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-accent-deep"
            >
              Rejouer le niveau {level}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-12">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
          Niveau {level} · bilan
        </p>
        <h1 className="mt-1 mb-5 font-display text-[24px] tracking-[-0.02em] text-ink">
          {chapterTitle(chapterId)}
        </h1>
        <LevelBilan
          chapterId={chapterId}
          level={Number(level) || 1}
          result={state.result}
          questions={state.questions}
          answers={state.answers}
        />
      </div>
    </div>
  )
}
