import { useNavigate } from 'react-router-dom'

export default function Configuracion() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-950 h-full">
      <h1 className="text-xl font-bold text-slate-100">Configuración</h1>

      <button
        onClick={() => navigate('/productos')}
        className="w-full h-16 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-lg font-semibold flex items-center gap-4 px-5"
      >
        <span className="text-2xl">📋</span>
        Gestionar Productos
      </button>

      <button
        onClick={() => navigate('/clientes')}
        className="w-full h-16 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-lg font-semibold flex items-center gap-4 px-5"
      >
        <span className="text-2xl">👥</span>
        Gestionar Clientes
      </button>
    </div>
  )
}
