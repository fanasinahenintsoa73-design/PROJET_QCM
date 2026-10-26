import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import { ToastProvider } from '@/components/ui/Toast'
import {
  PublicLayout,
  StudentLayout,
  StatusLayout,
  RequireGuest,
  RequireStudent,
  RequirePending,
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
import DashboardPage from '@/pages/DashboardPage'
import QuizPage from '@/pages/QuizPage'
import ResultPage from '@/pages/ResultPage'
import HistoryPage from '@/pages/HistoryPage'
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage'
import AdminRequestsPage from '@/pages/admin/AdminRequestsPage'
import AdminStudentsPage from '@/pages/admin/AdminStudentsPage'
import NotFoundPage from '@/pages/NotFoundPage'

// xlsx is heavy: only load the publication module when a professor needs it.
const AdminSubjectPage = lazy(() => import('@/pages/admin/AdminSubjectPage'))

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="text-center">
        <span className="mx-auto grid h-10 w-10 place-items-center bg-ink text-xl font-light text-white">
          +
        </span>
        <p className="eyebrow mt-6">MEDQCM L1</p>
        <p className="mt-2 font-display text-3xl uppercase tracking-[0.02em]">Chargement du programme…</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ScrollToTop />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/etudiant" element={<PublicLayout />}>
                <Route index element={<LandingPage />} />
              </Route>
              <Route
                path="/etudiant/inscription"
                element={
                  <RequireGuest>
                    <SignupPage />
                  </RequireGuest>
                }
              />
              <Route
                path="/etudiant/connexion"
                element={
                  <RequireGuest>
                    <StudentLoginPage />
                  </RequireGuest>
                }
              />
              <Route
                path="/connexion"
                element={
                  <RequireGuest>
                    <LoginPage />
                  </RequireGuest>
                }
              />
              <Route path="/" element={<Navigate to="/etudiant" replace />} />

              <Route element={<RequireStudent />}>
                <Route element={<StudentLayout />}>
                  <Route path="/app" element={<DashboardPage />} />
                  <Route path="/app/entrainement" element={<QuizPage />} />
                  <Route path="/app/resultat/:attemptId" element={<ResultPage />} />
                  <Route path="/app/historique" element={<HistoryPage />} />
                </Route>
              </Route>

              <Route element={<StatusLayout />}>
                <Route element={<RequirePending />}>
                  <Route path="/en-attente" element={<PendingPage />} />
                </Route>
                <Route element={<RequireBlocked />}>
                  <Route path="/expiration" element={<ExpirationPage />} />
                  <Route path="/reinscription" element={<RenewalPage />} />
                </Route>
              </Route>

              <Route element={<RequireAdmin />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<AdminDashboardPage />} />
                  <Route path="/admin/demandes" element={<AdminRequestsPage />} />
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
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
