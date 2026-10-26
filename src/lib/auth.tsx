import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import type { Database, User } from '@/types'
import {
  clearSession,
  getDB,
  getSessionUserId,
  login as dbLogin,
  logout as dbLogout,
  subscribe,
} from '@/lib/db'
import { getLatestRequest, getPendingRequest, getStudentAccess, studentHomePath } from '@/lib/access'

interface AuthContextValue {
  db: Database
  user: User | null
  loading: false
  login: (email: string, password: string) => { ok: true } | { ok: false; error: string }
  logout: () => void
  pendingRequest?: ReturnType<typeof getPendingRequest>
  latestRequest?: ReturnType<typeof getLatestRequest>
  access: ReturnType<typeof getStudentAccess> | null
  homePath: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useSyncExternalStore(subscribe, getDB, getDB)
  const sessionId = useSyncExternalStore(subscribe, getSessionUserId, () => null)
  const navigate = useNavigate()
  const [clock, setClock] = useState(0)

  // Re-evaluate time-based access regularly, and as soon as the tab wakes up.
  useEffect(() => {
    const tick = () => setClock((value) => value + 1)
    const interval = window.setInterval(tick, 30_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const user = useMemo(
    () => db.users.find((candidate) => candidate.id === sessionId) ?? null,
    [db.users, sessionId],
  )

  const pendingRequest = useMemo(
    () => (user?.role === 'student' ? getPendingRequest(user.id, db) : undefined),
    [db, user],
  )
  const latestRequest = useMemo(
    () => (user?.role === 'student' ? getLatestRequest(user.id, db) : undefined),
    [db, user],
  )
  const access = useMemo(
    () => (user?.role === 'student' ? getStudentAccess(user, db) : null),
    // clock intentionally invalidates this memo as time passes
    [db, user, clock],
  )
  const homePath = useMemo(() => {
    if (!user) return '/connexion'
    if (user.role === 'professor') return '/admin'
    return studentHomePath(user, db)
  }, [db, user, clock])

  const login = useCallback((email: string, password: string) => {
    const result = dbLogin(email, password)
    if (!result.ok) return { ok: false as const, error: result.error }
    return { ok: true as const }
  }, [])

  const logout = useCallback(() => {
    const target = user?.role === 'professor' ? '/connexion' : '/etudiant/connexion'
    dbLogout()
    navigate(target)
  }, [navigate, user?.role])

  const value = useMemo<AuthContextValue>(
    () => ({ db, user, loading: false, login, logout, pendingRequest, latestRequest, access, homePath }),
    [db, user, login, logout, pendingRequest, latestRequest, access, homePath],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export { clearSession }
