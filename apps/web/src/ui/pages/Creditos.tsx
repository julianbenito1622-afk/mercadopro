import { useEffect, useState } from 'react'
import {
  obtenerCartera,
  obtenerDetalleDeuda,
  obtenerResumenCartera,
  registrarPago,
  type ClienteCarteraRow,
  type VentaDeudaRow,
  type ResumenCartera,
} from '../../db/queries/cobranzas.queries'
import { formatearDeuda } from '../../core/creditos/creditoUtils'
import {
  calcularDiasVencido,
  clasificarDeuda,
  formatearDiasVencido,
} from '../../core/creditos/cobranzaUtils'
import ScoreBar from '../components/ScoreBar'
import MoneyDisplay from '../components/MoneyDisplay'

const BUSINESS_ID = 'local'
type Pantalla = 'lista' | 'detalle' | 'pago'
type MetodoPago = 'EFECTIVO' | 'YAPE' | 'TRANSFERENCIA'

function colorDias(diasVencido: number): string {
  const c = clasificarDeuda(diasVencido)
  if (c === 'AL_DIA') return 'text-emerald-400'
  if (c === 'POR_VENCER') return 'text-yellow-400'
  if (c === 'VENCIDO') return 'text-red-400'
  return 'text-red-500 font-bold'
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

export default function Creditos() {
  const [cartera, setCartera] = useState<ClienteCarteraRow[]>([])
  const [resumen, setResumen] = useState<ResumenCartera | null>(null)
  const [cargando, setCargando] = useState(true)

  const [pantalla, setPantalla] = useState<Pantalla>('lista')
  const [clienteSel, setClienteSel] = useState<ClienteCarteraRow | null>(null)
  const [deudaDetalle, setDeudaDetalle] = useState<VentaDeudaRow[]>([])

  const [montoPago, setMontoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('EFECTIVO')
  const [enviando, setEnviando] = useState(false)
  const [pagoOk, setPagoOk] = useState(false)
  const [errPago, setErrPago] = useState<string | null>(null)

  async function cargarDatos() {
    setCargando(true)
    const datos = await obtenerCartera(BUSINESS_ID)
    const res = await obtenerResumenCartera(BUSINESS_ID)
    setCartera(datos)
    setResumen(res)
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  async function abrirDetalle(cliente: ClienteCarteraRow) {
    setClienteSel(cliente)
    const detalle = await obtenerDetalleDeuda(cliente.id)
    setDeudaDetalle(detalle)
    setPantalla('detalle')
  }

  function abrirFormaPago() {
    setMontoPago('')
    setMetodoPago('EFECTIVO')
    setPagoOk(false)
    setErrPago(null)
    setPantalla('pago')
  }

  async function confirmarPago() {
    if (!clienteSel) return
    const monto = parseFloat(montoPago.replace(',', '.'))
    if (isNaN(monto) || monto <= 0) {
      setErrPago('Ingresa un monto válido')
      return
    }
    setErrPago(null)
    setEnviando(true)
    try {
      await registrarPago({ clientId: clienteSel.id, monto, metodo: metodoPago })
      setPagoOk(true)
      await cargarDatos()
      setTimeout(() => cerrarPanel(), 1000)
    } catch (e) {
      setErrPago(e instanceof Error ? e.message : 'Error al registrar pago')
    } finally {
      setEnviando(false)
    }
  }

  function cerrarPanel() {
    setPantalla('lista')
    setClienteSel(null)
    setPagoOk(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">

      {/* Resumen 2x2 */}
      {resumen && (
        <div className="grid grid-cols-2 gap-3 px-4 pt-4 pb-3 shrink-0">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
            <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">Por cobrar</span>
            <MoneyDisplay monto={resumen.total_por_cobrar} className="text-emerald-400 text-2xl font-bold leading-none" />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
            <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">Vencido</span>
            <MoneyDisplay
              monto={resumen.total_vencido}
              className={`text-2xl font-bold leading-none ${resumen.total_vencido > 0 ? 'text-red-400' : 'text-slate-400'}`}
            />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
            <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">Deudores</span>
            <span className="text-slate-100 text-2xl font-bold leading-none">
              {resumen.cantidad_clientes}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
            <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">Mayor deuda</span>
            {resumen.cliente_mayor_nombre ? (
              <>
                <span className="text-slate-100 text-sm font-semibold leading-tight truncate">
                  {resumen.cliente_mayor_nombre}
                </span>
                <MoneyDisplay monto={resumen.cliente_mayor_monto} className="text-red-400 text-lg font-bold leading-none" />
              </>
            ) : (
              <span className="text-slate-500 text-sm">—</span>
            )}
          </div>
        </div>
      )}

      {/* Lista de deudores */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {cargando ? (
          <p className="text-center text-slate-500 pt-16 text-lg">Cargando...</p>
        ) : cartera.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 gap-3">
            <span className="text-5xl">🎉</span>
            <p className="text-emerald-400 text-xl font-semibold">No hay deudas pendientes</p>
            <p className="text-slate-500 text-sm">Todos tus clientes están al día</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {cartera.map(c => {
              const diasVencido = c.fecha_venta_mas_antigua
                ? calcularDiasVencido(c.fecha_venta_mas_antigua, c.plazo_dias)
                : 0
              return (
                <button
                  key={c.id}
                  onClick={() => abrirDetalle(c)}
                  className="w-full text-left bg-slate-900 border border-slate-800 rounded-xl p-4 min-h-[80px] flex flex-col gap-2 active:bg-slate-800"
                >
                  {/* Fila 1: nombre + deuda */}
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-slate-100 text-lg font-semibold leading-tight">
                      {c.nombre}
                    </span>
                    <span className="text-red-400 text-xl font-bold shrink-0">
                      {formatearDeuda(c.saldo_actual)}
                    </span>
                  </div>

                  {/* Fila 2: celular + días vencido */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 text-sm">
                      {c.celular ?? 'Sin celular'}
                    </span>
                    <span className={`text-sm font-medium shrink-0 ${colorDias(diasVencido)}`}>
                      {formatearDiasVencido(diasVencido)}
                    </span>
                  </div>

                  {/* Score bar */}
                  <ScoreBar score={c.score} />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Panel Detalle / Pago ─────────────────────────────────────────────── */}
      {(pantalla === 'detalle' || pantalla === 'pago') && clienteSel && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-slate-800 shrink-0">
            <button
              onClick={pantalla === 'pago' ? () => setPantalla('detalle') : cerrarPanel}
              className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-slate-100 text-xl shrink-0"
            >
              ←
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-slate-100 text-lg font-bold leading-tight truncate">
                {clienteSel.nombre}
              </p>
              {clienteSel.celular && (
                <p className="text-slate-500 text-sm">{clienteSel.celular}</p>
              )}
            </div>
            <span className="text-red-400 text-xl font-bold shrink-0">
              {formatearDeuda(clienteSel.saldo_actual)}
            </span>
          </div>

          {/* ── Contenido detalle ── */}
          {pantalla === 'detalle' && (
            <div className="flex flex-col flex-1 overflow-y-auto px-4 py-4 gap-4">
              {/* Score bar */}
              <div className="flex items-center gap-3">
                <span className="text-slate-500 text-sm shrink-0">Score</span>
                <div className="flex-1">
                  <ScoreBar score={clienteSel.score} size="md" />
                </div>
                <span className="text-slate-400 text-sm font-medium shrink-0">{clienteSel.score}</span>
              </div>

              {/* Ventas pendientes */}
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wide font-medium mb-2">
                  Ventas pendientes
                </p>
                {deudaDetalle.length === 0 ? (
                  <p className="text-slate-500 text-sm">Sin ventas pendientes registradas</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {deudaDetalle.map(v => (
                      <div
                        key={v.id}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-100 text-sm font-medium">
                            {formatearFecha(v.fecha)}
                          </span>
                          <span className="text-slate-500 text-xs">
                            hace {v.dias_transcurridos} día{v.dias_transcurridos !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-100 text-sm font-medium">
                            {formatearDeuda(v.monto)}
                          </p>
                          {v.monto_pendiente < v.monto && (
                            <p className="text-yellow-400 text-xs">
                              Debe {formatearDeuda(v.monto_pendiente)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botón Registrar Pago */}
              <div className="mt-auto pt-2">
                <button
                  onClick={abrirFormaPago}
                  className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold rounded-xl flex items-center justify-center gap-2"
                >
                  💰 Registrar Pago
                </button>
              </div>
            </div>
          )}

          {/* ── Contenido pago ── */}
          {pantalla === 'pago' && (
            <div className="flex flex-col flex-1 overflow-y-auto px-4 py-4 gap-5">
              {pagoOk ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-4">
                  <span className="text-6xl">✓</span>
                  <p className="text-emerald-400 text-2xl font-bold">Pago registrado</p>
                  <p className="text-slate-400 text-base">
                    {formatearDeuda(parseFloat(montoPago))} · {metodoPago}
                  </p>
                </div>
              ) : (
                <>
                  {/* Input monto */}
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-500 text-sm font-medium">Monto a pagar</label>
                    <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-4 h-16 gap-2 focus-within:border-emerald-500">
                      <span className="text-slate-400 text-2xl font-bold">S/</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={montoPago}
                        onChange={e => setMontoPago(e.target.value)}
                        className="flex-1 bg-transparent text-slate-100 text-3xl font-bold focus:outline-none placeholder-slate-700"
                        autoFocus
                      />
                    </div>
                    {errPago && <p className="text-red-400 text-sm">{errPago}</p>}
                  </div>

                  {/* Métodos de pago */}
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-500 text-sm font-medium">Método</label>
                    <div className="flex gap-2">
                      {(['EFECTIVO', 'YAPE', 'TRANSFERENCIA'] as MetodoPago[]).map(m => (
                        <button
                          key={m}
                          onClick={() => setMetodoPago(m)}
                          className={`flex-1 h-12 rounded-xl font-semibold text-sm transition-colors ${
                            metodoPago === m
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          {m === 'EFECTIVO' ? 'Efectivo' : m === 'YAPE' ? 'Yape' : 'Transfer.'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pagar todo (acceso rápido) */}
                  <button
                    onClick={() => setMontoPago(clienteSel.saldo_actual.toFixed(2))}
                    className="w-full h-12 bg-slate-800 text-slate-300 text-sm rounded-xl hover:bg-slate-700"
                  >
                    Pagar todo: {formatearDeuda(clienteSel.saldo_actual)}
                  </button>

                  {/* Confirmar */}
                  <div className="mt-auto">
                    <button
                      onClick={confirmarPago}
                      disabled={enviando || !montoPago}
                      className="w-full h-14 bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xl font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      {enviando ? 'Registrando...' : 'Confirmar Pago'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
