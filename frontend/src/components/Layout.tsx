import { Suspense } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Network, Calendar, Wallet, LogOut, SquareKanban } from 'lucide-react'
import { logout } from '../lib/api'
import PlexusBackground from './PlexusBackground'

const navItems = [
  { to: '/projects', icon: Network, label: 'Proyectos' },
  { to: '/tasks', icon: SquareKanban, label: 'Tareas' },
  { to: '/calendar', icon: Calendar, label: 'Calendario' },
  { to: '/finance', icon: Wallet, label: 'Finanzas' },
]

function Loader() {
  return (
    <div className="h-full flex items-center justify-center">
      <span className="w-10 h-10 rounded-full border border-indigo-500/20 border-t-indigo-400 animate-spin" />
    </div>
  )
}

/** Etiqueta flotante que aparece a la derecha del ícono al pasar el mouse */
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full glass px-3 py-1 text-xs text-gray-100 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 z-50">
      {children}
    </span>
  )
}

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen text-gray-100 overflow-hidden">
      <PlexusBackground intensity={0.55} />

      {/* Riel lateral minimalista (desktop) */}
      <aside className="hidden md:flex flex-col items-center w-[68px] my-4 ml-4 py-4 rounded-[28px] glass-soft">
        <NavLink to="/projects" className="group relative mb-8" aria-label="Atlas">
          <img src="/logo.svg" alt="" className="w-9 h-9 transition-transform duration-500 group-hover:rotate-[8deg]" />
          <Tip>Atlas</Tip>
        </NavLink>

        <nav className="flex-1 flex flex-col items-center gap-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              className={({ isActive }) =>
                `group relative w-11 h-11 flex items-center justify-center rounded-2xl transition-all duration-300 ${
                  isActive ? 'bg-white/[0.08] text-indigo-400' : 'text-gray-500 hover:text-gray-100 hover:bg-white/[0.04]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute -left-[13px] w-[3px] rounded-full bg-indigo-400 transition-all duration-300 ${
                      isActive ? 'h-5 opacity-100 shadow-[0_0_12px_#98ffe8]' : 'h-0 opacity-0'
                    }`}
                  />
                  <Icon size={19} strokeWidth={1.5} />
                  <Tip>{label}</Tip>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => logout()}
          aria-label="Cerrar sesión"
          className="group relative w-11 h-11 flex items-center justify-center rounded-2xl text-gray-600 hover:text-gray-200 hover:bg-white/[0.04] transition-colors"
        >
          <LogOut size={18} strokeWidth={1.5} />
          <Tip>Cerrar sesión</Tip>
        </button>
      </aside>

      {/* Contenido: cada sección entra con una transición tipo "cambio de escena" */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
        <div key={location.pathname} className="animate-scene-in h-full">
          <Suspense fallback={<Loader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Barra inferior flotante (móvil) */}
      <nav className="md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-40 glass rounded-full flex items-center gap-1 p-1.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            className={({ isActive }) =>
              `flex items-center gap-2 h-11 rounded-full transition-all duration-300 ${
                isActive ? 'bg-white/[0.09] text-indigo-400 px-4' : 'text-gray-500 w-11 justify-center'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={19} strokeWidth={1.5} />
                {isActive && <span className="text-xs text-gray-100">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
