import { useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useDiaStore } from '../../stores/diaStore'
import { useAuthStore } from '../../stores/authStore'

const tabs = [
  { to: '/venta',      emoji: '🛒', label: 'Venta'    },
  { to: '/inventario', emoji: '📦', label: 'Stock'    },
  { to: '/cobrar',     emoji: '👥', label: 'Cobrar'   },
  { to: '/cierre',     emoji: '📊', label: 'Cierre'   },
  { to: '/config',     emoji: '⚙️', label: 'Config'   },
]

export default function AppLayout() {
  const location = useLocation()
  const { totalHoy, recargarTotal } = useDiaStore()
  const { userNombre, cerrarSesion } = useAuthStore()

  // Recargar total al cambiar de ruta y al enfocar la ventana
  useEffect(() => { recargarTotal() }, [location.pathname, recargarTotal])
  useEffect(() => {
    window.addEventListener('focus', recargarTotal)
    return () => window.removeEventListener('focus', recargarTotal)
  }, [recargarTotal])

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* Barra superior */}
      <header className="h-14 bg-slate-900 flex items-center justify-between px-4 shrink-0">
        <div className="flex flex-col">
          <span className="text-emerald-400 font-bold text-base leading-tight">⚡ MercadoPro</span>
          {userNombre && (
            <button
              onClick={cerrarSesion}
              className="text-slate-600 text-[10px] leading-none text-left hover:text-slate-400 transition-colors"
            >
              {userNombre} · salir
            </button>
          )}
        </div>
        <div className="flex flex-col items-end">
          <span className="text-slate-500 text-[10px] uppercase tracking-wide leading-none">Hoy</span>
          <span className="text-slate-100 font-bold text-base leading-tight">
            S/ {totalHoy.toFixed(2)}
          </span>
        </div>
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
