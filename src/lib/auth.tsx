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
import type { Database, TicketInfo, TicketType, User } from '@/types'
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
import { ticketLoginEmail } from '@/lib/tickets'
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
  ticketLogin: (code: string, secret: string) => Promise<LoginOutcome>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  pendingRequest?: ReturnType<typeof getPendingRequest>
  latestRequest?: ReturnType<typeof getLatestRequest>
  access: ReturnType<typeof getStudentAccess> | null
  /** Le ticket de l'étudiant connecté a été suspendu ou a expiré. */
  ticketBlocked: boolean
  /** Type du ticket étudiant (30 séries ou Anki). */
  ticketType: TicketType | null
  /** Date d'expiration du ticket Anki. */
  ticketExpiresAt: string | null
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
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null)
  const [ticketBlocked, setTicketBlocked] = useState(false)
  const [initialising, setInitialising] = useState(isSupabaseConfigured)
  const mounted = useRef(true)
  // Date du dernier rechargement complet : évite les rafales de rafraîchissements
  // au chargement (session + focus + premier tick).
  const lastFullRefreshAt = useRef(0)

  const refresh = useCallback(async (options?: { syncFeedbacks?: boolean }) => {
    if (!isSupabaseConfigured || !supabase) return
    lastFullRefreshAt.current = Date.now()
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session?.user) {
        if (!mounted.current) return
        setRemoteDb(emptyDatabase())
        setRemoteUser(null)
        setTicketInfo(null)
        setTicketBlocked(false)
        return
      }
      const profile = await fetchProfile(data.session.user.id)
      const snapshot = await fetchDatabase(profile)
      if (!mounted.current) return
      setRemoteUser(profile)
      setRemoteDb(snapshot)
      // Ticket suspendu côté docteur : la suspension est détectée ici
      // (rafraîchissement périodique), sans attendre une nouvelle connexion.
      if (profile.role === 'student') {
        const info = await api.myTicketInfo().catch(() => null)
        if (!mounted.current) return
        setTicketInfo(info)
        const expired =
          info?.type === 'anki' && info.expiresAt
            ? new Date(info.expiresAt).getTime() < Date.now()
            : false
        setTicketBlocked(info?.status === 'suspended' || expired)
      } else {
        setTicketInfo(null)
        setTicketBlocked(false)
      }
      // Dès la connexion, migration automatique des étoiles restées en local
      // vers le backend (tous les téléphones partagent ensuite les mêmes
      // notes). En arrière-plan, sans bloquer l'ouverture de l'app.
      if (options?.syncFeedbacks && profile.role !== 'professor') {
        void api.syncPendingSeriesFeedbacks()
      }
    } catch (error) {
      if (!mounted.current) return
      console.error('Chargement du compte impossible.', error)
      setRemoteDb(emptyDatabase())
      setRemoteUser(null)
    }
  }, [])

  // Rafraîchissement léger : uniquement l'état du ticket (suspension,
  // expiration). Inutile de recharger toute la base à chaque retour dans
  // l'app : c'était la source des rafraîchissements visibles.
  const refreshTicket = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session?.user) return
      const info = await api.myTicketInfo().catch(() => null)
      if (!mounted.current) return
      setTicketInfo(info)
      const expired =
        info?.type === 'anki' && info.expiresAt
          ? new Date(info.expiresAt).getTime() < Date.now()
          : false
      setTicketBlocked(info?.status === 'suspended' || expired)
    } catch {
      // L'état du ticket n'est pas critique : on garde la valeur actuelle.
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

  // Mode démonstration : type et expiration du ticket local.
  useEffect(() => {
    if (isSupabaseConfigured) return
    if (!demoSessionId) {
      setTicketInfo(null)
      setTicketBlocked(false)
      return
    }
    let active = true
    void api
      .myTicketInfo()
      .then((info) => {
        if (!active) return
        setTicketInfo(info)
        const expired =
          info?.type === 'anki' && info.expiresAt
            ? new Date(info.expiresAt).getTime() < Date.now()
            : false
        setTicketBlocked(info?.status === 'suspended' || expired)
      })
      .catch(() => {
        if (active) setTicketInfo(null)
      })
    return () => {
      active = false
    }
  }, [demoSessionId, demoDb, clock])

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
    let loading = false

    const load = async () => {
      // Un seul chargement à la fois : l'événement de session de Supabase
      // arrive juste après le chargement initial et le doublait.
      if (loading) return
      loading = true
      try {
        await refresh({ syncFeedbacks: true })
      } finally {
        loading = false
      }
      if (active) setInitialising(false)
    }

    void load()

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return
      if (event === 'SIGNED_OUT') {
        setRemoteDb(emptyDatabase())
        setRemoteUser(null)
        setTicketInfo(null)
        setTicketBlocked(false)
        return
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Différé : Supabase interdit les appels Auth dans le callback.
        window.setTimeout(() => {
          // L'événement de session arrive juste après le chargement initial :
          // on ne relance pas un second chargement complet de la base.
          if (Date.now() - lastFullRefreshAt.current < 3_000) return
          if (active) void load()
        }, 0)
      }
    })

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      // Rafraîchissement léger : uniquement l'état du ticket (suspension,
      // expiration). Recharger toute la base toutes les 20 s faisait
      // rafraîchir l'app en boucle.
      void refreshTicket()
    }, 20_000)
    // Rechargement complet de la base : une fois par minute, pour prendre en
    // compte une validation du docteur.
    const fullInterval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      // Pas de rafale : on ne recharge pas toute la base si un rechargement
      // vient d'avoir lieu.
      if (Date.now() - lastFullRefreshAt.current < 10_000) return
      void refresh()
    }, 60_000)
    // Au retour dans l'app : on vérifie seulement le ticket (suspension,
    // expiration), pas toute la base.
    const onFocus = () => void refreshTicket()
    window.addEventListener('focus', onFocus)

    return () => {
      active = false
      data.subscription.unsubscribe()
      window.clearInterval(interval)
      window.clearInterval(fullInterval)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh, refreshTicket])

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
    if (!user) return isDoctorPortal ? '/' : '/acces'
    if (user.role === 'professor') return '/admin'
    if (ticketInfo?.type === 'anki') return '/app/anki/choisir'
    return studentHomePath(user, db)
  }, [db, user, clock, ticketInfo])

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
    const target = isDoctorPortal ? '/' : '/acces'
    try {
      await api.logout()
    } finally {
      if (isSupabaseConfigured) {
        setRemoteDb(emptyDatabase())
        setRemoteUser(null)
      } else {
        setDemoSessionId(null)
      }
      setTicketBlocked(false)
      navigate(target)
    }
  }, [navigate])

  const ticketLogin = useCallback(
    async (code: string, secret: string): Promise<LoginOutcome> => {
      // Le numéro d'enregistrement est le mot de passe du compte du ticket.
      const result = await login(ticketLoginEmail(code), secret, 'student')
      if (!result.ok) return result
      const info = await api.myTicketInfo().catch(() => null)
      if (info?.status === 'suspended') {
        await logout()
        return { ok: false, error: 'Ce ticket est suspendu. Contactez le docteur.' }
      }
      const expired =
        info?.type === 'anki' && info.expiresAt
          ? new Date(info.expiresAt).getTime() < Date.now()
          : false
      if (expired) {
        await logout()
        return {
          ok: false,
          error: 'Ton ticket Anki a expiré. Contacte le docteur pour un nouveau ticket.',
        }
      }
      // L'historique côté admin : qui est entré, quand.
      await api.recordTicketLogin()
      // À la première connexion, le mois Anki est posé par la base :
      // on relit le ticket pour afficher la bonne date.
      const freshInfo = await api.myTicketInfo().catch(() => info)
      setTicketInfo(freshInfo)
      return {
        ...result,
        homePath: freshInfo?.type === 'anki' ? '/app/anki/choisir' : result.homePath,
      }
    },
    [login, logout],
  )

  const ticketType = ticketInfo?.type ?? null
  const ticketExpiresAt = ticketInfo?.expiresAt ?? null

  const value = useMemo<AuthContextValue>(
    () => ({
      db,
      user,
      loading: initialising,
      login,
      ticketLogin,
      logout,
      refresh,
      pendingRequest,
      latestRequest,
      access,
      ticketBlocked,
      ticketType,
      ticketExpiresAt,
      homePath,
    }),
    [
      db,
      user,
      initialising,
      login,
      ticketLogin,
      logout,
      refresh,
      pendingRequest,
      latestRequest,
      access,
      ticketBlocked,
      ticketType,
      ticketExpiresAt,
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
