import { useEffect, useState } from 'react'
import {
  obtenerResumenVentasDia,
  obtenerProductosMasVendidos,
  obtenerVentasDelDia,
  obtenerCreditosOtorgadosHoy,
  obtenerCobrosRecibidosHoy,
  type ResumenVentasDia,
  type ProductoVendidoRow,
  type VentaCierreRow,
  type CreditosHoyRow,
  type CobrosHoyRow,
} from '../../db/queries/cierre.queries'
import { formatearDeuda } from '../../core/creditos/creditoUtils'

const BUSINESS_ID = 'local'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic']

function fechaTextoHoy(): string {
  const d = new Date()
  return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

function fechaISOHoy(): string {
  return new Date().toISOString().split('T')[0]
}

function formatearHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function BadgeMetodo({ metodo }: { metodo: string }) {
  if (metodo === 'EFECTIVO')
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-900 text-emerald-300">
        Contado
      </span>
    )
  if (metodo === 'YAPE')
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-900 text-purple-300">
        Yape
      </span>
    )
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-900 text-yellow-300">
      Crédito
    </span>
  )
}

export default function CierreDia() {
  const [resumen, setResumen] = useState<ResumenVentasDia | null>(null)
  const [productos, setProductos] = useState<ProductoVendidoRow[]>([])
  const [ventas, setVentas] = useState<VentaCierreRow[]>([])
  const [creditos, setCreditos] = useState<CreditosHoyRow | null>(null)
  const [cobros, setCobros] = useState<CobrosHoyRow | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      const fecha = fechaISOHoy()
      const res = await obtenerResumenVentasDia(BUSINESS_ID, fecha)
      const prods = await obtenerProductosMasVendidos(BUSINESS_ID, fecha, 5)
      const vtas = await obtenerVentasDelDia(BUSINESS_ID, fecha)
      const creds = await obtenerCreditosOtorgadosHoy(BUSINESS_ID, fecha)
      const cobr = await obtenerCobrosRecibidosHoy(BUSINESS_ID, fecha)
      setResumen(res)
      setProductos(prods)
      setVentas(vtas)
      setCreditos(creds)
      setCobros(cobr)
      setCargando(false)
    }
    cargar()
  }, [])

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-950 text-slate-400 text-lg">
        Cargando...
      </div>
    )
  }

  const sinVentas = !resumen || resumen.cantidad_ventas === 0

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      <div className="px-4 pt-4 pb-6 flex flex-col gap-5">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-0.5">
          <h1 className="text-slate-100 text-xl font-bold">Cierre del Día</h1>
          <p className="text-slate-500 text-sm">{fechaTextoHoy()}</p>
        </div>

        {sinVentas ? (
          /* ── Estado vacío ──────────────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl">📋</span>
            <p className="text-slate-400 text-lg font-medium">No hay ventas registradas hoy</p>
            <p className="text-slate-600 text-sm">Las ventas aparecerán aquí al final del día</p>
          </div>
        ) : (
          <>
            {/* ── Ventas totales ──────────────────────────────────────────────── */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                <span>💰</span>
                <span className="uppercase tracking-wide">Ventas Totales</span>
              </div>
              <span className="text-emerald-400 text-4xl font-bold leading-none">
                {formatearDeuda(resumen!.total_dia)}
              </span>
              <div className="flex items-center gap-3 text-slate-400 text-sm">
                <span>{resumen!.cantidad_ventas} ventas</span>
                <span className="text-slate-600">·</span>
                <span>Ticket prom. {formatearDeuda(resumen!.ticket_promedio)}</span>
              </div>
            </div>

            {/* ── Desglose por método (3 cards) ──────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-lg">💵</span>
                <span className="text-slate-500 text-xs font-medium">Contado</span>
                <span className="text-emerald-400 text-base font-bold leading-tight">
                  {formatearDeuda(resumen!.total_contado)}
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-lg">📱</span>
                <span className="text-slate-500 text-xs font-medium">Yape</span>
                <span className="text-purple-400 text-base font-bold leading-tight">
                  {formatearDeuda(resumen!.total_yape)}
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-lg">📝</span>
                <span className="text-slate-500 text-xs font-medium">Crédito</span>
                <span className="text-yellow-400 text-base font-bold leading-tight">
                  {formatearDeuda(resumen!.total_credito)}
                </span>
              </div>
            </div>

            {/* ── Créditos y cobros (2 cards) ─────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">
                  Crédito otorgado
                </span>
                <span className="text-yellow-400 text-xl font-bold leading-none">
                  {formatearDeuda(creditos?.total_credito ?? 0)}
                </span>
                <span className="text-slate-500 text-xs">
                  {creditos?.cantidad_clientes ?? 0} cliente{(creditos?.cantidad_clientes ?? 0) !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">
                  Cobros recibidos
                </span>
                <span className="text-emerald-400 text-xl font-bold leading-none">
                  {formatearDeuda(cobros?.total_cobrado ?? 0)}
                </span>
                <span className="text-slate-500 text-xs">
                  {cobros?.cantidad_pagos ?? 0} pago{(cobros?.cantidad_pagos ?? 0) !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* ── Top 5 Productos ─────────────────────────────────────────────── */}
            {productos.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-slate-500 text-xs uppercase tracking-wide font-medium">
                  🏆 Top Productos del Día
                </p>
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  {productos.map((p, i) => (
                    <div
                      key={p.nombre}
                      className={`flex items-center gap-3 px-4 py-3 ${
                        i < productos.length - 1 ? 'border-b border-slate-800' : ''
                      }`}
                    >
                      <span className={`text-sm font-bold w-6 shrink-0 ${
                        i === 0 ? 'text-yellow-400' :
                        i === 1 ? 'text-slate-400' :
                        i === 2 ? 'text-amber-600' :
                        'text-slate-600'
                      }`}>
                        #{i + 1}
                      </span>
                      <span className="flex-1 text-slate-100 text-sm font-medium truncate">
                        {p.nombre}
                      </span>
                      <span className="text-slate-500 text-xs shrink-0">
                        {p.cantidad_kg % 1 === 0
                          ? p.cantidad_kg.toFixed(0)
                          : p.cantidad_kg.toFixed(1)}kg
                      </span>
                      <span className="text-emerald-400 text-sm font-semibold shrink-0">
                        {formatearDeuda(p.monto_total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Historial de ventas del día ─────────────────────────────────── */}
            <div className="flex flex-col gap-2">
              <p className="text-slate-500 text-xs uppercase tracking-wide font-medium">
                Ventas del Día
              </p>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {ventas.map((v, i) => (
                  <div
                    key={v.id}
                    className={`flex items-center gap-3 px-4 py-3 min-h-[52px] ${
                      i < ventas.length - 1 ? 'border-b border-slate-800' : ''
                    }`}
                  >
                    <span className="text-slate-500 text-xs font-mono shrink-0 w-10">
                      {formatearHora(v.fecha)}
                    </span>
                    <span className="flex-1 text-slate-300 text-sm truncate">
                      {v.cliente_nombre ?? 'Contado'}
                    </span>
                    <span className="text-slate-100 text-sm font-semibold shrink-0">
                      {formatearDeuda(v.total)}
                    </span>
                    <div className="shrink-0">
                      <BadgeMetodo metodo={v.metodo_pago} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  )
}
