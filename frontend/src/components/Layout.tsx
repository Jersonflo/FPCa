import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Network, Calendar, Wallet, LogOut } from 'lucide-react'

const navItems = [
  { to: '/projects', icon: Network, label: 'Proyectos' },
  { to: '/calendar', icon: Calendar, label: 'Calendario' },
  { to: '/finance', icon: Wallet, label: 'Finanzas' },
]

export default function Layout() {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-gray-900 border-r border-gray-800 p-4">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-indigo-400">◈ Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1">Control personal</p>
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom nav - mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 text-xs transition-colors ${
                isActive ? 'text-indigo-400' : 'text-gray-500'
              }`
            }
          >
            <Icon size={20} />
            <span className="mt-1">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

