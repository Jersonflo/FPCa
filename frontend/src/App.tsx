import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import ProjectsPage from './pages/Projects'
import CalendarPage from './pages/Calendar'
import FinancePage from './pages/Finance'
import LoginPage from './pages/Login'

const queryClient = new QueryClient()

function App() {
  // Captura el token si Google redirigió aquí con ?token=...
  const params = new URLSearchParams(window.location.search)
  const urlToken = params.get('token')
  if (urlToken) {
    localStorage.setItem('auth_token', urlToken)
    // Limpia la URL sin recargar
    window.history.replaceState({}, '', window.location.pathname)
  }

  const token = localStorage.getItem('auth_token')

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={token ? <Layout /> : <Navigate to="/login" replace />}
          >
            <Route index element={<Navigate to="/projects" replace />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="finance" element={<FinancePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
