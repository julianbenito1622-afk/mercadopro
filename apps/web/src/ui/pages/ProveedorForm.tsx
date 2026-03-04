import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  obtenerProveedorPorId,
  crearProveedor,
  actualizarProveedor,
} from '../../db/queries/inventario.queries'

const BUSINESS_ID = 'local'
const TIPOS = ['DIRECTO', 'CONSIGNACION'] as const
type Tipo = typeof TIPOS[number]

export default function ProveedorForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const esEdicion = Boolean(id)

  const [nombre, setNombre] = useState('')
  const [celular, setCelular] = useState('')
  const [tipo, setTipo] = useState<Tipo>('DIRECTO')
  const [zonaOrigen, setZonaOrigen] = useState('')
  const [comision, setComision] = useState('')

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errNombre, setErrNombre] = useState<string | null>(null)

  useEffect(() => {
    const cargar = async () => {
      if (esEdicion && id) {
        const prov = await obtenerProveedorPorId(id)
        if (prov) {
          setNombre(prov.nombre)
          setCelular(prov.celular ?? '')
          setTipo(prov.tipo as Tipo)
          setZonaOrigen(prov.zona_origen ?? '')
          setComision(prov.comision_consignacion != null ? prov.comision_consignacion.toString() : '')
        }
      }
      setCargando(false)
    }
    cargar()
  }, [id, esEdicion])

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      setErrNombre('El nombre es obligatorio')
      return
    }
    setGuardando(true)
    try {
      const data = {
        nombre: nombre.trim(),
        celular: celular.trim() || null,
        tipo,
        zona_origen: zonaOrigen.trim() || null,
        comision_consignacion: tipo === 'CONSIGNACION' && comision
          ? parseFloat(comision)
          : null,
      }
      if (esEdicion && id) {
        await actualizarProveedor(id, data)
      } else {
        await crearProveedor({ business_id: BUSINESS_ID, ...data })
      }
      navigate('/proveedores')
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
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800 shrink-0">
        <button
          onClick={() => navigate('/proveedores')}
          className="w-10 h-10 flex items-center justify-center text-slate-400 text-xl"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">
          {esEdicion ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        </h1>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-5">
        {/* Nombre */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-sm">Nombre *</label>
          <input
            type="text"
            value={nombre}
            onChange={e => { setNombre(e.target.value); setErrNombre(null) }}
            placeholder="Ej: Distribuidora Los Andes"
            className={`h-12 px-4 bg-slate-800 border rounded-lg text-slate-100 placeholder-slate-500 text-base focus:outline-none ${errNombre ? 'border-red-500' : 'border-slate-600 focus:border-emerald-500'}`}
          />
          {errNombre && <p className="text-red-400 text-xs">{errNombre}</p>}
        </div>

        {/* Celular */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-sm">Celular (opcional)</label>
          <input
            type="tel"
            value={celular}
            onChange={e => setCelular(e.target.value.replace(/\D/g, '').slice(0, 9))}
            placeholder="987654321"
            maxLength={9}
            className="h-12 px-4 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 text-base focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Tipo */}
        <div className="flex flex-col gap-2">
          <label className="text-slate-400 text-sm">Tipo de proveedor</label>
          <div className="flex gap-2">
            {TIPOS.map(t => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`flex-1 h-12 rounded-xl text-sm font-semibold ${
                  tipo === t
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {t === 'DIRECTO' ? 'Compra Directa' : 'Consignación'}
              </button>
            ))}
          </div>
        </div>

        {/* Zona de origen */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-sm">Zona de origen (opcional)</label>
          <input
            type="text"
            value={zonaOrigen}
            onChange={e => setZonaOrigen(e.target.value)}
            placeholder="Ej: La Merced, Junín"
            className="h-12 px-4 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 text-base focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Comisión (solo si CONSIGNACION) */}
        {tipo === 'CONSIGNACION' && (
          <div className="flex flex-col gap-1">
            <label className="text-slate-400 text-sm">Comisión (%)</label>
            <div className="flex items-center h-12 bg-slate-800 border border-slate-600 rounded-lg overflow-hidden focus-within:border-amber-500">
              <input
                type="number"
                value={comision}
                onChange={e => setComision(e.target.value)}
                placeholder="10"
                min="0"
                max="100"
                step="0.5"
                className="flex-1 h-full bg-transparent text-slate-100 text-lg font-bold placeholder-slate-600 focus:outline-none px-4"
              />
              <span className="px-4 text-slate-400 font-semibold">%</span>
            </div>
          </div>
        )}

        {/* Guardar */}
        <button
          onClick={handleGuardar}
          disabled={guardando}
          className="w-full h-16 bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-lg font-bold rounded-xl mt-2"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
