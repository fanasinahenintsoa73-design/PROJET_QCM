import { useEffect } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpenCheck, History, Home } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { MinimalHeader } from '@/components/Headers'
import { Footer, StudentFooter } from '@/components/Footer'
import { PublicHeader, StudentHeader } from '@/components/Headers'
import { clearSession } from '@/lib/db'

export function PublicLayout() {
  return (
    <>
      <PublicHeader />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

export function StudentLayout() {
  const location = useLocation()
  const showBottomNav = !location.pathname.startsWith('/app/entrainement')

  return (
    <>
      <StudentHeader />
      <main className="min-h-[calc(100vh-100px)] pb-16 lg:pb-0">
        <Outlet />
      </main>
      <StudentFooter />
      {showBottomNav && <StudentBottomNav />}
      {showBottomNav && <div className="h-16 lg:hidden" aria-hidden="true" />}
    </>
  )
}

function StudentBottomNav() {
  const items = [
    { to: '/app', label: 'Accueil', icon: Home, end: true },
    { to: '/app/entrainement', label: 'S’entraîner', icon: BookOpenCheck, end: false },
    { to: '/app/historique', label: 'Historique', icon: History, end: false },
  ]

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline-soft bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Navigation étudiant mobile"
    >
      <div className="mx-auto grid max-w-md grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                  isActive ? 'text-ink' : 'text-mute'
                }`
              }
            >
              <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
              {item.label}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

export function StatusLayout() {
  return (
    <>
      <MinimalHeader
        right={
          <button
            type="button"
            className="text-[11px] font-medium uppercase tracking-[0.14em] text-mute transition hover:text-ink"
            onClick={() => {
              clearSession()
              window.location.href = '/etudiant/connexion'
            }}
          >
            Se déconnecter
          </button>
        }
      />
      <main className="min-h-[calc(100vh-64px)]">
        <Outlet />
      </main>
    </>
  )
}

export function RequireGuest({ children }: { children: React.ReactNode }) {
  const { user, homePath } = useAuth()
  if (user) return <Navigate to={homePath} replace />
  return <>{children}</>
}

export function RequireStudent() {
  const { user, access, homePath } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/etudiant/connexion" state={{ from: location.pathname }} replace />
  if (user.role === 'professor') return <Navigate to="/admin" replace />
  if (access === 'pending') return <Navigate to="/en-attente" replace />
  if (access === 'expired' || access === 'rejected') return <Navigate to="/expiration" replace />
  return <Outlet />
}

export function RequirePending() {
  const { user, access, homePath } = useAuth()
  if (!user) return <Navigate to="/etudiant/connexion" replace />
  if (user.role !== 'student') return <Navigate to="/admin" replace />
  if (access !== 'pending') return <Navigate to={homePath} replace />
  return <Outlet />
}

export function RequireBlocked() {
  const { user, access, homePath } = useAuth()
  if (!user) return <Navigate to="/etudiant/connexion" replace />
  if (user.role !== 'student') return <Navigate to="/admin" replace />
  if (access === 'active') return <Navigate to="/app" replace />
  if (access === 'pending') return <Navigate to="/en-attente" replace />
  return <Outlet />
}

export function RequireAdmin() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/connexion" replace />
  if (user.role !== 'professor') return <Navigate to="/app" replace />
  return <Outlet />
}

export function ScrollToTop() {
  const location = useLocation()
  useEffect(() => {
    if (location.hash) {
      const timer = window.setTimeout(() => {
        const element = document.querySelector(location.hash)
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 60)
      return () => window.clearTimeout(timer)
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname, location.hash])
  return null
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}
