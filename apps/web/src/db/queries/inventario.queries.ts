import { consultarSQL, ejecutarSQL, generarId, fechaActual } from '../dbUtils'

// ── Tipos locales (snake_case = columnas SQLite) ──────────────────────────────

export interface ProveedorRow {
  id: string
  business_id: string
  nombre: string
  celular: string | null
  tipo: string
  zona_origen: string | null
  comision_consignacion: number | null
}

export interface LoteRow {
  id: string
  business_id: string
  branch_id: string
  product_id: string
  supplier_id: string | null
  product_nombre: string
  product_nombre_corto: string
  supplier_nombre: string | null
  tipo_ingreso: string
  fecha_entrada: string
  cantidad_inicial_kg: number
  cantidad_actual_kg: number
  costo_unitario: number
  costo_total: number
  envases_cantidad: number
  fecha_vencimiento_estimada: string
  estado: string
  alerta_merma_dias: number
  notas: string | null
}

export interface MovimientoRow {
  id: string
  batch_id: string
  tipo: string
  cantidad_kg: number
  motivo: string | null
  registrado_por: string
  fecha: string
}

export interface NuevoLoteData {
  business_id: string
  branch_id: string
  product_id: string
  supplier_id?: string | null
  tipo_ingreso?: string
  fecha_entrada: string
  cantidad_inicial_kg: number
  costo_unitario: number
  envases_cantidad?: number
  envase_tipo_id?: string | null
  fecha_vencimiento_estimada: string
  alerta_merma_dias?: number
  notas?: string | null
}

export interface NuevoProveedorData {
  business_id: string
  nombre: string
  celular?: string | null
  tipo?: string
  zona_origen?: string | null
  comision_consignacion?: number | null
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function obtenerProveedores(businessId: string): Promise<ProveedorRow[]> {
  return consultarSQL<ProveedorRow>(
    'SELECT * FROM supplier WHERE business_id = ? ORDER BY nombre',
    [businessId]
  )
}

/**
 * Retorna todos los lotes del negocio, ordenados por urgencia:
 * CRITICO → ADVERTENCIA → FRESCO → AGOTADO → MERMA_TOTAL
 */
export async function obtenerLotes(businessId: string): Promise<LoteRow[]> {
  return consultarSQL<LoteRow>(
    `SELECT
       b.*,
       p.nombre       AS product_nombre,
       p.nombre_corto AS product_nombre_corto,
       s.nombre       AS supplier_nombre
     FROM batch b
     JOIN product p ON p.id = b.product_id
     LEFT JOIN supplier s ON s.id = b.supplier_id
     WHERE b.business_id = ?
     ORDER BY
       CASE b.estado
         WHEN 'CRITICO'     THEN 1
         WHEN 'ADVERTENCIA' THEN 2
         WHEN 'FRESCO'      THEN 3
         WHEN 'AGOTADO'     THEN 4
         WHEN 'MERMA_TOTAL' THEN 5
         ELSE 6
       END,
       b.fecha_vencimiento_estimada ASC`,
    [businessId]
  )
}

export async function obtenerLotePorId(id: string): Promise<LoteRow | null> {
  const rows = await consultarSQL<LoteRow>(
    `SELECT
       b.*,
       p.nombre       AS product_nombre,
       p.nombre_corto AS product_nombre_corto,
       s.nombre       AS supplier_nombre
     FROM batch b
     JOIN product p ON p.id = b.product_id
     LEFT JOIN supplier s ON s.id = b.supplier_id
     WHERE b.id = ?`,
    [id]
  )
  return rows[0] ?? null
}

export async function obtenerMovimientosLote(batchId: string): Promise<MovimientoRow[]> {
  return consultarSQL<MovimientoRow>(
    `SELECT id, batch_id, tipo, cantidad_kg, motivo, registrado_por, fecha
     FROM stock_movement
     WHERE batch_id = ?
     ORDER BY fecha DESC
     LIMIT 20`,
    [batchId]
  )
}

// ── Mutaciones ────────────────────────────────────────────────────────────────

export async function crearProveedor(data: NuevoProveedorData): Promise<string> {
  const id = generarId()
  const now = fechaActual()
  await ejecutarSQL(
    `INSERT INTO supplier (
       id, business_id, nombre, celular, tipo, zona_origen,
       comision_consignacion, sync_status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'LOCAL', ?, ?)`,
    [
      id,
      data.business_id,
      data.nombre,
      data.celular ?? null,
      data.tipo ?? 'DIRECTO',
      data.zona_origen ?? null,
      data.comision_consignacion ?? null,
      now,
      now,
    ]
  )
  return id
}

/**
 * Registra un nuevo lote de mercadería.
 * 1. INSERT batch (estado inicial FRESCO)
 * 2. INSERT stock_movement tipo ENTRADA
 * Secuencial, NUNCA Promise.all.
 */
export async function crearLote(data: NuevoLoteData): Promise<string> {
  const id = generarId()
  const now = fechaActual()
  const costoTotal = Math.round(data.cantidad_inicial_kg * data.costo_unitario * 100) / 100

  // 1. INSERT batch
  await ejecutarSQL(
    `INSERT INTO batch (
       id, business_id, branch_id, product_id, supplier_id,
       tipo_ingreso, fecha_entrada,
       cantidad_inicial_kg, cantidad_actual_kg,
       costo_unitario, costo_total,
       envases_cantidad, envase_tipo_id,
       fecha_vencimiento_estimada, estado, alerta_merma_dias,
       notas, sync_status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FRESCO', ?, ?, 'LOCAL', ?, ?)`,
    [
      id,
      data.business_id,
      data.branch_id,
      data.product_id,
      data.supplier_id ?? null,
      data.tipo_ingreso ?? 'COMPRA_DIRECTA',
      data.fecha_entrada,
      data.cantidad_inicial_kg,
      data.cantidad_inicial_kg,
      data.costo_unitario,
      costoTotal,
      data.envases_cantidad ?? 0,
      data.envase_tipo_id ?? null,
      data.fecha_vencimiento_estimada,
      data.alerta_merma_dias ?? 2,
      data.notas ?? null,
      now,
      now,
    ]
  )

  // 2. INSERT stock_movement ENTRADA
  await ejecutarSQL(
    `INSERT INTO stock_movement (
       id, batch_id, tipo, cantidad_kg, motivo,
       registrado_por, fecha, sync_status, created_at, updated_at
     ) VALUES (?, ?, 'ENTRADA', ?, 'Ingreso inicial de lote', 'local-user', ?, 'LOCAL', ?, ?)`,
    [generarId(), id, data.cantidad_inicial_kg, now, now, now]
  )

  return id
}

/**
 * Ajusta el stock de un lote a una nueva cantidad exacta.
 * Registra un movimiento AJUSTE con la diferencia (puede ser negativa).
 * Secuencial, NUNCA Promise.all.
 */
export async function ajustarStock(
  batchId: string,
  cantidadNuevaKg: number,
  motivo: string
): Promise<void> {
  const now = fechaActual()

  // 1. Leer cantidad actual y datos para calcular estado
  const rows = await consultarSQL<{
    cantidad_actual_kg: number
    fecha_vencimiento_estimada: string
    alerta_merma_dias: number
  }>(
    'SELECT cantidad_actual_kg, fecha_vencimiento_estimada, alerta_merma_dias FROM batch WHERE id = ?',
    [batchId]
  )
  if (rows.length === 0) return

  const { cantidad_actual_kg: cantidadAnterior, fecha_vencimiento_estimada, alerta_merma_dias } = rows[0]
  const diferencia = Math.round((cantidadNuevaKg - cantidadAnterior) * 1000) / 1000
  const nuevoEstado = _calcularEstado(cantidadNuevaKg, fecha_vencimiento_estimada, alerta_merma_dias)

  // 2. UPDATE batch
  await ejecutarSQL(
    'UPDATE batch SET cantidad_actual_kg = ?, estado = ?, updated_at = ? WHERE id = ?',
    [cantidadNuevaKg, nuevoEstado, now, batchId]
  )

  // 3. INSERT stock_movement AJUSTE (diferencia puede ser negativa)
  await ejecutarSQL(
    `INSERT INTO stock_movement (
       id, batch_id, tipo, cantidad_kg, motivo,
       registrado_por, fecha, sync_status, created_at, updated_at
     ) VALUES (?, ?, 'AJUSTE', ?, ?, 'local-user', ?, 'LOCAL', ?, ?)`,
    [generarId(), batchId, diferencia, motivo || 'Ajuste de inventario', now, now, now]
  )
}

/**
 * Registra pérdida/merma en un lote.
 * Reduce cantidad_actual_kg y registra movimiento MERMA (negativo).
 * Secuencial, NUNCA Promise.all.
 */
export async function registrarMerma(
  batchId: string,
  cantidadKg: number,
  motivo: string
): Promise<void> {
  const now = fechaActual()

  // 1. Leer datos actuales
  const rows = await consultarSQL<{
    cantidad_actual_kg: number
    fecha_vencimiento_estimada: string
    alerta_merma_dias: number
  }>(
    'SELECT cantidad_actual_kg, fecha_vencimiento_estimada, alerta_merma_dias FROM batch WHERE id = ?',
    [batchId]
  )
  if (rows.length === 0) return

  const { cantidad_actual_kg, fecha_vencimiento_estimada, alerta_merma_dias } = rows[0]
  const nuevaCantidad = Math.max(0, Math.round((cantidad_actual_kg - cantidadKg) * 1000) / 1000)
  const nuevoEstado = nuevaCantidad <= 0
    ? 'AGOTADO'
    : _calcularEstado(nuevaCantidad, fecha_vencimiento_estimada, alerta_merma_dias)

  // 2. UPDATE batch
  await ejecutarSQL(
    'UPDATE batch SET cantidad_actual_kg = ?, estado = ?, updated_at = ? WHERE id = ?',
    [nuevaCantidad, nuevoEstado, now, batchId]
  )

  // 3. INSERT stock_movement MERMA (negativo)
  await ejecutarSQL(
    `INSERT INTO stock_movement (
       id, batch_id, tipo, cantidad_kg, motivo,
       registrado_por, fecha, sync_status, created_at, updated_at
     ) VALUES (?, ?, 'MERMA', ?, ?, 'local-user', ?, 'LOCAL', ?, ?)`,
    [generarId(), batchId, -cantidadKg, motivo || 'Merma registrada', now, now, now]
  )
}

// ── Helper interno ─────────────────────────────────────────────────────────────

/** Calcula el estado del lote sin acceso a la DB (lógica espejada de loteUtils). */
function _calcularEstado(
  cantidadActual: number,
  fechaVencimiento: string,
  alertaMermaDias: number
): string {
  if (cantidadActual <= 0) return 'AGOTADO'
  const diasParaVencer = Math.ceil(
    (new Date(fechaVencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  if (diasParaVencer <= 0) return 'CRITICO'
  if (diasParaVencer <= alertaMermaDias) return 'ADVERTENCIA'
  return 'FRESCO'
}
