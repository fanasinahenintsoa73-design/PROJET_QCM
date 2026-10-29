import { NavLink, Outlet } from 'react-router-dom'
import { BookOpen, LayoutDashboard, LogOut, Users } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Logo } from '@/components/Logo'
import { fullName, initials } from '@/lib/utils'

const navItems = [
  { to: '/admin', label: 'Vue d’ensemble', icon: LayoutDashboard, end: true },
  { to: '/admin/themes', label: 'Sujets', icon: BookOpen },
  { to: '/admin/etudiants', label: 'Étudiants', icon: Users },
]

export function AdminLayout() {
  const { user, db, logout } = useAuth()
  const pendingCount = db.requests.filter((request) => request.status === 'pending').length

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-[68px] max-w-content items-center gap-5 px-5 sm:px-8 lg:px-10">
          <Logo to="/admin" />
          <span className="hidden h-5 w-px bg-line sm:block" />

          <nav className="ml-3 hidden h-[68px] items-stretch gap-6 md:flex" aria-label="Navigation docteur">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 border-b-2 text-[13px] font-medium transition-colors',
                    isActive
                      ? 'border-accent text-accent'
                      : 'border-transparent text-mute hover:text-ink',
                  ].join(' ')
                }
              >
                {item.label}
                {item.to === '/admin' && pendingCount > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[9px] font-semibold text-white">
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
            <span className="hidden size-9 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent sm:grid">
              {user ? initials(user.firstName, user.lastName) : 'DR'}
            </span>
            <button
              type="button"
              onClick={logout}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[11px] font-medium text-ash transition hover:border-accent hover:text-accent"
            >
              <LogOut className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>

        <div className="border-t border-line md:hidden">
          <nav
            className="mx-auto grid max-w-content grid-cols-3 items-stretch px-2 sm:px-8"
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
                      isActive ? 'border-accent text-accent' : 'border-transparent text-mute',
                    ].join(' ')
                  }
                >
                  <Icon className="hidden size-3.5 sm:block" strokeWidth={1.7} />
                  {item.label}
                  {item.to === '/admin' && pendingCount > 0 && (
                    <span className="grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[8px] font-semibold text-white">
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
    </div>
  )
}
