import { useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '@/components/Layouts'
import { chapterTitle } from '@/lib/themes'
import { LevelRunner } from '@/components/anki/LevelRunner'

/** L'écran d'un niveau : 5 questions sans correction, puis « Soumettre ». */
export default function AnkiLevelPage() {
  const { chapterId = '', level = '1' } = useParams()
  const navigate = useNavigate()
  usePageTitle(`Niveau ${level} — ${chapterTitle(chapterId)} — MEDGAME — MEDQCM mada`)

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:py-12">
        <LevelRunner
          chapterId={chapterId}
          level={Number(level) || 1}
          onExit={() => navigate(`/app/medgame/${chapterId}`)}
        />
      </div>
    </div>
  )
}
