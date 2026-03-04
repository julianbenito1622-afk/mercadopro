import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  obtenerProveedores,
  type ProveedorRow,
} from '../../db/queries/inventario.queries'

const BUSINESS_ID = 'local'

function badgeTipo(tipo: string) {
  if (tipo === 'CONSIGNACION') return 'bg-amber-900 text-amber-300'
  return 'bg-emerald-900 text-emerald-300'
}

export default function Proveedores() {
  const navigate = useNavigate()
  const [proveedores, setProveedores] = useState<ProveedorRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    obtenerProveedores(BUSINESS_ID)
      .then(setProveedores)
      .finally(() => setCargando(false))
  }, [])

  const filtrados = proveedores.filter(p =>
    busqueda === '' ||
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.zona_origen ?? '').toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800 shrink-0">
        <button
          onClick={() => navigate('/config')}
          className="w-10 h-10 flex items-center justify-center text-slate-400 text-xl"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">Proveedores</h1>
      </div>

      {/* Buscador */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar proveedor..."
          className="w-full h-12 px-4 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 text-base focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {cargando ? (
          <p className="text-center text-slate-500 pt-16">Cargando...</p>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 gap-4">
            <p className="text-slate-500 text-lg">No hay proveedores registrados</p>
            <button
              onClick={() => navigate('/proveedores/nuevo')}
              className="px-6 h-12 bg-emerald-600 text-white rounded-lg font-semibold"
            >
              Registrar primer proveedor
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtrados.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/proveedores/editar/${p.id}`)}
                className="w-full text-left bg-slate-900 border border-slate-800 rounded-xl p-4 min-h-[72px] flex flex-col gap-2 active:bg-slate-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-100 text-lg font-semibold leading-tight">
                    {p.nombre}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeTipo(p.tipo)}`}>
                    {p.tipo === 'CONSIGNACION' ? 'Consignación' : 'Directo'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {p.celular && (
                    <span className="text-slate-500 text-sm">{p.celular}</span>
                  )}
                  {p.zona_origen && (
                    <span className="text-slate-500 text-sm">📍 {p.zona_origen}</span>
                  )}
                  {p.tipo === 'CONSIGNACION' && p.comision_consignacion != null && (
                    <span className="text-amber-400 text-sm font-medium">
                      {p.comision_consignacion}% comisión
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Botón flotante + Nuevo */}
      <button
        onClick={() => navigate('/proveedores/nuevo')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-emerald-500 text-white rounded-full text-2xl font-bold shadow-lg flex items-center justify-center"
        aria-label="Nuevo proveedor"
      >
        +
      </button>
    </div>
  )
}
