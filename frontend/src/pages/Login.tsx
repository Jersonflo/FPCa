import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL, hasValidToken } from '../lib/api'
import PlexusBackground from '../components/PlexusBackground'

const ERRORS: Record<string, string> = {
  forbidden: 'Esta cuenta de Google no tiene acceso a este dashboard.',
  session: 'Tu sesión expiró. Vuelve a entrar.',
  google_reauth: 'Google pidió volver a autorizar el acceso al calendario.',
  invalid_state: 'El inicio de sesión no se pudo validar. Intenta de nuevo.',
  auth_failed: 'No se pudo iniciar sesión con Google. Intenta de nuevo.',
}

// Titular revelado palabra por palabra; las palabras en "accent" van en lavanda
const HEADLINE: { w: string; accent?: boolean }[] = [
  { w: 'Todo' }, { w: 'lo' }, { w: 'que' }, { w: 'construyes,' },
  { w: 'conectado', accent: true }, { w: 'en', accent: true }, { w: 'una', accent: true }, { w: 'sola', accent: true }, { w: 'red.', accent: true },
]

export default function LoginPage() {
  const navigate = useNavigate()

  useEffect(() => {
    if (hasValidToken()) navigate('/projects', { replace: true })
  }, [navigate])

  const error = new URLSearchParams(window.location.hash.slice(1)).get('error')

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      <PlexusBackground intensity={1} anchor={0.74} />

      {/* Barra superior */}
      <header className="flex items-center justify-between px-6 md:px-16 pt-8 animate-[fade-in_1s_0.2s_both]">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="" className="w-9 h-9" />
          <span className="font-serif text-2xl text-gray-100">Atlas</span>
        </div>
        <span className="label-caps hidden sm:block">Tu mapa personal</span>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center px-6 md:px-16">
        <div className="max-w-2xl md:pl-[6vw]">
          <p className="label-caps mb-6 animate-[fade-in_1s_0.4s_both]">Proyectos · Tareas · Calendario · Finanzas</p>
          <h1 className="font-serif text-[clamp(2.6rem,6vw,5rem)] leading-[1.04] tracking-tight">
            {HEADLINE.map(({ w, accent }, i) => (
              <span
                key={i}
                className={`reveal-word mr-[0.25em] ${accent ? 'text-[#a9b4f5] italic' : 'text-gray-100'}`}
                style={{ animationDelay: `${0.5 + i * 0.09}s` }}
              >
                {w}
              </span>
            ))}
          </h1>
          <p className="text-gray-400 text-base md:text-lg mt-6 max-w-md font-light leading-relaxed animate-[rise_1s_1.3s_both]">
            Tu sistema para ver el panorama completo: qué estás construyendo, qué sigue y cómo va tu dinero.
          </p>

          {error && (
            <p className="mt-6 max-w-md text-sm text-[#ff9dbd] bg-[#e0457b]/10 border border-[#e0457b]/25 rounded-2xl px-4 py-2.5 animate-fade-in">
              {ERRORS[error] || 'Ocurrió un error al iniciar sesión.'}
            </p>
          )}

          <button
            onClick={() => (window.location.href = `${API_URL}/auth/google`)}
            className="mt-9 inline-flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 font-medium py-3.5 pl-4 pr-6 rounded-full transition-all duration-300 hover:-translate-y-0.5 animate-[rise_1s_1.5s_both]"
          >
            <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </span>
            Continuar con Google
          </button>
        </div>
      </main>

      {/* Pie con línea vertical (detalle editorial) */}
      <footer className="px-6 md:px-16 pb-8 md:pl-[calc(4rem+6vw)] animate-[fade-in_1s_1.8s_both]">
        <p className="label-caps !text-[10px] mb-3">Acceso privado</p>
        <span className="block w-px h-10 bg-gradient-to-b from-[#e0457b] to-transparent" />
      </footer>
    </div>
  )
}
