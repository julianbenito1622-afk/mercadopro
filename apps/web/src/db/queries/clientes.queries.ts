import { consultarSQL, ejecutarSQL, generarId, fechaActual } from '../dbUtils'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ClienteRow {
  id: string
  business_id: string
  nombre: string
  nombre_corto: string
  celular: string | null
  tipo: string
  dni_ruc: string | null
  direccion: string | null
  es_frecuente: number
  orden_pantalla: number
  activo: number
  // de credit_profile (LEFT JOIN)
  limite_credito: number
  plazo_dias: number
  saldo_actual: number
  score: number
  estado_credito: string
  fecha_ultimo_pago: string | null
  total_historico_credito: number
  total_historico_pagado: number
  veces_moroso: number
}

export interface PagoRow {
  id: string
  monto: number
  metodo: string
  fecha: string
  referencia: string | null
}

export interface NuevoClienteData {
  business_id: string
  nombre: string
  nombre_corto: string
  celular?: string | null
  tipo?: string
  dni_ruc?: string | null
  direccion?: string | null
  limite_credito?: number
  plazo_dias?: number
}

export interface ActualizarClienteData {
  nombre?: string
  nombre_corto?: string
  celular?: string | null
  tipo?: string
  dni_ruc?: string | null
  direccion?: string | null
}

export interface ActualizarCreditProfileData {
  limite_credito?: number
  plazo_dias?: number
  estado?: string
}

// ── Queries ───────────────────────────────────────────────────────────────────

const SELECT_CLIENTE = `
  SELECT
    c.id, c.business_id, c.nombre, c.nombre_corto, c.celular, c.tipo,
    c.dni_ruc, c.direccion, c.es_frecuente, c.orden_pantalla, c.activo,
    COALESCE(cp.limite_credito, 0)          AS limite_credito,
    COALESCE(cp.plazo_dias, 3)              AS plazo_dias,
    COALESCE(cp.saldo_actual, 0)            AS saldo_actual,
    COALESCE(cp.score, 50)                  AS score,
    COALESCE(cp.estado, 'ACTIVO')           AS estado_credito,
    cp.fecha_ultimo_pago,
    COALESCE(cp.total_historico_credito, 0) AS total_historico_credito,
    COALESCE(cp.total_historico_pagado, 0)  AS total_historico_pagado,
    COALESCE(cp.veces_moroso, 0)            AS veces_moroso
  FROM client c
  LEFT JOIN credit_profile cp ON cp.client_id = c.id
`

export async function obtenerClientes(businessId: string): Promise<ClienteRow[]> {
  return consultarSQL<ClienteRow>(
    `${SELECT_CLIENTE}
     WHERE c.activo = 1 AND c.business_id = ?
     ORDER BY c.nombre`,
    [businessId]
  )
}

export async function obtenerClientesPantalla(businessId: string): Promise<ClienteRow[]> {
  return consultarSQL<ClienteRow>(
    `${SELECT_CLIENTE}
     WHERE c.activo = 1 AND c.business_id = ?
     ORDER BY c.es_frecuente DESC, cp.total_historico_credito DESC, c.nombre
     LIMIT 12`,
    [businessId]
  )
}

export async function obtenerClientePorId(id: string): Promise<ClienteRow | null> {
  const rows = await consultarSQL<ClienteRow>(
    `${SELECT_CLIENTE} WHERE c.id = ?`,
    [id]
  )
  return rows[0] ?? null
}

export async function crearCliente(data: NuevoClienteData): Promise<string> {
  const id = generarId()
  const now = fechaActual()

  // 1. Insertar cliente
  await ejecutarSQL(
    `INSERT INTO client (
       id, business_id, nombre, nombre_corto, celular, tipo,
       dni_ruc, direccion, es_frecuente, orden_pantalla, activo,
       sync_status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, 'LOCAL', ?, ?)`,
    [
      id,
      data.business_id,
      data.nombre,
      data.nombre_corto,
      data.celular ?? null,
      data.tipo ?? 'MINORISTA',
      data.dni_ruc ?? null,
      data.direccion ?? null,
      now,
      now,
    ]
  )

  // 2. Crear perfil de crédito inicial (secuencial, nunca Promise.all)
  await ejecutarSQL(
    `INSERT INTO credit_profile (
       id, client_id, limite_credito, plazo_dias, saldo_actual,
       score, estado, sync_status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 0, 50, 'ACTIVO', 'LOCAL', ?, ?)`,
    [
      generarId(),
      id,
      data.limite_credito ?? 500,
      data.plazo_dias ?? 3,
      now,
      now,
    ]
  )

  return id
}

export async function actualizarCliente(
  id: string,
  data: ActualizarClienteData
): Promise<void> {
  const campos = Object.keys(data) as (keyof ActualizarClienteData)[]
  if (campos.length === 0) return
  const now = fechaActual()
  const sets = campos.map(k => `${k} = ?`).join(', ')
  const valores: (string | number | null)[] = campos.map(
    k => data[k] as string | number | null
  )
  await ejecutarSQL(
    `UPDATE client SET ${sets}, updated_at = ? WHERE id = ?`,
    [...valores, now, id]
  )
}

export async function actualizarCreditProfile(
  clientId: string,
  data: ActualizarCreditProfileData
): Promise<void> {
  const campos = Object.keys(data) as (keyof ActualizarCreditProfileData)[]
  if (campos.length === 0) return
  const now = fechaActual()
  const sets = campos.map(k => `${k} = ?`).join(', ')
  const valores: (string | number | null)[] = campos.map(
    k => data[k] as string | number | null
  )
  await ejecutarSQL(
    `UPDATE credit_profile SET ${sets}, updated_at = ? WHERE client_id = ?`,
    [...valores, now, clientId]
  )
}

export async function obtenerDeudaCliente(clientId: string): Promise<number> {
  const rows = await consultarSQL<{ deuda_total: number }>(
    `SELECT COALESCE(SUM(monto_pendiente), 0) AS deuda_total
     FROM sale
     WHERE client_id = ? AND monto_pendiente > 0`,
    [clientId]
  )
  return rows[0]?.deuda_total ?? 0
}

export async function obtenerUltimosPagos(clientId: string): Promise<PagoRow[]> {
  return consultarSQL<PagoRow>(
    `SELECT id, monto, metodo, fecha, referencia
     FROM payment
     WHERE client_id = ?
     ORDER BY fecha DESC
     LIMIT 5`,
    [clientId]
  )
}

export async function desactivarCliente(id: string): Promise<void> {
  await ejecutarSQL(
    'UPDATE client SET activo = 0, updated_at = ? WHERE id = ?',
    [fechaActual(), id]
  )
}
