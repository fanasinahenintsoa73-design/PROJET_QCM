import { LockKeyhole } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-5 py-5 sm:px-10 lg:py-7">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-mute">
            <LockKeyhole size={10} aria-hidden="true" />
            Accès restreint
          </span>
        </div>

        <main className="flex flex-1 flex-col justify-center py-10 sm:py-14">
          {children}
        </main>

        <div className="flex items-center justify-between gap-4 border-t border-hairline-soft pt-4 text-[9px] uppercase tracking-[0.12em] text-mute">
          <span>© {new Date().getFullYear()} MEDQCM L1</span>
          <span className="inline-flex items-center gap-1.5">
            <LockKeyhole size={10} aria-hidden="true" />
            Prototype de démonstration
          </span>
        </div>
      </div>
    </div>
  )
}
