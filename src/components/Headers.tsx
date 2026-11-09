import { LogOut, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/lib/auth'

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-content items-center justify-between px-5 lg:px-10">
        <Logo />
      </div>
    </header>
  )
}

export function StudentHeader() {
  const { user, logout } = useAuth()

  if (!user) return null

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-content items-center justify-between px-5 lg:px-10">
        <Logo to="/app" />

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/message-du-docteur"
            aria-label="Message du docteur"
            title="Message du docteur"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium text-mute transition hover:bg-cloud hover:text-ink sm:px-2.5"
          >
            <Stethoscope size={16} />
            <span className="hidden sm:inline">Message du docteur</span>
          </Link>
          <span
            className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent"
            aria-hidden
          >
            {user.firstName.charAt(0)}
            {user.lastName.charAt(0)}
          </span>
          <button
            type="button"
            onClick={logout}
            className="grid h-9 w-9 place-items-center rounded-lg text-mute transition hover:bg-cloud hover:text-ink"
            aria-label="Se déconnecter"
            title="Se déconnecter"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}

export function MinimalHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-[68px] max-w-content items-center justify-between px-5 lg:px-10">
        <Logo />
        {right}
      </div>
    </header>
  )
}
