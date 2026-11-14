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

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen text-gray-100 overflow-hidden">
      <PlexusBackground intensity={0.55} />

      {/* Sidebar - desktop */}
      <aside className="hidden md:flex flex-col w-60 m-3 mr-0 rounded-3xl glass-soft px-3 py-5">
        <div className="flex items-center gap-3 mb-10 px-2">
          <img src="/logo.svg" alt="" className="w-9 h-9" />
          <div className="leading-none">
            <p className="font-serif text-[26px] text-gray-100">FPCa</p>
            <p className="label-caps !text-[9px] mt-1">Control personal</p>
          </div>
        </div>

        <p className="label-caps px-3 mb-3 !text-[10px]">Menú</p>
        <nav className="flex-1 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm transition-all duration-300 ${
                  isActive
                    ? 'bg-white/[0.06] text-gray-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-white/[0.03]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute left-0 w-1 h-1 rounded-full bg-indigo-400 transition-all duration-300 ${
                      isActive ? 'opacity-100 shadow-[0_0_10px_#98ffe8]' : 'opacity-0'
                    }`}
                  />
                  <Icon size={17} strokeWidth={1.6} className={isActive ? 'text-indigo-400' : ''} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm text-gray-500 hover:bg-white/[0.03] hover:text-gray-200 transition-colors"
        >
          <LogOut size={17} strokeWidth={1.6} />
          Cerrar sesión
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

      {/* Bottom nav - mobile */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-40 glass rounded-full flex px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2.5 text-[10px] tracking-wide transition-colors ${
                isActive ? 'text-indigo-400' : 'text-gray-500'
              }`
            }
          >
            <Icon size={19} strokeWidth={1.6} />
            <span className="mt-1">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
