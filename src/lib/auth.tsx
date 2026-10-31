import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import type { Database, User } from '@/types'
import {
  getDB,
  getSessionUserId,
  logout as dbLogout,
  subscribe,
} from '@/lib/db'
import {
  getLatestRequest,
  getPendingRequest,
  getStudentAccess,
  studentHomePath,
} from '@/lib/access'
import { isDoctorPortal } from '@/lib/portal'
import { api } from '@/lib/api'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { emptyDatabase, fetchDatabase, fetchProfile } from '@/lib/supabaseData'

type LoginOutcome =
  | { ok: true; user: User; homePath: string }
  | { ok: false; error: string }

interface AuthContextValue {
  db: Database
  user: User | null
  loading: boolean
  login: (email: string, password: string, expectedRole?: User['role']) => Promise<LoginOutcome>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  pendingRequest?: ReturnType<typeof getPendingRequest>
  latestRequest?: ReturnType<typeof getLatestRequest>
  access: ReturnType<typeof getStudentAccess> | null
  homePath: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

function BootScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="text-center">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-md bg-accent text-xl font-light text-white">
          +
        </span>
        <p className="mt-5 flex items-baseline justify-center gap-1.5">
          <span className="font-display text-[22px] leading-none tracking-[-0.02em] text-ink">
            MEDQCM
          </span>
          <span className="text-[9px] font-semibold lowercase tracking-[0.14em] text-accent">
            mada
          </span>
        </p>
        <p className="mt-1 text-sm text-mute">Connexion sécurisée…</p>
      </div>
    </div>
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const demoDb = useSyncExternalStore(subscribe, getDB, getDB)
  const [demoSessionId, setDemoSessionId] = useState<string | null>(() => getSessionUserId())
  const [clock, setClock] = useState(0)
  const navigate = useNavigate()

  const [remoteDb, setRemoteDb] = useState<Database>(() => emptyDatabase())
  const [remoteUser, setRemoteUser] = useState<User | null>(null)
  const [initialising, setInitialising] = useState(isSupabaseConfigured)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session?.user) {
        if (!mounted.current) return
        setRemoteDb(emptyDatabase())
        setRemoteUser(null)
        return
      }
      const profile = await fetchProfile(data.session.user.id)
      const snapshot = await fetchDatabase(profile)
      if (!mounted.current) return
      setRemoteUser(profile)
      setRemoteDb(snapshot)
    } catch (error) {
      if (!mounted.current) return
      console.error('Chargement du compte impossible.', error)
      setRemoteDb(emptyDatabase())
      setRemoteUser(null)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Garde le portail de démonstration synchronisé avec la session locale.
  useEffect(() => {
    const sync = () => setDemoSessionId(getSessionUserId())
    return subscribe(sync)
  }, [])

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

  // Session Supabase : chargement initial, événements d'authentification et
  // rafraîchissement périodique (validation d'un dossier par le docteur).
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let active = true

    const load = async () => {
      await refresh()
      if (active) setInitialising(false)
    }

    void load()

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return
      if (event === 'SIGNED_OUT') {
        setRemoteDb(emptyDatabase())
        setRemoteUser(null)
        return
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Différé : Supabase interdit les appels Auth dans le callback.
        window.setTimeout(() => {
          if (active) void load()
        }, 0)
      }
    })

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 20_000)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)

    return () => {
      active = false
      data.subscription.unsubscribe()
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  const db = isSupabaseConfigured ? remoteDb : demoDb

  const demoUser = useMemo(() => {
    if (isSupabaseConfigured) return null
    return demoDb.users.find((candidate) => candidate.id === demoSessionId) ?? null
  }, [demoDb.users, demoSessionId])

  const user = useMemo(() => {
    if (!isSupabaseConfigured) return demoUser
    if (!remoteUser) return null
    return remoteDb.users.find((candidate) => candidate.id === remoteUser.id) ?? remoteUser
  }, [remoteDb.users, remoteUser])

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
    if (!user) return isDoctorPortal ? '/' : '/connexion'
    if (user.role === 'professor') return '/admin'
    return studentHomePath(user, db)
  }, [db, user, clock])

  const login = useCallback(
    async (
      email: string,
      password: string,
      expectedRole?: User['role'],
    ): Promise<LoginOutcome> => {
      try {
        const { user: account } = await api.login(email, password)
        if (expectedRole && account.role !== expectedRole) {
          await api.logout()
          if (isSupabaseConfigured) {
            setRemoteDb(emptyDatabase())
            setRemoteUser(null)
          } else {
            setDemoSessionId(null)
          }
          return {
            ok: false,
            error:
              expectedRole === 'professor'
                ? 'Cet espace est réservé au docteur.'
                : 'Utilisez l’espace docteur pour ce compte.',
          }
        }

        if (isSupabaseConfigured) {
          const snapshot = await fetchDatabase(account)
          if (!mounted.current) return { ok: false, error: 'Connexion interrompue.' }
          setRemoteUser(account)
          setRemoteDb(snapshot)
          const fresh = snapshot.users.find((candidate) => candidate.id === account.id) ?? account
          return {
            ok: true,
            user: fresh,
            homePath: fresh.role === 'professor' ? '/admin' : studentHomePath(fresh, snapshot),
          }
        }

        const snapshot = getDB()
        setDemoSessionId(account.id)
        const fresh =
          snapshot.users.find((candidate) => candidate.id === account.id) ?? account
        return {
          ok: true,
          user: fresh,
          homePath: fresh.role === 'professor' ? '/admin' : studentHomePath(fresh, snapshot),
        }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Connexion impossible.',
        }
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    const target = isDoctorPortal ? '/' : '/connexion'
    try {
      await api.logout()
    } finally {
      if (isSupabaseConfigured) {
        setRemoteDb(emptyDatabase())
        setRemoteUser(null)
      } else {
        setDemoSessionId(null)
      }
      navigate(target)
    }
  }, [navigate])

  const value = useMemo<AuthContextValue>(
    () => ({
      db,
      user,
      loading: initialising,
      login,
      logout,
      refresh,
      pendingRequest,
      latestRequest,
      access,
      homePath,
    }),
    [
      db,
      user,
      initialising,
      login,
      logout,
      refresh,
      pendingRequest,
      latestRequest,
      access,
      homePath,
    ],
  )

  if (initialising) return <BootScreen />

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
