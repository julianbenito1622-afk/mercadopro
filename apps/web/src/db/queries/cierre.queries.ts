import { consultarSQL } from '../dbUtils'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ResumenVentasDia {
  cantidad_ventas: number
  total_dia: number
  ticket_promedio: number
  total_contado: number
  total_yape: number
  total_credito: number
}

export interface ProductoVendidoRow {
  nombre: string
  cantidad_kg: number
  monto_total: number
}

export interface VentaCierreRow {
  id: string
  fecha: string
  total: number
  metodo_pago: string
  estado_pago: string
  cliente_nombre: string | null
}

export interface CreditosHoyRow {
  total_credito: number
  cantidad_clientes: number
}

export interface CobrosHoyRow {
  total_cobrado: number
  cantidad_pagos: number
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function obtenerResumenVentasDia(
  businessId: string,
  fecha: string
): Promise<ResumenVentasDia> {
  const rows = await consultarSQL<ResumenVentasDia>(
    `SELECT
       COUNT(*)                                                                    AS cantidad_ventas,
       COALESCE(SUM(total), 0)                                                    AS total_dia,
       COALESCE(AVG(total), 0)                                                    AS ticket_promedio,
       COALESCE(SUM(CASE WHEN metodo_pago = 'EFECTIVO' THEN total ELSE 0 END), 0) AS total_contado,
       COALESCE(SUM(CASE WHEN metodo_pago = 'YAPE'     THEN total ELSE 0 END), 0) AS total_yape,
       COALESCE(SUM(CASE WHEN metodo_pago = 'CREDITO'  THEN total ELSE 0 END), 0) AS total_credito
     FROM sale
     WHERE business_id = ? AND date(fecha) = date(?)`,
    [businessId, fecha]
  )
  return rows[0] ?? {
    cantidad_ventas: 0,
    total_dia: 0,
    ticket_promedio: 0,
    total_contado: 0,
    total_yape: 0,
    total_credito: 0,
  }
}

export async function obtenerProductosMasVendidos(
  businessId: string,
  fecha: string,
  limite: number
): Promise<ProductoVendidoRow[]> {
  return consultarSQL<ProductoVendidoRow>(
    `SELECT p.nombre,
            COALESCE(SUM(si.peso_neto_kg), 0) AS cantidad_kg,
            COALESCE(SUM(si.subtotal), 0)     AS monto_total
     FROM sale_item si
     JOIN product p ON p.id = si.product_id
     JOIN sale s    ON s.id = si.sale_id
     WHERE s.business_id = ? AND date(s.fecha) = date(?)
     GROUP BY si.product_id, p.nombre
     ORDER BY cantidad_kg DESC
     LIMIT ?`,
    [businessId, fecha, limite]
  )
}

export async function obtenerVentasDelDia(
  businessId: string,
  fecha: string
): Promise<VentaCierreRow[]> {
  return consultarSQL<VentaCierreRow>(
    `SELECT s.id, s.fecha, s.total, s.metodo_pago, s.estado_pago,
            c.nombre AS cliente_nombre
     FROM sale s
     LEFT JOIN client c ON c.id = s.client_id
     WHERE s.business_id = ? AND date(s.fecha) = date(?)
     ORDER BY s.fecha DESC`,
    [businessId, fecha]
  )
}

export async function obtenerCreditosOtorgadosHoy(
  businessId: string,
  fecha: string
): Promise<CreditosHoyRow> {
  const rows = await consultarSQL<CreditosHoyRow>(
    `SELECT COALESCE(SUM(total), 0)         AS total_credito,
            COUNT(DISTINCT client_id)        AS cantidad_clientes
     FROM sale
     WHERE business_id = ? AND date(fecha) = date(?) AND metodo_pago = 'CREDITO'`,
    [businessId, fecha]
  )
  return rows[0] ?? { total_credito: 0, cantidad_clientes: 0 }
}

export async function obtenerCobrosRecibidosHoy(
  businessId: string,
  fecha: string
): Promise<CobrosHoyRow> {
  const rows = await consultarSQL<CobrosHoyRow>(
    `SELECT COALESCE(SUM(p.monto), 0) AS total_cobrado,
            COUNT(*)                   AS cantidad_pagos
     FROM payment p
     JOIN client c ON c.id = p.client_id
     WHERE c.business_id = ? AND date(p.fecha) = date(?)`,
    [businessId, fecha]
  )
  return rows[0] ?? { total_cobrado: 0, cantidad_pagos: 0 }
}
