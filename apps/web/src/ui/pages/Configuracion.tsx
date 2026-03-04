import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  obtenerBusiness,
  actualizarBusiness,
  type BusinessRow,
} from '../../db/queries/configuracion.queries'
import { getBackend } from '../../db/database'

const BUSINESS_ID = 'local'

function badgeBackend(backend: string) {
  if (backend === 'idb') return { label: 'IndexedDB', cls: 'bg-emerald-900 text-emerald-300' }
  if (backend === 'opfs') return { label: 'OPFS', cls: 'bg-blue-900 text-blue-300' }
  return { label: 'Memoria (sin persistencia)', cls: 'bg-red-900 text-red-300' }
}

export default function Configuracion() {
  const navigate = useNavigate()

  const [negocio, setNegocio] = useState<BusinessRow | null>(null)
  const [nombre, setNombre] = useState('')
  const [ruc, setRuc] = useState('')
  const [mercado, setMercado] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [cargando, setCargando] = useState(true)
  const backend = getBackend()
  const badge = badgeBackend(backend)

  useEffect(() => {
    obtenerBusiness(BUSINESS_ID).then(b => {
      if (b) {
        setNegocio(b)
        setNombre(b.nombre)
        setRuc(b.ruc ?? '')
        setMercado(b.mercado ?? '')
      }
      setCargando(false)
    })
  }, [])

  const handleGuardar = async () => {
    if (!nombre.trim()) return
    setGuardando(true)
    try {
      await actualizarBusiness(BUSINESS_ID, {
        nombre: nombre.trim(),
        ruc: ruc.trim() || null,
        mercado: mercado.trim() || null,
      })
      setGuardadoOk(true)
      setTimeout(() => setGuardadoOk(false), 2000)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-950 text-slate-400 text-lg">
        Cargando...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      <div className="px-4 pt-4 pb-6 flex flex-col gap-6">

        {/* ── Título ── */}
        <h1 className="text-xl font-bold">Configuración</h1>

        {/* ── Sección: Datos del negocio ── */}
        <section className="flex flex-col gap-4">
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Datos del negocio
          </h2>

          <div className="flex flex-col gap-1">
            <label className="text-slate-400 text-sm">Nombre del negocio *</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Mi Negocio"
              className="h-12 px-4 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 text-base focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-slate-400 text-sm">RUC (opcional)</label>
            <input
              type="text"
              value={ruc}
              onChange={e => setRuc(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="20123456789"
              maxLength={11}
              className="h-12 px-4 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 text-base focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-slate-400 text-sm">Mercado / Ubicación (opcional)</label>
            <input
              type="text"
              value={mercado}
              onChange={e => setMercado(e.target.value)}
              placeholder="Ej: Mercado Santa Anita, Stand B-24"
              className="h-12 px-4 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 text-base focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            onClick={handleGuardar}
            disabled={guardando || !nombre.trim()}
            className={`w-full h-12 rounded-xl font-bold text-base transition-colors ${
              guardadoOk
                ? 'bg-emerald-700 text-emerald-200'
                : 'bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white'
            }`}
          >
            {guardando ? 'Guardando...' : guardadoOk ? '✓ Guardado' : 'Guardar cambios'}
          </button>
        </section>

        {/* ── Sección: Gestión ── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Gestión
          </h2>

          {[
            { label: 'Productos', emoji: '📋', to: '/productos' },
            { label: 'Clientes', emoji: '👥', to: '/clientes' },
            { label: 'Proveedores', emoji: '🚚', to: '/proveedores' },
          ].map(({ label, emoji, to }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="w-full h-16 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-lg font-semibold flex items-center justify-between px-5 active:bg-slate-700"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">{emoji}</span>
                <span>{label}</span>
              </div>
              <span className="text-slate-500 text-xl">›</span>
            </button>
          ))}
        </section>

        {/* ── Sección: Sistema ── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Sistema
          </h2>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Almacenamiento</span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.cls}`}>
                {badge.label}
              </span>
            </div>

            {backend === 'memoria' && (
              <p className="text-red-400 text-xs leading-snug">
                ⚠ Los datos NO persisten. Para persistencia, accede desde HTTPS o localhost.
              </p>
            )}

            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Plan</span>
              <span className="text-slate-300 text-sm font-semibold">
                {negocio?.plan ?? 'FREE'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Versión</span>
              <span className="text-slate-500 text-sm">v1.0.0</span>
            </div>
          </div>
        </section>

        {/* ── Sección: Sincronización ── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Sincronización Cloud
          </h2>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-slate-400 text-sm">
              La sincronización con la nube está disponible cuando el servidor API esté configurado
              (variable <code className="text-emerald-400 text-xs">VITE_API_URL</code>).
            </p>
            <p className="text-slate-600 text-xs">
              Actualmente en modo local. Todos los datos se guardan en este dispositivo.
            </p>
          </div>
        </section>

      </div>
    </div>
  )
}
