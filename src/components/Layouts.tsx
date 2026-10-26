import { useEffect } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { History, Home } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isDoctorPortal } from '@/lib/portal'
import { MinimalHeader } from '@/components/Headers'
import { Footer, StudentFooter } from '@/components/Footer'
import { PublicHeader, StudentHeader } from '@/components/Headers'
import { clearSession } from '@/lib/db'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'

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
    { to: '/app', label: 'Mon cycle', icon: Home, end: true },
    { to: '/app/historique', label: 'Historique', icon: History, end: false },
  ]

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Navigation étudiant mobile"
    >
      <div className="mx-auto grid max-w-sm grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-accent' : 'text-mute'
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
  const { logout } = useAuth()
  return (
    <>
      <MinimalHeader
        right={
          <button
            type="button"
            className="text-sm text-mute transition hover:text-ink"
            onClick={logout}
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

function PortalMismatch({ expected }: { expected: 'student' | 'doctor' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-5">
      <div className="w-full max-w-md">
        <Logo />
        <h1 className="mt-10 font-display text-4xl text-ink">
          {expected === 'doctor' ? 'Espace réservé au docteur.' : 'Espace réservé aux étudiants.'}
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-mute">
          {expected === 'doctor'
            ? 'Cette session appartient à un compte étudiant. Le portail docteur utilise une session séparée.'
            : 'Cette session appartient à un compte docteur. Le portail étudiant utilise une session séparée.'}
        </p>
        <Button
          className="mt-7"
          onClick={() => {
            clearSession()
            window.location.href = '/'
          }}
        >
          Fermer la session
        </Button>
      </div>
    </div>
  )
}

export function RequireGuest({ children }: { children: React.ReactNode }) {
  const { user, homePath } = useAuth()
  if (user) {
    if (isDoctorPortal && user.role !== 'professor') return <PortalMismatch expected="doctor" />
    if (!isDoctorPortal && user.role !== 'student') return <PortalMismatch expected="student" />
    return <Navigate to={homePath} replace />
  }
  return <>{children}</>
}

/** A student account in any state (pending, active, expired, rejected). */
export function RequireStudentAccount() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/connexion" replace />
  if (user.role !== 'student') return <PortalMismatch expected="student" />
  return <Outlet />
}

/** A student with a currently usable cycle. */
export function RequireStudent() {
  const { user, access } = useAuth()
  if (!user) return <Navigate to="/connexion" replace />
  if (user.role !== 'student') return <PortalMismatch expected="student" />
  if (access === 'pending') return <Navigate to="/en-attente" replace />
  if (access === 'expired' || access === 'rejected') return <Navigate to="/expiration" replace />
  return <Outlet />
}

export function RequireBlocked() {
  const { user, access } = useAuth()
  if (!user) return <Navigate to="/connexion" replace />
  if (user.role !== 'student') return <PortalMismatch expected="student" />
  if (access === 'active') return <Navigate to="/app" replace />
  if (access === 'pending') return <Navigate to="/en-attente" replace />
  return <Outlet />
}

export function RequireAdmin() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/" replace />
  if (user.role !== 'professor') return <PortalMismatch expected="doctor" />
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
