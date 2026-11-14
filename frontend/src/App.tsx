import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import { lazy } from 'react'
import LoginPage from './pages/Login'
import { hasValidToken, setToken } from './lib/api'

// Cada sección se carga solo cuando la abres (bundle inicial más liviano)
const ProjectsPage = lazy(() => import('./pages/Projects'))
const TasksPage = lazy(() => import('./pages/Tasks'))
const CalendarPage = lazy(() => import('./pages/Calendar'))
const FinancePage = lazy(() => import('./pages/Finance'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

// El backend devuelve el token en el fragmento: /login#token=...
const hash = new URLSearchParams(window.location.hash.slice(1))
const hashToken = hash.get('token')
if (hashToken) {
  setToken(hashToken)
  window.history.replaceState({}, '', window.location.pathname)
}

function Protected({ children }: { children: React.ReactNode }) {
  return hasValidToken() ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Protected><Layout /></Protected>}>
            <Route index element={<Navigate to="/projects" replace />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="finance" element={<FinancePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
