import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { isDoctorPortal } from '@/lib/portal'
import { MinimalHeader } from '@/components/Headers'
import { Footer } from '@/components/Footer'
import { PublicHeader, StudentHeader } from '@/components/Headers'
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
  return (
    <>
      <StudentHeader />
      <main className="min-h-[calc(100vh-100px)]">
        <Outlet />
      </main>
    </>
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
  const { logout } = useAuth()
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
            void logout()
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
  if (access === 'choosing') return <Navigate to="/choix-sujet" replace />
  if (access === 'pending') return <Navigate to="/en-attente" replace />
  if (access === 'expired' || access === 'rejected') return <Navigate to="/expiration" replace />
  return <Outlet />
}

export function RequireBlocked() {
  const { user, access } = useAuth()
  if (!user) return <Navigate to="/connexion" replace />
  if (user.role !== 'student') return <PortalMismatch expected="student" />
  if (access === 'choosing') return <Navigate to="/choix-sujet" replace />
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
