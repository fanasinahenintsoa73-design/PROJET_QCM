import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowRight, Menu, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ButtonLink } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth'
import { cn, daysLeft, monthLabel } from '@/lib/utils'
import { StatusPill } from '@/components/ui/StatusPill'

function DesktopLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'relative py-2 text-[13px] font-medium transition-colors hover:text-mute',
          isActive && 'after:absolute after:inset-x-0 after:-bottom-[21px] after:h-0.5 after:bg-ink',
        )
      }
    >
      {children}
    </NavLink>
  )
}

export function PublicHeader() {
  const { user, homePath } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.hash])

  return (
    <header className="sticky top-0 z-50 border-b border-hairline-soft bg-white/95 backdrop-blur">
      <div className="hidden h-9 items-center justify-between border-b border-hairline-soft bg-cloud px-5 text-[9px] font-medium uppercase tracking-[0.16em] text-mute md:flex lg:px-10">
        <span>QCM Médecine L1 · Session {monthLabel()}</span>
        <div className="flex items-center gap-6">
          <Link to="/connexion?role=prof" className="transition hover:text-ink">
            Espace docteur
          </Link>
          <span className="text-hairline">|</span>
          <Link to="/#faq" className="transition hover:text-ink">
            Aide
          </Link>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-content items-center justify-between px-5 lg:px-10">
        <Logo />

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Navigation principale">
          <Link to="/#methode" className="text-[13px] font-medium transition hover:text-mute">
            La méthode
          </Link>
          <Link to="/#sujet" className="text-[13px] font-medium transition hover:text-mute">
            Le parcours
          </Link>
          <Link to="/#docteur" className="text-[13px] font-medium transition hover:text-mute">
            Le docteur
          </Link>
          <Link to="/#faq" className="text-[13px] font-medium transition hover:text-mute">
            FAQ
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <ButtonLink to={homePath} size="sm" className="hidden sm:inline-flex">
              Mon espace <ArrowRight size={14} />
            </ButtonLink>
          ) : (
            <>
              <Link
                to="/connexion"
                className="hidden text-[13px] font-medium transition hover:text-mute sm:block"
              >
                Se connecter
              </Link>
              <ButtonLink to="/inscription" size="sm" className="hidden sm:inline-flex">
                Demander l’accès
              </ButtonLink>
            </>
          )}
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-cloud lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="animate-fade-in border-t border-hairline-soft bg-white px-5 pb-6 pt-3 lg:hidden">
          <nav className="flex flex-col" aria-label="Navigation mobile">
            {[
              ['La méthode', '/#methode'],
              ['Le parcours', '/#sujet'],
              ['Le docteur', '/#docteur'],
              ['FAQ', '/#faq'],
            ].map(([label, to]) => (
              <Link
                key={to}
                to={to}
                className="border-b border-hairline-soft py-4 text-[15px] font-medium"
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 flex flex-col gap-3">
            {user ? (
              <ButtonLink to={homePath} className="w-full">
                Accéder à mon espace
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/inscription" className="w-full">
                  Demander l’accès
                </ButtonLink>
                <ButtonLink to="/connexion" variant="secondary" className="w-full">
                  Se connecter
                </ButtonLink>
                <Link
                  to="/connexion?role=prof"
                  className="pt-2 text-center text-[12px] font-medium text-mute underline underline-offset-4"
                  onClick={() => setOpen(false)}
                >
                  Accès docteur
                </Link>
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
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  if (!user) return null
  const remaining = daysLeft(user.expiresAt)
  const navItems = [
    { to: '/app', label: 'Tableau de bord', end: true },
    { to: '/app/entrainement', label: 'S’entraîner' },
    { to: '/app/historique', label: 'Historique' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-hairline-soft bg-white/95 backdrop-blur">
      <div className="hidden h-9 items-center justify-between border-b border-hairline-soft bg-cloud px-5 text-[9px] font-medium uppercase tracking-[0.16em] text-mute md:flex lg:px-10">
        <span>
          Session {monthLabel()} · Accès personnel
        </span>
        <div className="flex items-center gap-6">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {remaining} jours restants
          </span>
          <span className="text-hairline">|</span>
          <button type="button" onClick={logout} className="uppercase tracking-[0.16em] transition hover:text-ink">
            Se déconnecter
          </button>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-content items-center justify-between px-5 lg:px-10">
        <Logo to="/app" />

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Navigation étudiant">
          {navItems.map((item) => (
            <DesktopLink key={item.to} to={item.to}>
              {item.label}
            </DesktopLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <StatusPill tone={remaining <= 7 ? 'warning' : 'success'} className="hidden sm:inline-flex">
            {remaining} jours
          </StatusPill>
          <span
            className="grid h-9 w-9 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white"
            aria-hidden
          >
            {user.firstName.charAt(0)}
            {user.lastName.charAt(0)}
          </span>
          <button
            type="button"
            onClick={logout}
            className="hidden h-9 w-9 place-items-center rounded-full bg-cloud transition hover:bg-hairline-soft sm:grid"
            aria-label="Se déconnecter"
            title="Se déconnecter"
          >
            <ArrowRight size={15} className="rotate-180" />
          </button>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-cloud lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="animate-fade-in border-t border-hairline-soft bg-white px-5 pb-6 pt-3 lg:hidden">
          <nav className="flex flex-col" aria-label="Navigation étudiant mobile">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className="border-b border-hairline-soft py-4 text-[15px] font-medium"
              >
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={logout}
              className="py-4 text-left text-[15px] font-medium text-mute"
            >
              Se déconnecter
            </button>
          </nav>
        </div>
      )}
    </header>
  )
}

export function MinimalHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-hairline-soft bg-white">
      <div className="mx-auto flex h-16 max-w-content items-center justify-between px-5 lg:px-10">
        <Logo />
        {right}
      </div>
    </header>
  )
}
