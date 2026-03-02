import { consultarSQL, ejecutarSQL, generarId, fechaActual } from '../dbUtils'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ClienteCarteraRow {
  id: string
  nombre: string
  celular: string | null
  saldo_actual: number
  plazo_dias: number
  score: number
  estado_credito: string
  fecha_venta_mas_antigua: string | null
}

export interface VentaDeudaRow {
  id: string
  fecha: string
  monto: number
  monto_pendiente: number
  dias_transcurridos: number
}

export interface PagoRow {
  id: string
  monto: number
  metodo: string
  fecha: string
  referencia: string | null
}

export interface ResumenCartera {
  total_por_cobrar: number
  total_vencido: number
  cantidad_clientes: number
  cliente_mayor_nombre: string | null
  cliente_mayor_monto: number
}

export interface RegistrarPagoData {
  clientId: string
  monto: number
  metodo: 'EFECTIVO' | 'YAPE' | 'TRANSFERENCIA'
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function obtenerCartera(businessId: string): Promise<ClienteCarteraRow[]> {
  return consultarSQL<ClienteCarteraRow>(
    `SELECT c.id, c.nombre, c.celular,
            cp.saldo_actual, cp.plazo_dias, cp.score,
            COALESCE(cp.estado, 'ACTIVO') AS estado_credito,
            (SELECT MIN(s2.fecha) FROM sale s2
             WHERE s2.client_id = c.id AND s2.monto_pendiente > 0) AS fecha_venta_mas_antigua
     FROM client c
     JOIN credit_profile cp ON cp.client_id = c.id
     WHERE c.business_id = ? AND c.activo = 1 AND cp.saldo_actual > 0
     ORDER BY cp.saldo_actual DESC`,
    [businessId]
  )
}

export async function obtenerDetalleDeuda(clientId: string): Promise<VentaDeudaRow[]> {
  return consultarSQL<VentaDeudaRow>(
    `SELECT id, fecha, total AS monto, monto_pendiente,
            CAST(julianday('now') - julianday(fecha) AS INTEGER) AS dias_transcurridos
     FROM sale
     WHERE client_id = ? AND monto_pendiente > 0
     ORDER BY fecha ASC`,
    [clientId]
  )
}

/**
 * Registra un pago:
 * 1. INSERT en payment
 * 2. UPDATE credit_profile.saldo_actual restando el monto pagado
 * Secuencial, NUNCA Promise.all.
 */
export async function registrarPago(data: RegistrarPagoData): Promise<void> {
  const id = generarId()
  const now = fechaActual()

  // 1. INSERT en payment
  await ejecutarSQL(
    `INSERT INTO payment (
       id, client_id, sale_id, monto, metodo, fecha,
       referencia, notas, registrado_por,
       sync_status, created_at, updated_at
     ) VALUES (?, ?, NULL, ?, ?, ?, NULL, NULL, 'local-user', 'LOCAL', ?, ?)`,
    [id, data.clientId, data.monto, data.metodo, now, now, now]
  )

  // 2. UPDATE credit_profile.saldo_actual
  await ejecutarSQL(
    `UPDATE credit_profile
       SET saldo_actual           = MAX(0, saldo_actual - ?),
           fecha_ultimo_pago      = ?,
           total_historico_pagado = total_historico_pagado + ?,
           updated_at             = ?
     WHERE client_id = ?`,
    [data.monto, now, data.monto, now, data.clientId]
  )
}

export async function obtenerPagosCliente(clientId: string, limite: number): Promise<PagoRow[]> {
  return consultarSQL<PagoRow>(
    `SELECT id, monto, metodo, fecha, referencia
     FROM payment
     WHERE client_id = ?
     ORDER BY fecha DESC
     LIMIT ?`,
    [clientId, limite]
  )
}

export async function obtenerResumenCartera(businessId: string): Promise<ResumenCartera> {
  // 1. Total por cobrar + cantidad clientes
  const totalesRows = await consultarSQL<{ total_por_cobrar: number; cantidad_clientes: number }>(
    `SELECT COALESCE(SUM(cp.saldo_actual), 0) AS total_por_cobrar,
            COUNT(*) AS cantidad_clientes
     FROM client c
     JOIN credit_profile cp ON cp.client_id = c.id
     WHERE c.business_id = ? AND c.activo = 1 AND cp.saldo_actual > 0`,
    [businessId]
  )

  // 2. Total vencido (ventas cuyo plazo ya pasó)
  const vencidoRows = await consultarSQL<{ total_vencido: number }>(
    `SELECT COALESCE(SUM(s.monto_pendiente), 0) AS total_vencido
     FROM sale s
     JOIN client c ON c.id = s.client_id
     JOIN credit_profile cp ON cp.client_id = s.client_id
     WHERE c.business_id = ? AND s.monto_pendiente > 0
       AND CAST(julianday('now') - julianday(s.fecha) AS INTEGER) > cp.plazo_dias`,
    [businessId]
  )

  // 3. Cliente con mayor deuda
  const mayorRows = await consultarSQL<{ nombre: string; saldo_actual: number }>(
    `SELECT c.nombre, cp.saldo_actual
     FROM client c
     JOIN credit_profile cp ON cp.client_id = c.id
     WHERE c.business_id = ? AND c.activo = 1 AND cp.saldo_actual > 0
     ORDER BY cp.saldo_actual DESC
     LIMIT 1`,
    [businessId]
  )

  return {
    total_por_cobrar: totalesRows[0]?.total_por_cobrar ?? 0,
    total_vencido: vencidoRows[0]?.total_vencido ?? 0,
    cantidad_clientes: totalesRows[0]?.cantidad_clientes ?? 0,
    cliente_mayor_nombre: mayorRows[0]?.nombre ?? null,
    cliente_mayor_monto: mayorRows[0]?.saldo_actual ?? 0,
  }
}
