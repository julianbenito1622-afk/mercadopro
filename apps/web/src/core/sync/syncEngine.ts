/**
 * MercadoPro — Motor de Sincronización Offline→Cloud
 *
 * Flujo:
 *  1. PUSH: leer sync_log con estado='PENDIENTE' → enviar al servidor → marcar como APLICADO
 *  2. PULL: pedir cambios del servidor desde última sync → aplicar en SQLite local
 *
 * Se ejecuta al recuperar conexión y opcionalmente en intervalos.
 */

import { consultarSQL, ejecutarSQL, generarId, fechaActual } from '../../db/dbUtils'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const DEVICE_ID = obtenerDeviceId()

// ── Tipos internos ────────────────────────────────────────────────────────────

interface RegistroPendiente {
  id: string
  tabla: string
  registro_id: string
  operacion: string
  datos_json: string
  timestamp_local: string
  intentos: number
}

interface ResultadoPush {
  id: string
  estado: 'OK' | 'ERROR'
  error?: string
}

interface CambiosServidor {
  timestamp: string
  cambios: Record<string, Record<string, unknown>[]>
}

// ── Estado del motor ──────────────────────────────────────────────────────────

let sincronizando = false
let ultimaSync: string | null = localStorage.getItem('mercadopro:ultima_sync')

// ── Helpers ───────────────────────────────────────────────────────────────────

function obtenerDeviceId(): string {
  let deviceId = localStorage.getItem('mercadopro:device_id')
  if (!deviceId) {
    deviceId = `device-${crypto.randomUUID()}`
    localStorage.setItem('mercadopro:device_id', deviceId)
  }
  return deviceId
}

function obtenerToken(): string | null {
  return localStorage.getItem('mercadopro:token')
}

async function fetchApi(path: string, options: RequestInit = {}): Promise<Response> {
  const token = obtenerToken()
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
}

// ── Registrar cambio en sync_log local ───────────────────────────────────────

export async function registrarCambioLocal(
  tabla: string,
  registroId: string,
  operacion: 'INSERT' | 'UPDATE' | 'DELETE',
  datos: Record<string, unknown>
): Promise<void> {
  const now = fechaActual()
  await ejecutarSQL(
    `INSERT INTO sync_log (id, device_id, tabla, registro_id, operacion, datos_json, timestamp_local, estado, intentos, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', 0, ?, ?)`,
    [generarId(), DEVICE_ID, tabla, registroId, operacion, JSON.stringify(datos), now, now, now]
  )
}

// ── PUSH: enviar cambios locales al servidor ──────────────────────────────────

async function pushCambios(): Promise<{ exitosos: number; fallidos: number }> {
  const pendientes = await consultarSQL<RegistroPendiente>(
    `SELECT id, tabla, registro_id, operacion, datos_json, timestamp_local, intentos
     FROM sync_log WHERE estado = 'PENDIENTE' ORDER BY timestamp_local ASC LIMIT 100`
  )

  if (pendientes.length === 0) return { exitosos: 0, fallidos: 0 }

  const registros = pendientes.map((p) => ({
    id: p.id,
    tabla: p.tabla,
    operacion: p.operacion as 'INSERT' | 'UPDATE' | 'DELETE',
    datos: JSON.parse(p.datos_json) as Record<string, unknown>,
    timestampLocal: p.timestamp_local,
  }))

  try {
    const resp = await fetchApi('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ deviceId: DEVICE_ID, registros }),
    })

    if (!resp.ok) {
      console.error('[Sync] Push falló:', resp.status, await resp.text())
      return { exitosos: 0, fallidos: pendientes.length }
    }

    const { resultados } = await resp.json() as { resultados: ResultadoPush[] }
    const now = fechaActual()

    let exitosos = 0
    let fallidos = 0

    for (const resultado of resultados) {
      if (resultado.estado === 'OK') {
        await ejecutarSQL(
          `UPDATE sync_log SET estado='APLICADO', timestamp_servidor=?, updated_at=? WHERE id=?`,
          [now, now, resultado.id]
        )
        exitosos++
      } else {
        const pendiente = pendientes.find((p) => p.id === resultado.id)
        const intentos = (pendiente?.intentos ?? 0) + 1
        const nuevoEstado = intentos >= 3 ? 'ERROR_PERMANENTE' : 'PENDIENTE'
        await ejecutarSQL(
          `UPDATE sync_log SET estado=?, intentos=?, error=?, updated_at=? WHERE id=?`,
          [nuevoEstado, intentos, resultado.error ?? null, now, resultado.id]
        )
        fallidos++
      }
    }

    return { exitosos, fallidos }
  } catch (err) {
    console.error('[Sync] Error de red en push:', err)
    return { exitosos: 0, fallidos: pendientes.length }
  }
}

// ── PULL: recibir cambios del servidor ────────────────────────────────────────

// Tablas que NO tienen businessId directo — no se pueden filtrar igual
const TABLAS_APLICABLES = [
  'category', 'supplier', 'product', 'client',
  'credit_profile', 'batch', 'stock_movement',
  'sale', 'sale_item', 'payment', 'price_history',
]

// Mapeo tabla → columnas para upsert (sin business_id — viene del servidor ya filtrado)
const TABLAS_SQL: Record<string, { columnas: string[]; pk: string }> = {
  category:       { pk: 'id', columnas: ['id', 'business_id', 'nombre', 'orden', 'sync_status', 'created_at', 'updated_at'] },
  supplier:       { pk: 'id', columnas: ['id', 'business_id', 'nombre', 'celular', 'tipo', 'zona_origen', 'comision_consignacion', 'sync_status', 'created_at', 'updated_at'] },
  product:        { pk: 'id', columnas: ['id', 'business_id', 'category_id', 'nombre', 'nombre_corto', 'unidad_venta_principal', 'unidad_base', 'precio_venta_actual', 'requiere_pesaje', 'vida_util_dias', 'activo', 'es_pantalla_rapida', 'orden_pantalla', 'sync_status', 'created_at', 'updated_at'] },
  client:         { pk: 'id', columnas: ['id', 'business_id', 'nombre', 'nombre_corto', 'celular', 'tipo', 'dni_ruc', 'direccion', 'es_frecuente', 'orden_pantalla', 'activo', 'sync_status', 'created_at', 'updated_at'] },
  credit_profile: { pk: 'id', columnas: ['id', 'client_id', 'limite_credito', 'plazo_dias', 'saldo_actual', 'score', 'estado', 'fecha_ultimo_pago', 'total_historico_credito', 'total_historico_pagado', 'veces_moroso', 'sync_status', 'created_at', 'updated_at'] },
  batch:          { pk: 'id', columnas: ['id', 'business_id', 'branch_id', 'product_id', 'supplier_id', 'tipo_ingreso', 'fecha_entrada', 'cantidad_inicial_kg', 'cantidad_actual_kg', 'costo_unitario', 'costo_total', 'envases_cantidad', 'fecha_vencimiento_estimada', 'estado', 'alerta_merma_dias', 'notas', 'sync_status', 'created_at', 'updated_at'] },
  stock_movement: { pk: 'id', columnas: ['id', 'batch_id', 'tipo', 'cantidad_kg', 'motivo', 'sale_item_id', 'registrado_por', 'fecha', 'sync_status', 'created_at', 'updated_at'] },
  sale:           { pk: 'id', columnas: ['id', 'business_id', 'branch_id', 'user_id', 'client_id', 'numero_ticket', 'fecha', 'subtotal', 'descuento', 'total', 'metodo_pago', 'estado_pago', 'monto_pagado', 'monto_pendiente', 'fecha_vencimiento_credito', 'notas', 'sync_status', 'device_id', 'created_at', 'updated_at'] },
  sale_item:      { pk: 'id', columnas: ['id', 'sale_id', 'product_id', 'batch_id', 'cantidad', 'unidad_venta', 'peso_bruto_kg', 'peso_tara_kg', 'peso_neto_kg', 'precio_unitario', 'subtotal', 'sync_status', 'created_at', 'updated_at'] },
  payment:        { pk: 'id', columnas: ['id', 'client_id', 'sale_id', 'monto', 'metodo', 'fecha', 'referencia', 'notas', 'registrado_por', 'sync_status', 'created_at', 'updated_at'] },
  price_history:  { pk: 'id', columnas: ['id', 'product_id', 'precio_anterior', 'precio_nuevo', 'fecha', 'registrado_por', 'sync_status', 'created_at', 'updated_at'] },
}

async function pullCambios(): Promise<number> {
  try {
    const params = new URLSearchParams({ tablas: TABLAS_APLICABLES.join(',') })
    if (ultimaSync) params.set('desde', ultimaSync)

    const resp = await fetchApi(`/sync/pull?${params}`)
    if (!resp.ok) {
      console.error('[Sync] Pull falló:', resp.status)
      return 0
    }

    const data = await resp.json() as CambiosServidor
    let totalAplicados = 0

    for (const tabla of TABLAS_APLICABLES) {
      const registros = data.cambios[tabla]
      if (!registros || registros.length === 0) continue

      const config = TABLAS_SQL[tabla]
      if (!config) continue

      for (const registro of registros) {
        try {
          const columnas = config.columnas.filter((c) => registro[c] !== undefined)
          const valores = columnas.map((c) => {
            const v = registro[c]
            if (v === null || v === undefined) return null
            if (typeof v === 'boolean') return v ? 1 : 0
            return v as string | number
          })

          const setClause = columnas.map((c) => `${c} = ?`).join(', ')
          const placeholders = columnas.map(() => '?').join(', ')

          await ejecutarSQL(
            `INSERT OR REPLACE INTO ${tabla} (${columnas.join(', ')}) VALUES (${placeholders})
             ON CONFLICT(${config.pk}) DO UPDATE SET ${setClause}`,
            [...valores, ...valores]
          )
          totalAplicados++
        } catch (err) {
          console.error(`[Sync] Error aplicando registro en ${tabla}:`, err)
        }
      }
    }

    // Guardar timestamp de última sync exitosa
    ultimaSync = data.timestamp
    localStorage.setItem('mercadopro:ultima_sync', data.timestamp)

    return totalAplicados
  } catch (err) {
    console.error('[Sync] Error de red en pull:', err)
    return 0
  }
}

// ── Motor principal ───────────────────────────────────────────────────────────

export interface ResultadoSync {
  pushExitosos: number
  pushFallidos: number
  pullAplicados: number
  timestamp: string
}

export async function sincronizar(): Promise<ResultadoSync | null> {
  if (!API_URL) return null
  if (!obtenerToken()) return null
  if (sincronizando) return null
  if (!navigator.onLine) return null

  sincronizando = true
  try {
    const { exitosos: pushExitosos, fallidos: pushFallidos } = await pushCambios()
    const pullAplicados = await pullCambios()

    const resultado: ResultadoSync = {
      pushExitosos,
      pushFallidos,
      pullAplicados,
      timestamp: new Date().toISOString(),
    }

    if (pushExitosos > 0 || pullAplicados > 0) {
      console.info(
        `[Sync] ✓ Push: ${pushExitosos} OK, ${pushFallidos} error | Pull: ${pullAplicados} aplicados`
      )
    }

    return resultado
  } finally {
    sincronizando = false
  }
}

// ── Listener de conectividad ──────────────────────────────────────────────────

export function iniciarSyncAutomatico(intervaloMs = 60_000): () => void {
  // Sync inmediata al recuperar conexión
  const handleOnline = () => {
    console.info('[Sync] Conexión recuperada — sincronizando...')
    sincronizar().catch(console.error)
  }
  window.addEventListener('online', handleOnline)

  // Sync periódica
  const intervalo = setInterval(() => {
    sincronizar().catch(console.error)
  }, intervaloMs)

  // Retorna función de limpieza
  return () => {
    window.removeEventListener('online', handleOnline)
    clearInterval(intervalo)
  }
}

// ── Helpers públicos ──────────────────────────────────────────────────────────

export function estaOnline(): boolean {
  return navigator.onLine
}

export function getUltimaSync(): string | null {
  return ultimaSync
}

export function getPendientesSinc(): Promise<number> {
  return consultarSQL<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_log WHERE estado = 'PENDIENTE'`
  ).then((rows) => rows[0]?.count ?? 0)
}
