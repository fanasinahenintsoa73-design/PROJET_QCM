import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowRight, LogOut, Menu, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ButtonLink } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth'
import { cn, daysLeft, monthLabel } from '@/lib/utils'
import { StatusPill } from '@/components/ui/StatusPill'

function DesktopLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'relative py-2 text-[13px] font-medium transition-colors hover:text-accent',
          isActive && 'text-accent after:absolute after:inset-x-0 after:-bottom-[21px] after:h-0.5 after:bg-accent',
        )
      }
    >
      {children}
    </NavLink>
  )
}

export function PublicHeader() {
  const { user, homePath } = useAuth()
  const studentUser = user?.role === 'student' ? user : null
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.hash])

  const nav = [
    ['La méthode', '/#methode'],
    ['Le contenu', '/#contenu'],
    ['Le docteur', '/#docteur'],
    ['FAQ', '/#faq'],
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-content items-center justify-between px-5 lg:px-10">
        <Logo />

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navigation principale">
          {nav.map(([label, to]) => (
            <Link key={to} to={to} className="text-[13px] font-medium text-ash transition hover:text-accent">
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {studentUser ? (
            <ButtonLink to={homePath} size="sm" className="hidden sm:inline-flex">
              Mon espace <ArrowRight size={14} />
            </ButtonLink>
          ) : (
            <>
              <Link
                to="/connexion"
                className="hidden text-[13px] font-medium text-ash transition hover:text-accent sm:block"
              >
                Se connecter
              </Link>
              <ButtonLink to="/inscription" size="sm" className="hidden sm:inline-flex">
                Créer mon dossier
              </ButtonLink>
            </>
          )}
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg border border-line text-ink lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="animate-fade-in border-t border-line bg-surface px-5 pb-6 pt-3 lg:hidden">
          <nav className="flex flex-col" aria-label="Navigation mobile">
            {nav.map(([label, to]) => (
              <Link
                key={to}
                to={to}
                className="border-b border-line py-4 text-[15px] font-medium text-ink"
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 flex flex-col gap-3">
            {studentUser ? (
              <ButtonLink to={homePath} className="w-full">
                Accéder à mon espace
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/inscription" className="w-full">
                  Créer mon dossier
                </ButtonLink>
                <ButtonLink to="/connexion" variant="secondary" className="w-full">
                  Se connecter
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export function StudentHeader() {
  const { user, logout } = useAuth()

  if (!user) return null
  const remaining = daysLeft(user.expiresAt)
  const navItems = [
    { to: '/app', label: 'Mon cycle', end: true },
    { to: '/app/historique', label: 'Historique', end: false },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-content items-center justify-between px-5 lg:px-10">
        <div className="flex items-center gap-8">
          <Logo to="/app" />
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Navigation étudiant">
            {navItems.map((item) => (
              <DesktopLink key={item.to} to={item.to}>
                {item.label}
              </DesktopLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <StatusPill tone={remaining <= 7 ? 'warning' : 'success'} className="hidden sm:inline-flex">
            {remaining} jours
          </StatusPill>
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
      <div className="border-t border-line bg-canvas/60 lg:hidden">
        <div className="mx-auto flex max-w-content items-center justify-between px-5 py-2 text-[11px] text-mute">
          <span>Cycle de 30 jours</span>
          <span>{monthLabel()}</span>
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
