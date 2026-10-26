import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
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
  return (
    <>
      <StudentHeader />
      <main className="min-h-[calc(100vh-100px)]">
        <Outlet />
      </main>
      <StudentFooter />
    </>
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
              window.location.href = '/connexion'
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
  if (!user) return <Navigate to="/connexion" state={{ from: location.pathname }} replace />
  if (user.role === 'professor') return <Navigate to="/admin" replace />
  if (access === 'pending') return <Navigate to="/en-attente" replace />
  if (access === 'expired' || access === 'rejected') return <Navigate to="/expiration" replace />
  return <Outlet />
}

export function RequirePending() {
  const { user, access, homePath } = useAuth()
  if (!user) return <Navigate to="/connexion" replace />
  if (user.role !== 'student') return <Navigate to="/admin" replace />
  if (access !== 'pending') return <Navigate to={homePath} replace />
  return <Outlet />
}

export function RequireBlocked() {
  const { user, access, homePath } = useAuth()
  if (!user) return <Navigate to="/connexion" replace />
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
