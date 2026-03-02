import { useEffect, useState } from 'react'
import {
  obtenerLotes,
  obtenerMovimientosLote,
  obtenerProveedores,
  crearLote,
  ajustarStock,
  registrarMerma,
  type LoteRow,
  type MovimientoRow,
  type ProveedorRow,
} from '../../db/queries/inventario.queries'
import { obtenerProductos, type ProductoRow } from '../../db/queries/productos.queries'
import {
  calcularDiasParaVencer,
  calcularPorcentajeMerma,
  calcularValorInventario,
  formatearKg,
  formatearDiasVencer,
} from '../../core/inventario/loteUtils'

const BUSINESS_ID = 'local'
const BRANCH_ID = 'local-branch'

type Pantalla = 'lista' | 'detalle' | 'ajustar' | 'merma' | 'nuevo-lote'
type Filtro = 'todos' | 'alerta' | 'agotado'

// ── Helpers de presentación ───────────────────────────────────────────────────

function badgeEstado(estado: string): { label: string; cls: string } {
  switch (estado) {
    case 'FRESCO':      return { label: 'Fresco',      cls: 'bg-emerald-900 text-emerald-300' }
    case 'ADVERTENCIA': return { label: 'Advertencia', cls: 'bg-amber-900   text-amber-300'   }
    case 'CRITICO':     return { label: '⚠ Crítico',   cls: 'bg-red-900     text-red-300'     }
    case 'AGOTADO':     return { label: 'Agotado',     cls: 'bg-slate-700   text-slate-400'   }
    default:            return { label: estado,         cls: 'bg-slate-700   text-slate-400'   }
  }
}

function clsBarraEstado(estado: string): string {
  switch (estado) {
    case 'FRESCO':      return 'bg-emerald-500'
    case 'ADVERTENCIA': return 'bg-amber-500'
    case 'CRITICO':     return 'bg-red-500'
    default:            return 'bg-slate-600'
  }
}

function clsDiasVencer(dias: number): string {
  if (dias <= 0) return 'text-red-400 font-semibold'
  if (dias <= 3) return 'text-amber-400 font-medium'
  return 'text-slate-400'
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function Inventario() {
  // ── Datos ─────────────────────────────────────────────────────────────────
  const [lotes, setLotes] = useState<LoteRow[]>([])
  const [productos, setProductos] = useState<ProductoRow[]>([])
  const [proveedores, setProveedores] = useState<ProveedorRow[]>([])
  const [cargando, setCargando] = useState(true)

  // ── Navegación ────────────────────────────────────────────────────────────
  const [pantalla, setPantalla] = useState<Pantalla>('lista')
  const [filtro, setFiltro] = useState<Filtro>('todos')

  // ── Lote seleccionado ─────────────────────────────────────────────────────
  const [loteSel, setLoteSel] = useState<LoteRow | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoRow[]>([])

  // ── Form: Ajustar stock ───────────────────────────────────────────────────
  const [cantAjuste, setCantAjuste] = useState('')
  const [motivoAjuste, setMotivoAjuste] = useState('')
  const [guardandoAjuste, setGuardandoAjuste] = useState(false)
  const [ajusteOk, setAjusteOk] = useState(false)
  const [errAjuste, setErrAjuste] = useState<string | null>(null)

  // ── Form: Merma ───────────────────────────────────────────────────────────
  const [cantMerma, setCantMerma] = useState('')
  const [motivoMerma, setMotivoMerma] = useState('')
  const [guardandoMerma, setGuardandoMerma] = useState(false)
  const [mermaOk, setMermaOk] = useState(false)
  const [errMerma, setErrMerma] = useState<string | null>(null)

  // ── Form: Nuevo lote ──────────────────────────────────────────────────────
  const [nlProductoId, setNlProductoId] = useState('')
  const [nlProveedorId, setNlProveedorId] = useState('')
  const [nlTipo, setNlTipo] = useState<'COMPRA_DIRECTA' | 'CONSIGNACION'>('COMPRA_DIRECTA')
  const [nlCantidad, setNlCantidad] = useState('')
  const [nlCosto, setNlCosto] = useState('')
  const [nlFechaEntrada, setNlFechaEntrada] = useState(new Date().toISOString().slice(0, 10))
  const [nlFechaVenc, setNlFechaVenc] = useState('')
  const [nlAlertaDias, setNlAlertaDias] = useState('2')
  const [guardandoLote, setGuardandoLote] = useState(false)
  const [errLote, setErrLote] = useState<string | null>(null)

  // ── Carga de datos ────────────────────────────────────────────────────────

  async function cargarDatos() {
    setCargando(true)
    const l = await obtenerLotes(BUSINESS_ID)
    const p = await obtenerProductos(BUSINESS_ID)
    const pr = await obtenerProveedores(BUSINESS_ID)
    setLotes(l)
    setProductos(p)
    setProveedores(pr)
    setCargando(false)
  }

  useEffect(() => { cargarDatos() }, [])

  // ── Acciones: detalle ─────────────────────────────────────────────────────

  async function abrirDetalle(lote: LoteRow) {
    setLoteSel(lote)
    const movs = await obtenerMovimientosLote(lote.id)
    setMovimientos(movs)
    setPantalla('detalle')
  }

  function cerrarDetalle() {
    setPantalla('lista')
    setLoteSel(null)
    setMovimientos([])
  }

  // ── Acciones: ajustar stock ───────────────────────────────────────────────

  function abrirAjuste() {
    if (!loteSel) return
    setCantAjuste(loteSel.cantidad_actual_kg.toFixed(1))
    setMotivoAjuste('')
    setAjusteOk(false)
    setErrAjuste(null)
    setPantalla('ajustar')
  }

  async function confirmarAjuste() {
    if (!loteSel) return
    const cantidad = parseFloat(cantAjuste.replace(',', '.'))
    if (isNaN(cantidad) || cantidad < 0) {
      setErrAjuste('Ingresa una cantidad válida (mayor o igual a 0)')
      return
    }
    setErrAjuste(null)
    setGuardandoAjuste(true)
    try {
      await ajustarStock(loteSel.id, cantidad, motivoAjuste || 'Ajuste de inventario')
      setAjusteOk(true)
      await cargarDatos()
      setTimeout(cerrarDetalle, 1200)
    } finally {
      setGuardandoAjuste(false)
    }
  }

  // ── Acciones: merma ───────────────────────────────────────────────────────

  function abrirMerma() {
    setCantMerma('')
    setMotivoMerma('')
    setMermaOk(false)
    setErrMerma(null)
    setPantalla('merma')
  }

  async function confirmarMerma() {
    if (!loteSel) return
    const cantidad = parseFloat(cantMerma.replace(',', '.'))
    if (isNaN(cantidad) || cantidad <= 0) {
      setErrMerma('Ingresa una cantidad de merma válida')
      return
    }
    if (cantidad > loteSel.cantidad_actual_kg) {
      setErrMerma(`No puedes registrar más de ${formatearKg(loteSel.cantidad_actual_kg)}`)
      return
    }
    setErrMerma(null)
    setGuardandoMerma(true)
    try {
      await registrarMerma(loteSel.id, cantidad, motivoMerma || 'Merma registrada')
      setMermaOk(true)
      await cargarDatos()
      setTimeout(cerrarDetalle, 1200)
    } finally {
      setGuardandoMerma(false)
    }
  }

  // ── Acciones: nuevo lote ──────────────────────────────────────────────────

  function abrirNuevoLote() {
    setNlProductoId('')
    setNlProveedorId('')
    setNlTipo('COMPRA_DIRECTA')
    setNlCantidad('')
    setNlCosto('')
    setNlFechaEntrada(new Date().toISOString().slice(0, 10))
    setNlFechaVenc('')
    setNlAlertaDias('2')
    setErrLote(null)
    setPantalla('nuevo-lote')
  }

  async function confirmarNuevoLote() {
    if (!nlProductoId) { setErrLote('Selecciona un producto'); return }
    const cantidad = parseFloat(nlCantidad.replace(',', '.'))
    if (isNaN(cantidad) || cantidad <= 0) { setErrLote('Ingresa una cantidad válida'); return }
    const costo = parseFloat(nlCosto.replace(',', '.'))
    if (isNaN(costo) || costo < 0) { setErrLote('Ingresa un costo válido'); return }
    if (!nlFechaVenc) { setErrLote('Ingresa la fecha de vencimiento estimada'); return }

    setErrLote(null)
    setGuardandoLote(true)
    try {
      await crearLote({
        business_id: BUSINESS_ID,
        branch_id: BRANCH_ID,
        product_id: nlProductoId,
        supplier_id: nlProveedorId || null,
        tipo_ingreso: nlTipo,
        fecha_entrada: new Date(nlFechaEntrada).toISOString(),
        cantidad_inicial_kg: cantidad,
        costo_unitario: costo,
        fecha_vencimiento_estimada: new Date(nlFechaVenc).toISOString(),
        alerta_merma_dias: parseInt(nlAlertaDias) || 2,
      })
      await cargarDatos()
      setPantalla('lista')
    } catch (e) {
      setErrLote(e instanceof Error ? e.message : 'Error al registrar lote')
    } finally {
      setGuardandoLote(false)
    }
  }

  // ── Derivados ─────────────────────────────────────────────────────────────

  const lotesFiltrados = lotes.filter(l => {
    if (filtro === 'alerta') return l.estado === 'ADVERTENCIA' || l.estado === 'CRITICO'
    if (filtro === 'agotado') return l.estado === 'AGOTADO'
    return true
  })

  const totalValor = lotes.reduce(
    (sum, l) => sum + calcularValorInventario(l.cantidad_actual_kg, l.costo_unitario), 0
  )
  const totalKg = lotes.reduce((sum, l) => sum + l.cantidad_actual_kg, 0)
  const cantAlertas = lotes.filter(l => l.estado === 'ADVERTENCIA' || l.estado === 'CRITICO').length

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">

      {/* ── Stats resumen ── */}
      <div className="grid grid-cols-3 gap-2 px-4 pt-4 pb-3 shrink-0">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <p className="text-slate-500 text-xs uppercase tracking-wide">Valor S/</p>
          <p className="text-emerald-400 text-xl font-bold leading-tight mt-0.5">
            {totalValor >= 1000
              ? `${(totalValor / 1000).toFixed(1)}k`
              : totalValor.toFixed(0)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <p className="text-slate-500 text-xs uppercase tracking-wide">Stock</p>
          <p className="text-slate-100 text-xl font-bold leading-tight mt-0.5">
            {totalKg >= 1000
              ? `${(totalKg / 1000).toFixed(1)}t`
              : `${totalKg.toFixed(0)} kg`}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <p className="text-slate-500 text-xs uppercase tracking-wide">Alertas</p>
          <p className={`text-xl font-bold leading-tight mt-0.5 ${cantAlertas > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
            {cantAlertas}
          </p>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="flex gap-2 px-4 pb-3 shrink-0">
        {(['todos', 'alerta', 'agotado'] as Filtro[]).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 h-8 rounded-full text-sm font-medium transition-colors ${
              filtro === f
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {f === 'todos' ? 'Todos' : f === 'alerta' ? 'En alerta' : 'Agotados'}
          </button>
        ))}
      </div>

      {/* ── Lista de lotes ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {cargando ? (
          <p className="text-center text-slate-500 pt-16 text-lg">Cargando...</p>
        ) : lotesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 gap-3">
            <span className="text-5xl">📦</span>
            <p className="text-slate-400 text-xl font-semibold">
              {filtro === 'todos' ? 'Sin lotes registrados' : 'Sin lotes en esta categoría'}
            </p>
            {filtro === 'todos' && (
              <p className="text-slate-600 text-sm">Toca + para agregar tu primer lote</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {lotesFiltrados.map(lote => {
              const dias = calcularDiasParaVencer(lote.fecha_vencimiento_estimada)
              const pct = lote.cantidad_inicial_kg > 0
                ? Math.round((lote.cantidad_actual_kg / lote.cantidad_inicial_kg) * 100)
                : 0
              const badge = badgeEstado(lote.estado)
              const valor = calcularValorInventario(lote.cantidad_actual_kg, lote.costo_unitario)

              return (
                <button
                  key={lote.id}
                  onClick={() => abrirDetalle(lote)}
                  className="w-full text-left bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2.5 active:bg-slate-800 transition-colors"
                >
                  {/* Fila: nombre + badge estado */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-slate-100 text-lg font-semibold leading-tight">
                      {lote.product_nombre}
                    </p>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Barra de stock */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-100 font-medium">
                        {formatearKg(lote.cantidad_actual_kg)}
                      </span>
                      <span className="text-slate-500">{pct}% restante</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${clsBarraEstado(lote.estado)}`}
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Fila: proveedor + vencimiento + valor */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 truncate">
                      {lote.supplier_nombre ?? 'Sin proveedor'}
                    </span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className={clsDiasVencer(dias)}>
                        {formatearDiasVencer(dias)}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400">S/ {valor.toFixed(0)}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Botón flotante + Nuevo Lote */}
      <button
        onClick={abrirNuevoLote}
        aria-label="Agregar nuevo lote"
        className="fixed bottom-20 right-4 w-14 h-14 bg-emerald-600 active:bg-emerald-500 rounded-full flex items-center justify-center text-white text-3xl shadow-lg z-10 transition-colors"
      >
        +
      </button>

      {/* ═══════════════════════════════════════════════════════════════════════
          PANEL: Detalle de lote
      ═══════════════════════════════════════════════════════════════════════ */}
      {pantalla === 'detalle' && loteSel && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-slate-800 shrink-0">
            <button
              onClick={cerrarDetalle}
              className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-slate-100 text-xl shrink-0"
            >
              ←
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-slate-100 text-lg font-bold leading-tight truncate">
                {loteSel.product_nombre}
              </p>
              <p className="text-slate-500 text-sm">
                Entrada: {fechaCorta(loteSel.fecha_entrada)}
              </p>
            </div>
            {(() => {
              const b = badgeEstado(loteSel.estado)
              return (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${b.cls}`}>
                  {b.label}
                </span>
              )
            })()}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

            {/* Card stock principal */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Stock actual</p>
                  <p className="text-slate-100 text-4xl font-bold">
                    {formatearKg(loteSel.cantidad_actual_kg)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Merma</p>
                  <p className="text-amber-400 text-2xl font-bold">
                    {calcularPorcentajeMerma(loteSel.cantidad_inicial_kg, loteSel.cantidad_actual_kg)}%
                  </p>
                </div>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full ${clsBarraEstado(loteSel.estado)}`}
                  style={{
                    width: `${Math.max(2, loteSel.cantidad_inicial_kg > 0
                      ? Math.round((loteSel.cantidad_actual_kg / loteSel.cantidad_inicial_kg) * 100)
                      : 0)}%`
                  }}
                />
              </div>
              <p className="text-slate-500 text-sm">
                Inicial: {formatearKg(loteSel.cantidad_inicial_kg)}
              </p>
            </div>

            {/* Grid info 2×2 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Costo/kg</p>
                <p className="text-slate-100 text-xl font-bold">
                  S/ {loteSel.costo_unitario.toFixed(2)}
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Valor total</p>
                <p className="text-emerald-400 text-xl font-bold">
                  S/ {calcularValorInventario(loteSel.cantidad_actual_kg, loteSel.costo_unitario).toFixed(0)}
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Vencimiento</p>
                {(() => {
                  const dias = calcularDiasParaVencer(loteSel.fecha_vencimiento_estimada)
                  return (
                    <>
                      <p className={`text-xl font-bold ${clsDiasVencer(dias)}`}>
                        {formatearDiasVencer(dias)}
                      </p>
                      <p className="text-slate-600 text-xs mt-0.5">
                        {fechaCorta(loteSel.fecha_vencimiento_estimada)}
                      </p>
                    </>
                  )
                })()}
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Proveedor</p>
                <p className="text-slate-100 text-sm font-medium leading-tight truncate">
                  {loteSel.supplier_nombre ?? '—'}
                </p>
                <p className="text-slate-600 text-xs mt-0.5">{loteSel.tipo_ingreso}</p>
              </div>
            </div>

            {/* Historial de movimientos */}
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wide font-medium mb-2">
                Movimientos recientes
              </p>
              {movimientos.length === 0 ? (
                <p className="text-slate-600 text-sm">Sin movimientos registrados</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {movimientos.map(m => (
                    <div
                      key={m.id}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-slate-200 text-sm font-medium">{m.tipo}</span>
                        <span className="text-slate-500 text-xs truncate">{m.motivo ?? '—'}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${m.cantidad_kg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {m.cantidad_kg >= 0 ? '+' : ''}{m.cantidad_kg.toFixed(1)} kg
                        </p>
                        <p className="text-slate-500 text-xs">{fechaCorta(m.fecha)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Botones acción */}
          <div className="flex gap-3 px-4 py-4 border-t border-slate-800 shrink-0">
            <button
              onClick={abrirMerma}
              className="flex-1 h-14 bg-amber-700 active:bg-amber-600 text-white text-base font-bold rounded-xl transition-colors"
            >
              📉 Merma
            </button>
            <button
              onClick={abrirAjuste}
              className="flex-1 h-14 bg-slate-700 active:bg-slate-600 text-white text-base font-bold rounded-xl transition-colors"
            >
              ⚖ Ajustar
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          PANEL: Ajustar stock
      ═══════════════════════════════════════════════════════════════════════ */}
      {pantalla === 'ajustar' && loteSel && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">

          <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-slate-800 shrink-0">
            <button
              onClick={() => setPantalla('detalle')}
              className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-slate-100 text-xl shrink-0"
            >
              ←
            </button>
            <div>
              <p className="text-slate-100 text-lg font-bold">Ajustar Stock</p>
              <p className="text-slate-500 text-sm">{loteSel.product_nombre}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
            {ajusteOk ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-4">
                <span className="text-6xl">✓</span>
                <p className="text-emerald-400 text-2xl font-bold">Stock ajustado</p>
              </div>
            ) : (
              <>
                {/* Stock actual (referencia) */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <p className="text-slate-500 text-sm mb-1">Stock actual</p>
                  <p className="text-slate-100 text-2xl font-bold">
                    {formatearKg(loteSel.cantidad_actual_kg)}
                  </p>
                </div>

                {/* Nueva cantidad */}
                <div className="flex flex-col gap-2">
                  <label className="text-slate-400 text-sm font-medium">Nueva cantidad (kg)</label>
                  <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-4 h-16 gap-2 focus-within:border-emerald-500 transition-colors">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={loteSel.cantidad_actual_kg.toFixed(1)}
                      value={cantAjuste}
                      onChange={e => setCantAjuste(e.target.value)}
                      className="flex-1 bg-transparent text-slate-100 text-3xl font-bold focus:outline-none placeholder-slate-700"
                      autoFocus
                    />
                    <span className="text-slate-500 text-lg">kg</span>
                  </div>
                  {errAjuste && <p className="text-red-400 text-sm">{errAjuste}</p>}
                </div>

                {/* Motivo */}
                <div className="flex flex-col gap-2">
                  <label className="text-slate-400 text-sm font-medium">Motivo (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: Conteo físico, devolución..."
                    value={motivoAjuste}
                    onChange={e => setMotivoAjuste(e.target.value)}
                    className="w-full h-12 bg-slate-900 border border-slate-700 rounded-xl px-4 text-slate-100 text-base focus:outline-none focus:border-emerald-500 placeholder-slate-600 transition-colors"
                  />
                </div>

                <div className="mt-auto">
                  <button
                    onClick={confirmarAjuste}
                    disabled={guardandoAjuste || !cantAjuste}
                    className="w-full h-14 bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xl font-bold rounded-xl transition-colors"
                  >
                    {guardandoAjuste ? 'Guardando...' : '⚖ Confirmar Ajuste'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          PANEL: Registrar merma
      ═══════════════════════════════════════════════════════════════════════ */}
      {pantalla === 'merma' && loteSel && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">

          <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-slate-800 shrink-0">
            <button
              onClick={() => setPantalla('detalle')}
              className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-slate-100 text-xl shrink-0"
            >
              ←
            </button>
            <div>
              <p className="text-slate-100 text-lg font-bold">Registrar Merma</p>
              <p className="text-slate-500 text-sm">{loteSel.product_nombre}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
            {mermaOk ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-4">
                <span className="text-6xl">✓</span>
                <p className="text-amber-400 text-2xl font-bold">Merma registrada</p>
              </div>
            ) : (
              <>
                {/* Disponible */}
                <div className="bg-slate-900 border border-amber-800 rounded-xl p-4">
                  <p className="text-slate-500 text-sm mb-1">Disponible para mermar</p>
                  <p className="text-slate-100 text-2xl font-bold">
                    {formatearKg(loteSel.cantidad_actual_kg)}
                  </p>
                </div>

                {/* Cantidad de merma */}
                <div className="flex flex-col gap-2">
                  <label className="text-slate-400 text-sm font-medium">Cantidad de merma (kg)</label>
                  <div className="flex items-center bg-slate-900 border border-amber-700 rounded-xl px-4 h-16 gap-2 focus-within:border-amber-500 transition-colors">
                    <span className="text-amber-500 text-2xl font-bold">−</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.0"
                      value={cantMerma}
                      onChange={e => setCantMerma(e.target.value)}
                      className="flex-1 bg-transparent text-slate-100 text-3xl font-bold focus:outline-none placeholder-slate-700"
                      autoFocus
                    />
                    <span className="text-slate-500 text-lg">kg</span>
                  </div>
                  {errMerma && <p className="text-red-400 text-sm">{errMerma}</p>}
                </div>

                {/* Motivo */}
                <div className="flex flex-col gap-2">
                  <label className="text-slate-400 text-sm font-medium">Motivo</label>
                  <input
                    type="text"
                    placeholder="Ej: Producto podrido, vencido, roto..."
                    value={motivoMerma}
                    onChange={e => setMotivoMerma(e.target.value)}
                    className="w-full h-12 bg-slate-900 border border-slate-700 rounded-xl px-4 text-slate-100 text-base focus:outline-none focus:border-amber-500 placeholder-slate-600 transition-colors"
                  />
                </div>

                <div className="mt-auto">
                  <button
                    onClick={confirmarMerma}
                    disabled={guardandoMerma || !cantMerma}
                    className="w-full h-14 bg-amber-700 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xl font-bold rounded-xl transition-colors"
                  >
                    {guardandoMerma ? 'Registrando...' : '📉 Registrar Merma'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          PANEL: Nuevo lote
      ═══════════════════════════════════════════════════════════════════════ */}
      {pantalla === 'nuevo-lote' && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">

          <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-slate-800 shrink-0">
            <button
              onClick={() => setPantalla('lista')}
              className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-slate-100 text-xl shrink-0"
            >
              ←
            </button>
            <p className="text-slate-100 text-lg font-bold">Nuevo Lote</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5 pb-8">

            {/* Producto */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-400 text-sm font-medium">Producto *</label>
              <div className="flex flex-wrap gap-2">
                {productos.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setNlProductoId(p.id)}
                    className={`px-3 h-10 rounded-xl text-sm font-medium transition-colors ${
                      nlProductoId === p.id
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo de ingreso */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-400 text-sm font-medium">Tipo de ingreso</label>
              <div className="flex gap-2">
                {(['COMPRA_DIRECTA', 'CONSIGNACION'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setNlTipo(t)}
                    className={`flex-1 h-12 rounded-xl text-sm font-medium transition-colors ${
                      nlTipo === t ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {t === 'COMPRA_DIRECTA' ? '🛒 Compra directa' : '🤝 Consignación'}
                  </button>
                ))}
              </div>
            </div>

            {/* Proveedor */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-400 text-sm font-medium">Proveedor (opcional)</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setNlProveedorId('')}
                  className={`px-3 h-10 rounded-xl text-sm font-medium transition-colors ${
                    nlProveedorId === '' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Sin proveedor
                </button>
                {proveedores.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setNlProveedorId(p.id)}
                    className={`px-3 h-10 rounded-xl text-sm font-medium transition-colors ${
                      nlProveedorId === p.id
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* Cantidad inicial */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-400 text-sm font-medium">Cantidad inicial (kg) *</label>
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-4 h-14 gap-2 focus-within:border-emerald-500 transition-colors">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={nlCantidad}
                  onChange={e => setNlCantidad(e.target.value)}
                  className="flex-1 bg-transparent text-slate-100 text-2xl font-bold focus:outline-none placeholder-slate-700"
                />
                <span className="text-slate-500">kg</span>
              </div>
            </div>

            {/* Costo unitario */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-400 text-sm font-medium">Costo por kg (S/) *</label>
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-4 h-14 gap-2 focus-within:border-emerald-500 transition-colors">
                <span className="text-slate-400 text-xl font-bold">S/</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={nlCosto}
                  onChange={e => setNlCosto(e.target.value)}
                  className="flex-1 bg-transparent text-slate-100 text-2xl font-bold focus:outline-none placeholder-slate-700"
                />
              </div>
            </div>

            {/* Fecha entrada */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-400 text-sm font-medium">Fecha de entrada</label>
              <input
                type="date"
                value={nlFechaEntrada}
                onChange={e => setNlFechaEntrada(e.target.value)}
                className="w-full h-12 bg-slate-900 border border-slate-700 rounded-xl px-4 text-slate-100 text-base focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Fecha vencimiento */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-400 text-sm font-medium">Fecha de vencimiento estimada *</label>
              <input
                type="date"
                value={nlFechaVenc}
                onChange={e => setNlFechaVenc(e.target.value)}
                min={nlFechaEntrada}
                className="w-full h-12 bg-slate-900 border border-slate-700 rounded-xl px-4 text-slate-100 text-base focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Días de alerta */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-400 text-sm font-medium">
                Alertar cuando falten (días)
              </label>
              <div className="flex gap-2">
                {['1', '2', '3', '5', '7'].map(d => (
                  <button
                    key={d}
                    onClick={() => setNlAlertaDias(d)}
                    className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors ${
                      nlAlertaDias === d
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {errLote && (
              <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{errLote}</p>
              </div>
            )}

            <button
              onClick={confirmarNuevoLote}
              disabled={guardandoLote}
              className="w-full h-14 bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xl font-bold rounded-xl transition-colors"
            >
              {guardandoLote ? 'Registrando...' : '✓ Registrar Lote'}
            </button>

          </div>
        </div>
      )}

    </div>
  )
}
