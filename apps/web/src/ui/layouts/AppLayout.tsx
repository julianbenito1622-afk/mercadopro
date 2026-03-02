import { Outlet, NavLink } from 'react-router-dom'

const tabs = [
  { to: '/venta',      emoji: '🛒', label: 'Venta'    },
  { to: '/inventario', emoji: '📦', label: 'Stock'    },
  { to: '/cobrar',     emoji: '👥', label: 'Cobrar'   },
  { to: '/cierre',     emoji: '📊', label: 'Cierre'   },
  { to: '/config',     emoji: '⚙️', label: 'Config'   },
]

export default function AppLayout() {
  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* Barra superior */}
      <header className="h-14 bg-slate-900 flex items-center justify-between px-4 shrink-0">
        <span className="text-emerald-400 font-bold text-lg">⚡ MercadoPro</span>
        <span className="text-slate-100 font-bold text-base">S/ 0.00</span>
      </header>

      {/* Contenido central */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Barra inferior */}
      <nav className="h-16 bg-slate-900 flex items-center justify-around shrink-0">
        {tabs.map(({ to, emoji, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[48px] min-h-[48px] gap-0.5 text-xs ${
                isActive ? 'text-emerald-400' : 'text-slate-500'
              }`
            }
          >
            <span className="text-xl leading-none">{emoji}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
