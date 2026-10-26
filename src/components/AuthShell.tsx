import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'

export function AuthShell({
  children,
  accessLabel = 'Espace étudiant',
}: {
  children: ReactNode
  accessLabel?: string
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex min-h-screen w-full max-w-[1080px] flex-col px-5 py-5 sm:px-8 lg:px-10 lg:py-7">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-mute">
            {accessLabel}
          </span>
        </div>

        <main className="flex flex-1 items-center justify-center py-10 sm:py-14">
          <div className="w-full max-w-[440px]">{children}</div>
        </main>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[11px] text-mute">
          <span>© {new Date().getFullYear()} MEDQCM L1</span>
          <span>Préparation mensuelle · L1 santé</span>
        </div>
      </div>
    </div>
  )
}
