import { useEffect, useState } from 'react'
import { obtenerClientesPantalla, type ClienteRow } from '../../db/queries/clientes.queries'
import { obtenerProductosPantalla, type ProductoRow } from '../../db/queries/productos.queries'
import { registrarVenta } from '../../db/queries/ventas.queries'
import { calcularSubtotal } from '../../core/ventas/ventaUtils'
import { useVentaStore } from '../../stores/ventaStore'
import { formatearDeuda } from '../../core/creditos/creditoUtils'

// ── Sonido ka-ching con Web Audio API ─────────────────────────────────────────
function sonarKaChing() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.35)
  } catch { /* sin audio → ignorar */ }
}

// ── Teclado numérico ──────────────────────────────────────────────────────────
const TECLAS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['.', '0', '⌫'],
] as const

type Panel = 'cerrado' | 'productos' | 'peso'

// ── Componente ────────────────────────────────────────────────────────────────
export default function VentaRapida() {
  const {
    clienteId, clienteNombre, items,
    setCliente, agregarItem, eliminarItem,
    calcularTotal, limpiarVenta,
  } = useVentaStore()

  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [productos, setProductos] = useState<ProductoRow[]>([])
  const [panel, setPanel] = useState<Panel>('cerrado')
  const [productoActual, setProductoActual] = useState<ProductoRow | null>(null)
  const [pesoInput, setPesoInput] = useState('0')
  const [confirmando, setConfirmando] = useState(false)
  const [flashExito, setFlashExito] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      const c = await obtenerClientesPantalla('local')
      const p = await obtenerProductosPantalla('local')
      setClientes(c)
      setProductos(p)
      setCargando(false)
    }
    cargar()
  }, [])

  // ── Teclado numérico ────────────────────────────────────────────────────────
  function presionarTecla(tecla: string) {
    setPesoInput(prev => {
      if (tecla === '⌫') {
        const next = prev.slice(0, -1)
        return next === '' || next === '-' ? '0' : next
      }
      if (tecla === '.' && prev.includes('.')) return prev
      if (prev === '0' && tecla !== '.') return tecla
      return prev + tecla
    })
  }

  function confirmarPeso() {
    if (!productoActual) return
    const kg = parseFloat(pesoInput) || 0
    if (kg <= 0) return
    const subtotal = calcularSubtotal(kg, productoActual.precio_venta_actual)
    agregarItem({
      producto_id: productoActual.id,
      nombre: productoActual.nombre,
      nombre_corto: productoActual.nombre_corto,
      cantidad_kg: kg,
      precio_unitario: productoActual.precio_venta_actual,
      subtotal,
    })
    setPanel('cerrado')
    setProductoActual(null)
    setPesoInput('0')
  }

  // ── Pago ────────────────────────────────────────────────────────────────────
  async function handlePagar(metodoPago: 'EFECTIVO' | 'YAPE' | 'CREDITO') {
    if (items.length === 0) return
    if (metodoPago === 'CREDITO' && !clienteId) return
    setConfirmando(true)
    try {
      await registrarVenta({
        business_id: 'local',
        branch_id: 'local-branch',
        user_id: 'local-user',
        client_id: clienteId,
        metodo_pago: metodoPago,
        items: items.map(item => ({
          product_id: item.producto_id,
          cantidad_kg: item.cantidad_kg,
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal,
        })),
      })
      sonarKaChing()
      limpiarVenta()
      setFlashExito(true)
      setTimeout(() => setFlashExito(false), 1500)
    } finally {
      setConfirmando(false)
    }
  }

  const total = calcularTotal()
  const hayItems = items.length > 0

  // ── Flash de éxito ──────────────────────────────────────────────────────────
  if (flashExito) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-emerald-900 text-white gap-4">
        <span className="text-7xl">✓</span>
        <p className="text-2xl font-bold">¡Venta registrada!</p>
        <p className="text-emerald-300 text-lg">{formatearDeuda(total)}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 relative">

      {/* ── ZONA SUPERIOR: Clientes frecuentes ─────────────────────────────── */}
      <div className="shrink-0 flex gap-2 px-3 py-2 overflow-x-auto scrollbar-none border-b border-slate-800">
        {/* Botón CONTADO */}
        <button
          onClick={() => setCliente(null, 'CONTADO')}
          className={`shrink-0 flex flex-col items-center justify-center min-w-[64px] h-14 rounded-xl px-3 text-xs font-bold border-2 transition-colors ${
            clienteId === null
              ? 'border-emerald-500 bg-emerald-900 text-emerald-300'
              : 'border-slate-700 bg-slate-800 text-slate-300'
          }`}
        >
          <span className="text-base leading-none">💵</span>
          <span>CONTADO</span>
        </button>

        {/* Clientes frecuentes */}
        {!cargando && clientes.map(c => (
          <button
            key={c.id}
            onClick={() => setCliente(c.id, c.nombre)}
            className={`shrink-0 flex flex-col items-center justify-center min-w-[64px] h-14 rounded-xl px-2 border-2 transition-colors ${
              clienteId === c.id
                ? 'border-emerald-500 bg-emerald-900 text-emerald-300'
                : 'border-slate-700 bg-slate-800 text-slate-300'
            }`}
          >
            <span className="text-xs font-bold leading-none">{c.nombre_corto}</span>
            {c.saldo_actual > 0 && (
              <span className="text-red-400 text-[10px] leading-none mt-0.5">
                S/{c.saldo_actual.toFixed(0)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ZONA CENTRAL: Items de la venta ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-600">
            <span className="text-5xl">🛒</span>
            <p className="text-lg">Agrega productos para iniciar venta</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 min-h-[56px]"
            >
              <div className="flex flex-col">
                <span className="text-slate-100 font-semibold text-base leading-tight">
                  {item.nombre_corto}
                </span>
                <span className="text-slate-500 text-xs">
                  {item.cantidad_kg}kg × S/{item.precio_unitario.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 text-lg font-bold">
                  S/{item.subtotal.toFixed(2)}
                </span>
                <button
                  onClick={() => eliminarItem(index)}
                  className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-red-400 text-lg"
                  aria-label="Eliminar"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}

        {/* Botón agregar producto */}
        <button
          onClick={() => setPanel('productos')}
          className="mt-2 w-full h-14 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 text-base font-semibold flex items-center justify-center gap-2 hover:border-slate-500"
        >
          <span className="text-xl">+</span>
          Agregar producto
        </button>
      </div>

      {/* ── ZONA INFERIOR: Total + Botones de pago ─────────────────────────── */}
      <div className="shrink-0 border-t border-slate-800 bg-slate-900 px-4 pt-3 pb-4">
        {/* Total */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-400 text-lg font-semibold">TOTAL</span>
          <span className="text-emerald-400 text-4xl font-bold">
            S/ {total.toFixed(2)}
          </span>
        </div>

        {/* Botones de pago */}
        <div className="flex gap-2">
          <button
            onClick={() => handlePagar('EFECTIVO')}
            disabled={!hayItems || confirmando}
            className="flex-1 h-14 bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-0.5"
          >
            <span className="text-lg leading-none">💵</span>
            <span>CONTADO</span>
          </button>

          <button
            onClick={() => handlePagar('YAPE')}
            disabled={!hayItems || confirmando}
            className="flex-1 h-14 bg-violet-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-0.5"
          >
            <span className="text-lg leading-none">📱</span>
            <span>YAPE</span>
          </button>

          <button
            onClick={() => handlePagar('CREDITO')}
            disabled={!hayItems || !clienteId || confirmando}
            className="flex-1 h-14 bg-amber-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-0.5"
          >
            <span className="text-lg leading-none">📝</span>
            <span>CRÉDITO</span>
          </button>
        </div>
      </div>

      {/* ── PANEL: Grid de productos ────────────────────────────────────────── */}
      {panel === 'productos' && (
        <div className="fixed inset-0 bg-slate-950 flex flex-col z-50">
          {/* Header panel */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
            <h2 className="text-lg font-bold text-slate-100">Elige producto</h2>
            <button
              onClick={() => setPanel('cerrado')}
              className="flex items-center gap-1 h-10 px-3 rounded-lg text-slate-400 text-sm font-semibold border border-slate-700"
            >
              ✕ Cerrar
            </button>
          </div>

          {/* Grid de productos */}
          <div className="flex-1 overflow-y-auto p-4">
            {productos.length === 0 ? (
              <p className="text-slate-500 text-center pt-10">
                No hay productos en pantalla rápida
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {productos.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setProductoActual(p)
                      setPesoInput('0')
                      setPanel('peso')
                    }}
                    className="flex flex-col items-center justify-center min-h-[72px] bg-slate-800 border border-slate-700 rounded-xl px-2 py-3 gap-1"
                  >
                    <span className="text-slate-100 text-sm font-bold text-center leading-tight">
                      {p.nombre_corto}
                    </span>
                    <span className="text-emerald-400 text-xs font-semibold">
                      S/{p.precio_venta_actual.toFixed(2)}/kg
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PANEL: Teclado de peso ──────────────────────────────────────────── */}
      {panel === 'peso' && productoActual && (
        <div className="fixed inset-0 bg-slate-950 flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
            <div>
              <p className="text-lg font-bold text-slate-100">{productoActual.nombre}</p>
              <p className="text-emerald-400 text-sm">
                S/ {productoActual.precio_venta_actual.toFixed(2)} / kg
              </p>
            </div>
            <button
              onClick={() => setPanel('cerrado')}
              className="flex items-center gap-1 h-10 px-3 rounded-lg text-slate-400 text-sm font-semibold border border-slate-700"
            >
              ✕ Cerrar
            </button>
          </div>

          {/* Display de peso */}
          <div className="px-4 py-4">
            <div className="bg-slate-800 rounded-xl p-4 text-center">
              <span className="text-slate-100 font-bold" style={{ fontSize: '48px', lineHeight: 1 }}>
                {pesoInput}
              </span>
              <span className="text-slate-400 text-2xl ml-2">kg</span>
            </div>
            <div className="text-center mt-2 text-slate-400 text-base">
              Subtotal:{' '}
              <span className="text-emerald-400 font-bold">
                S/ {calcularSubtotal(parseFloat(pesoInput) || 0, productoActual.precio_venta_actual).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Teclado numérico */}
          <div className="flex-1 px-4 pb-4 flex flex-col gap-2">
            {TECLAS.map((fila, fi) => (
              <div key={fi} className="flex gap-2 flex-1">
                {fila.map(tecla => (
                  <button
                    key={tecla}
                    onClick={() => presionarTecla(tecla)}
                    className="flex-1 min-h-[64px] bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-2xl font-bold flex items-center justify-center active:bg-slate-700"
                  >
                    {tecla}
                  </button>
                ))}
              </div>
            ))}

            {/* Botón OK */}
            <button
              onClick={confirmarPeso}
              disabled={(parseFloat(pesoInput) || 0) <= 0}
              className="w-full min-h-[64px] bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xl font-bold rounded-xl flex items-center justify-center gap-3"
            >
              <span>OK</span>
              <span className="text-emerald-300 text-base">
                S/ {calcularSubtotal(parseFloat(pesoInput) || 0, productoActual.precio_venta_actual).toFixed(2)}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
