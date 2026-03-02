import { consultarSQL, ejecutarSQL, generarId, fechaActual } from '../dbUtils'
import { generarNumeroTicket } from '../../core/ventas/ventaUtils'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ItemVentaData {
  product_id: string
  cantidad_kg: number
  precio_unitario: number
  subtotal: number
  batch_id?: string | null
}

export interface NuevaVentaData {
  business_id: string
  branch_id: string
  user_id: string
  client_id: string | null
  metodo_pago: 'EFECTIVO' | 'YAPE' | 'CREDITO'
  items: ItemVentaData[]
  fecha_vencimiento_credito?: string | null
}

export interface VentaResumenRow {
  id: string
  numero_ticket: string
  fecha: string
  total: number
  metodo_pago: string
  estado_pago: string
  cliente_nombre: string | null
}

export interface ResumenDia {
  cantidad_ventas: number
  total_dia: number
  total_contado: number
  total_yape: number
  total_credito: number
  ticket_promedio: number
}

export interface VentaDetalleRow {
  id: string
  sale_id: string
  product_id: string
  producto_nombre: string
  cantidad_kg: number
  precio_unitario: number
  subtotal: number
}

// ── Helpers internos ──────────────────────────────────────────────────────────

/** Lee el correlativo actual, lo incrementa y lo persiste. */
async function obtenerSiguienteCorrelativo(businessId: string): Promise<number> {
  const rows = await consultarSQL<{ valor: string }>(
    `SELECT valor FROM configuracion WHERE business_id = ? AND clave = 'correlativo_venta'`,
    [businessId]
  )
  const actual = parseInt(rows[0]?.valor ?? '0', 10)
  const siguiente = actual + 1
  await ejecutarSQL(
    `UPDATE configuracion SET valor = ?, updated_at = ? WHERE business_id = ? AND clave = 'correlativo_venta'`,
    [siguiente.toString(), fechaActual(), businessId]
  )
  return siguiente
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Registra una venta completa:
 * 1. Obtiene correlativo
 * 2. INSERT sale
 * 3. INSERT sale_item por cada línea (secuencial)
 * 4. Si es CRÉDITO: actualiza saldo en credit_profile
 *
 * NUNCA usa Promise.all — todo secuencial con await.
 */
export async function registrarVenta(data: NuevaVentaData): Promise<string> {
  const id = generarId()
  const now = fechaActual()

  const correlativo = await obtenerSiguienteCorrelativo(data.business_id)
  const numeroTicket = generarNumeroTicket('V', correlativo)

  const subtotal = Math.round(
    data.items.reduce((sum, item) => sum + item.subtotal, 0) * 100
  ) / 100
  const total = subtotal

  const estadoPago = data.metodo_pago === 'CREDITO' ? 'CREDITO' : 'PAGADO'
  const montoPagado = estadoPago === 'PAGADO' ? total : 0
  const montoPendiente = estadoPago === 'CREDITO' ? total : 0

  // 1. INSERT sale
  await ejecutarSQL(
    `INSERT INTO sale (
       id, business_id, branch_id, user_id, client_id,
       numero_ticket, fecha,
       subtotal, descuento, total,
       metodo_pago, estado_pago, monto_pagado, monto_pendiente,
       fecha_vencimiento_credito,
       sync_status, device_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 'LOCAL', 'local-device', ?, ?)`,
    [
      id,
      data.business_id,
      data.branch_id,
      data.user_id,
      data.client_id,
      numeroTicket,
      now,
      subtotal,
      total,
      data.metodo_pago,
      estadoPago,
      montoPagado,
      montoPendiente,
      data.fecha_vencimiento_credito ?? null,
      now,
      now,
    ]
  )

  // 2. INSERT sale_item por cada línea (secuencial, nunca Promise.all)
  for (const item of data.items) {
    await ejecutarSQL(
      `INSERT INTO sale_item (
         id, sale_id, product_id, batch_id,
         cantidad, unidad_venta,
         peso_bruto_kg, peso_tara_kg, peso_neto_kg,
         precio_unitario, subtotal,
         sync_status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 'KG', ?, 0, ?, ?, ?, 'LOCAL', ?, ?)`,
      [
        generarId(),
        id,
        item.product_id,
        item.batch_id ?? null,
        item.cantidad_kg,
        item.cantidad_kg,  // peso_bruto_kg
        item.cantidad_kg,  // peso_neto_kg
        item.precio_unitario,
        item.subtotal,
        now,
        now,
      ]
    )
  }

  // 3. Si es crédito: actualizar saldo del cliente en credit_profile
  if (data.metodo_pago === 'CREDITO' && data.client_id) {
    await ejecutarSQL(
      `UPDATE credit_profile
         SET saldo_actual = saldo_actual + ?,
             total_historico_credito = total_historico_credito + ?,
             updated_at = ?
       WHERE client_id = ?`,
      [total, total, now, data.client_id]
    )
  }

  return id
}

export async function obtenerVentasDelDia(businessId: string): Promise<VentaResumenRow[]> {
  return consultarSQL<VentaResumenRow>(
    `SELECT
       s.id, s.numero_ticket, s.fecha, s.total, s.metodo_pago, s.estado_pago,
       c.nombre AS cliente_nombre
     FROM sale s
     LEFT JOIN client c ON c.id = s.client_id
     WHERE s.business_id = ? AND date(s.fecha) = date('now')
     ORDER BY s.created_at DESC`,
    [businessId]
  )
}

export async function obtenerVentaPorId(
  id: string
): Promise<{ venta: VentaResumenRow | null; items: VentaDetalleRow[] }> {
  const ventas = await consultarSQL<VentaResumenRow>(
    `SELECT s.id, s.numero_ticket, s.fecha, s.total, s.metodo_pago, s.estado_pago,
            c.nombre AS cliente_nombre
     FROM sale s
     LEFT JOIN client c ON c.id = s.client_id
     WHERE s.id = ?`,
    [id]
  )
  const items = await consultarSQL<VentaDetalleRow>(
    `SELECT si.id, si.sale_id, si.product_id,
            p.nombre AS producto_nombre,
            si.peso_neto_kg AS cantidad_kg,
            si.precio_unitario, si.subtotal
     FROM sale_item si
     JOIN product p ON p.id = si.product_id
     WHERE si.sale_id = ?`,
    [id]
  )
  return { venta: ventas[0] ?? null, items }
}

export async function obtenerResumenDia(businessId: string): Promise<ResumenDia> {
  const rows = await consultarSQL<ResumenDia>(
    `SELECT
       COUNT(*)                                                               AS cantidad_ventas,
       COALESCE(SUM(total), 0)                                               AS total_dia,
       COALESCE(SUM(CASE WHEN metodo_pago = 'EFECTIVO' THEN total ELSE 0 END), 0) AS total_contado,
       COALESCE(SUM(CASE WHEN metodo_pago = 'YAPE'     THEN total ELSE 0 END), 0) AS total_yape,
       COALESCE(SUM(CASE WHEN metodo_pago = 'CREDITO'  THEN total ELSE 0 END), 0) AS total_credito,
       COALESCE(AVG(total), 0)                                               AS ticket_promedio
     FROM sale
     WHERE business_id = ? AND date(fecha) = date('now')`,
    [businessId]
  )
  return rows[0] ?? {
    cantidad_ventas: 0,
    total_dia: 0,
    total_contado: 0,
    total_yape: 0,
    total_credito: 0,
    ticket_promedio: 0,
  }
}
