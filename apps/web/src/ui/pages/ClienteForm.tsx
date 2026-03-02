import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  obtenerClientePorId,
  obtenerUltimosPagos,
  crearCliente,
  actualizarCliente,
  actualizarCreditProfile,
  obtenerDeudaCliente,
  type PagoRow,
} from '../../db/queries/clientes.queries'
import { formatearDeuda } from '../../core/creditos/creditoUtils'
import { esCelularValido, esDniValido } from '@mercadopro/shared'
import ScoreBar from '../components/ScoreBar'

const PLAZOS = [3, 5, 7, 15] as const
const ESTADOS_CREDITO = ['ACTIVO', 'BLOQUEADO'] as const

export default function ClienteForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const esEdicion = Boolean(id)

  // Campos cliente
  const [nombre, setNombre] = useState('')
  const [celular, setCelular] = useState('')
  const [dniRuc, setDniRuc] = useState('')
  const [direccion, setDireccion] = useState('')

  // Campos crédito
  const [limiteCredito, setLimiteCredito] = useState('500')
  const [plazoDias, setPlazoDias] = useState<number>(3)
  const [estadoCredito, setEstadoCredito] = useState<string>('ACTIVO')

  // Estado edición
  const [scoreActual, setScoreActual] = useState(50)
  const [deudaActual, setDeudaActual] = useState(0)
  const [pagos, setPagos] = useState<PagoRow[]>([])

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState<{ nombre?: string; celular?: string; dni?: string }>({})

  function validar(): boolean {
    const nuevosErrores: typeof errores = {}
    if (!nombre.trim()) {
      nuevosErrores.nombre = 'El nombre es obligatorio'
    }
    if (celular.trim() && !esCelularValido(celular.trim())) {
      nuevosErrores.celular = 'Celular inválido — debe ser 9 dígitos empezando con 9'
    }
    if (dniRuc.trim() && !esDniValido(dniRuc.trim())) {
      nuevosErrores.dni = 'DNI inválido — debe tener exactamente 8 dígitos'
    }
    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  useEffect(() => {
    const cargar = async () => {
      if (esEdicion && id) {
        const cliente = await obtenerClientePorId(id)
        if (cliente) {
          setNombre(cliente.nombre)
          setCelular(cliente.celular ?? '')
          setDniRuc(cliente.dni_ruc ?? '')
          setDireccion(cliente.direccion ?? '')
          setLimiteCredito(cliente.limite_credito.toString())
          setPlazoDias(cliente.plazo_dias)
          setEstadoCredito(cliente.estado_credito)
          setScoreActual(cliente.score)
        }
        const deuda = await obtenerDeudaCliente(id)
        setDeudaActual(deuda)
        const ultimosPagos = await obtenerUltimosPagos(id)
        setPagos(ultimosPagos)
      }
      setCargando(false)
    }
    cargar()
  }, [id, esEdicion])

  const handleGuardar = async () => {
    if (!validar()) return
    setGuardando(true)
    try {
      const limiteNum = parseFloat(limiteCredito) || 0
      if (esEdicion && id) {
        await actualizarCliente(id, {
          nombre: nombre.trim(),
          celular: celular.trim() || null,
          dni_ruc: dniRuc.trim() || null,
          direccion: direccion.trim() || null,
        })
        await actualizarCreditProfile(id, {
          limite_credito: limiteNum,
          plazo_dias: plazoDias,
          estado: estadoCredito,
        })
      } else {
        await crearCliente({
          business_id: 'local',
          nombre: nombre.trim(),
          nombre_corto: nombre.trim().split(' ')[0].toUpperCase().slice(0, 8),
          celular: celular.trim() || null,
          dni_ruc: dniRuc.trim() || null,
          direccion: direccion.trim() || null,
          limite_credito: limiteNum,
          plazo_dias: plazoDias,
        })
      }
      navigate('/clientes')
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
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
        <button
          onClick={() => navigate('/clientes')}
          className="w-10 h-10 flex items-center justify-center text-slate-400 text-xl"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">
          {esEdicion ? 'Editar Cliente' : 'Nuevo Cliente'}
        </h1>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-5">
        {/* Nombre */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-sm">Nombre *</label>
          <input
            type="text"
            value={nombre}
            onChange={e => { setNombre(e.target.value); setErrores(prev => ({ ...prev, nombre: undefined })) }}
            placeholder="Ej: María García"
            className={`h-12 px-4 bg-slate-800 border rounded-lg text-slate-100 placeholder-slate-500 text-base focus:outline-none ${errores.nombre ? 'border-red-500' : 'border-slate-600 focus:border-emerald-500'}`}
          />
          {errores.nombre && <p className="text-red-400 text-xs">{errores.nombre}</p>}
        </div>

        {/* Celular */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-sm">Celular (9 dígitos)</label>
          <input
            type="tel"
            value={celular}
            onChange={e => { setCelular(e.target.value.replace(/\D/g, '').slice(0, 9)); setErrores(prev => ({ ...prev, celular: undefined })) }}
            placeholder="987654321"
            maxLength={9}
            className={`h-12 px-4 bg-slate-800 border rounded-lg text-slate-100 placeholder-slate-500 text-base focus:outline-none ${errores.celular ? 'border-red-500' : 'border-slate-600 focus:border-emerald-500'}`}
          />
          {errores.celular && <p className="text-red-400 text-xs">{errores.celular}</p>}
        </div>

        {/* DNI */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-sm">DNI (opcional, 8 dígitos)</label>
          <input
            type="text"
            value={dniRuc}
            onChange={e => { setDniRuc(e.target.value.replace(/\D/g, '').slice(0, 8)); setErrores(prev => ({ ...prev, dni: undefined })) }}
            placeholder="12345678"
            maxLength={8}
            className={`h-12 px-4 bg-slate-800 border rounded-lg text-slate-100 placeholder-slate-500 text-base focus:outline-none ${errores.dni ? 'border-red-500' : 'border-slate-600 focus:border-emerald-500'}`}
          />
          {errores.dni && <p className="text-red-400 text-xs">{errores.dni}</p>}
        </div>

        {/* Dirección */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-sm">Dirección (opcional)</label>
          <textarea
            value={direccion}
            onChange={e => setDireccion(e.target.value)}
            placeholder="Ej: Stand B-24, Mercado Santa Anita"
            rows={2}
            className="px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 text-base focus:outline-none focus:border-emerald-500 resize-none"
          />
        </div>

        {/* ── Perfil de Crédito ── */}
        <div className="flex flex-col gap-4 border border-amber-500 rounded-xl p-4">
          <h2 className="text-amber-400 font-bold text-base">Perfil de Crédito</h2>

          {/* Límite */}
          <div className="flex flex-col gap-1">
            <label className="text-slate-400 text-sm">Límite de crédito</label>
            <div className="flex items-center h-12 bg-slate-800 border border-slate-600 rounded-lg overflow-hidden focus-within:border-amber-500">
              <span className="px-4 text-slate-400 font-semibold">S/</span>
              <input
                type="number"
                value={limiteCredito}
                onChange={e => setLimiteCredito(e.target.value)}
                placeholder="500"
                min="0"
                step="50"
                className="flex-1 h-full bg-transparent text-slate-100 text-xl font-bold placeholder-slate-600 focus:outline-none pr-4"
              />
            </div>
          </div>

          {/* Plazo */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-400 text-sm">Plazo habitual</label>
            <div className="flex gap-2">
              {PLAZOS.map(dias => (
                <button
                  key={dias}
                  onClick={() => setPlazoDias(dias)}
                  className={`flex-1 h-11 rounded-lg text-sm font-semibold ${
                    plazoDias === dias
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {dias}d
                </button>
              ))}
            </div>
          </div>

          {/* Estado */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-400 text-sm">Estado</label>
            <div className="flex gap-2">
              {ESTADOS_CREDITO.map(estado => (
                <button
                  key={estado}
                  onClick={() => setEstadoCredito(estado)}
                  className={`flex-1 h-11 rounded-lg text-sm font-semibold ${
                    estadoCredito === estado
                      ? estado === 'BLOQUEADO'
                        ? 'bg-red-700 text-white'
                        : 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {estado}
                </button>
              ))}
            </div>
          </div>

          {/* Resumen en modo edición */}
          {esEdicion && (
            <div className="flex flex-col gap-3 pt-2 border-t border-slate-700">
              {/* Deuda actual */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Deuda actual</span>
                <span className={`text-base font-bold ${deudaActual > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {deudaActual > 0 ? formatearDeuda(deudaActual) : 'Sin deuda'}
                </span>
              </div>

              {/* Score */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Score</span>
                  <span className="text-slate-300 text-sm font-semibold">{scoreActual}/100</span>
                </div>
                <ScoreBar score={scoreActual} size="md" />
              </div>

              {/* Historial pagos */}
              {pagos.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-slate-500 text-xs uppercase tracking-wider">
                    Últimos pagos
                  </p>
                  {pagos.map(p => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between py-2 border-b border-slate-800 text-sm"
                    >
                      <span className="text-slate-500">
                        {new Date(p.fecha).toLocaleDateString('es-PE')}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-xs">{p.metodo}</span>
                        <span className="text-emerald-400 font-semibold">
                          {formatearDeuda(p.monto)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

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
