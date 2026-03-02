import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { obtenerClientes, type ClienteRow } from '../../db/queries/clientes.queries'
import { formatearDeuda } from '../../core/creditos/creditoUtils'
import ScoreBar from '../components/ScoreBar'

export default function Clientes() {
  const navigate = useNavigate()
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      const lista = await obtenerClientes('local')
      setClientes(lista)
    }
    cargar().finally(() => setCargando(false))
  }, [])

  const clientesFiltrados = clientes.filter(c =>
    busqueda === '' ||
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.celular ?? '').includes(busqueda)
  )

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Buscador */}
      <div className="px-4 pt-4 pb-3">
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full h-12 px-4 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 text-base focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {cargando ? (
          <p className="text-center text-slate-500 pt-16">Cargando...</p>
        ) : clientesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 gap-4">
            <p className="text-slate-500 text-lg">No hay clientes registrados</p>
            <button
              onClick={() => navigate('/clientes/nuevo')}
              className="px-6 h-12 bg-emerald-600 text-white rounded-lg font-semibold"
            >
              Registrar primer cliente
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {clientesFiltrados.map(c => (
              <button
                key={c.id}
                onClick={() => navigate(`/clientes/editar/${c.id}`)}
                className="w-full text-left bg-slate-900 border border-slate-800 rounded-xl p-4 min-h-[80px] flex flex-col gap-2"
              >
                {/* Fila 1: nombre + deuda */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-100 text-lg font-semibold leading-tight">
                    {c.nombre}
                  </span>
                  {c.saldo_actual > 0 ? (
                    <span className="text-red-400 text-base font-bold shrink-0">
                      {formatearDeuda(c.saldo_actual)}
                    </span>
                  ) : (
                    <span className="text-emerald-400 text-sm font-medium shrink-0">
                      Sin deuda
                    </span>
                  )}
                </div>

                {/* Fila 2: celular + estado */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 text-sm">
                    {c.celular ?? 'Sin celular'}
                  </span>
                  {c.estado_credito === 'BLOQUEADO' && (
                    <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full font-medium">
                      BLOQUEADO
                    </span>
                  )}
                </div>

                {/* Score bar */}
                <ScoreBar score={c.score} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Botón flotante + Nuevo */}
      <button
        onClick={() => navigate('/clientes/nuevo')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-emerald-500 text-white rounded-full text-2xl font-bold shadow-lg flex items-center justify-center"
        aria-label="Nuevo cliente"
      >
        +
      </button>
    </div>
  )
}
