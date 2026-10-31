import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex min-h-screen w-full max-w-[1080px] flex-col px-5 py-5 sm:px-8 lg:px-10 lg:py-7">
        <div className="flex items-center">
          <Logo />
        </div>

        <main className="flex flex-1 items-center justify-center py-10 sm:py-14">
          <div className="w-full max-w-[440px]">{children}</div>
        </main>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4 text-[11px] text-mute">
          <span>© {new Date().getFullYear()} MEDQCM mada</span>
          <span>L1 santé</span>
        </div>
      </div>
    </div>
  )
}
