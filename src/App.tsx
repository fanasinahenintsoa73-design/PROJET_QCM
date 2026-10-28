import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import { ToastProvider } from '@/components/ui/Toast'
import { isDoctorPortal } from '@/lib/portal'
import {
  PublicLayout,
  StudentLayout,
  StatusLayout,
  RequireGuest,
  RequireStudent,
  RequireStudentAccount,
  RequireBlocked,
  RequireAdmin,
  ScrollToTop,
} from '@/components/Layouts'
import { AdminLayout } from '@/components/AdminLayout'
import { LoginPage } from '@/pages/LoginPage'
import { StudentLoginPage } from '@/pages/StudentLoginPage'
import { LandingPage } from '@/pages/LandingPage'
import { SignupPage } from '@/pages/SignupPage'
import { PendingPage } from '@/pages/PendingPage'
import { ExpirationPage } from '@/pages/ExpirationPage'
import { RenewalPage } from '@/pages/RenewalPage'
import { SubjectChoicePage } from '@/pages/SubjectChoicePage'
import DashboardPage from '@/pages/DashboardPage'
import QuizPage from '@/pages/QuizPage'
import ResultPage from '@/pages/ResultPage'
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage'
import AdminStudentsPage from '@/pages/admin/AdminStudentsPage'
import NotFoundPage from '@/pages/NotFoundPage'

// xlsx is heavy: only load the publication module when a professor needs it.
const AdminSubjectPage = lazy(() => import('@/pages/admin/AdminSubjectPage'))

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="text-center">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-md bg-accent text-xl font-light text-white">
          +
        </span>
        <p className="mt-5 text-sm font-medium text-ink">MEDQCM L1</p>
        <p className="mt-1 text-sm text-mute">Chargement…</p>
      </div>
    </div>
  )
}

function DemandesRedirect() {
  const location = useLocation()
  return <Navigate to={`/admin${location.search}`} replace />
}

function StudentRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
      </Route>
      <Route
        path="/inscription"
        element={
          <RequireGuest>
            <SignupPage />
          </RequireGuest>
        }
      />
      <Route
        path="/connexion"
        element={
          <RequireGuest>
            <StudentLoginPage />
          </RequireGuest>
        }
      />
      <Route path="/etudiant" element={<Navigate to="/" replace />} />
      <Route path="/etudiant/inscription" element={<Navigate to="/inscription" replace />} />
      <Route path="/etudiant/connexion" element={<Navigate to="/connexion" replace />} />

      <Route element={<RequireStudentAccount />}>
        <Route path="/en-attente" element={<PendingPage />} />
      </Route>

      <Route element={<RequireStudent />}>
        <Route path="/app/historique" element={<Navigate to="/app" replace />} />
        <Route element={<StudentLayout />}>
          <Route path="/app" element={<DashboardPage />} />
          <Route path="/app/entrainement" element={<QuizPage />} />
          <Route path="/app/resultat/:attemptId" element={<ResultPage />} />
        </Route>
      </Route>

      <Route element={<StatusLayout />}>
        <Route element={<RequireBlocked />}>
          <Route path="/expiration" element={<ExpirationPage />} />
          <Route path="/reinscription" element={<RenewalPage />} />
        </Route>
        <Route element={<RequireStudentAccount />}>
          <Route path="/choix-sujet" element={<SubjectChoicePage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

function DoctorRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireGuest>
            <LoginPage />
          </RequireGuest>
        }
      />
      <Route path="/connexion" element={<Navigate to="/" replace />} />
      <Route element={<RequireAdmin />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/demandes" element={<DemandesRedirect />} />
          <Route
            path="/admin/sujet"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AdminSubjectPage />
              </Suspense>
            }
          />
          <Route path="/admin/etudiants" element={<AdminStudentsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ScrollToTop />
          <Suspense fallback={<RouteFallback />}>
            {isDoctorPortal ? <DoctorRoutes /> : <StudentRoutes />}
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
