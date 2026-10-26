import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Users,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Logo } from '@/components/Logo'
import { fullName, initials } from '@/lib/utils'

const navItems = [
  { to: '/admin', label: 'Vue d’ensemble', icon: LayoutDashboard, end: true },
  { to: '/admin/demandes', label: 'Demandes', icon: ClipboardCheck },
  { to: '/admin/sujet', label: 'Sujets', icon: BookOpen },
  { to: '/admin/etudiants', label: 'Étudiants', icon: Users },
]

export function AdminLayout() {
  const { user, db, logout } = useAuth()
  const navigate = useNavigate()
  const pendingCount = db.requests.filter((request) => request.status === 'pending').length

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-hairline-soft bg-white">
        <div className="mx-auto flex h-16 max-w-content items-center gap-4 px-4 sm:px-8 lg:px-12">
          <Logo to="/admin" />

          <nav className="ml-4 hidden h-16 items-stretch gap-6 md:flex" aria-label="Navigation docteur">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 border-b-2 text-[13px] font-medium transition-colors',
                    isActive
                      ? 'border-ink text-ink'
                      : 'border-transparent text-mute hover:text-ink',
                  ].join(' ')
                }
              >
                {item.label}
                {item.to === '/admin/demandes' && pendingCount > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1.5 text-[9px] font-semibold text-white">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <div className="hidden text-right lg:block">
              <p className="text-[12px] font-medium leading-tight text-ink">
                {user ? fullName(user.firstName, user.lastName) : 'Docteur'}
              </p>
              <p className="mt-0.5 text-[10px] text-mute">Docteur</p>
            </div>
            <span className="hidden size-9 place-items-center rounded-full bg-cloud text-[11px] font-semibold text-ink sm:grid">
              {user ? initials(user.firstName, user.lastName) : 'DR'}
            </span>
            <button
              type="button"
              onClick={() => {
                logout()
                navigate('/connexion')
              }}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-cloud px-3 text-[11px] font-medium text-charcoal transition hover:bg-ink hover:text-white"
            >
              <LogOut className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
              Déconnexion
            </button>
          </div>
        </div>

        <div className="border-t border-hairline-soft md:hidden">
          <nav
            className="mx-auto grid max-w-content grid-cols-4 items-stretch px-2 sm:px-8"
            aria-label="Navigation docteur mobile"
          >
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      'flex min-w-0 items-center justify-center gap-1 whitespace-nowrap border-b-2 py-3 text-[9.5px] font-medium transition-colors',
                      isActive
                        ? 'border-ink text-ink'
                        : 'border-transparent text-mute',
                    ].join(' ')
                  }
                >
                  <Icon className="hidden size-3.5 sm:block" strokeWidth={1.7} />
                  {item.label}
                  {item.to === '/admin/demandes' && pendingCount > 0 && (
                    <span className="grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[8px] font-semibold text-white">
                      {pendingCount}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-hairline-soft bg-white">
        <div className="mx-auto flex max-w-content flex-col gap-2 px-4 py-5 text-[10px] text-mute sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p>MEDQCM L1 · Espace docteur · Prototype de démonstration, données locales.</p>
        </div>
      </footer>
    </div>
  )
}
