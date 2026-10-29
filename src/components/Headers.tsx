import { ArrowRight, LogOut } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ButtonLink } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth'

export function PublicHeader() {
  const { user, homePath } = useAuth()
  const studentUser = user?.role === 'student' ? user : null

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-content items-center justify-between px-5 lg:px-10">
        <Logo />

        {studentUser && (
          <ButtonLink to={homePath} size="sm">
            Mon espace <ArrowRight size={14} />
          </ButtonLink>
        )}
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

        <div className="flex items-center gap-3">
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
