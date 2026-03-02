// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface VentaItem {
  producto_id: string
  nombre: string
  nombre_corto: string
  cantidad_kg: number
  precio_unitario: number
  subtotal: number
}

// ── Cálculos de venta ─────────────────────────────────────────────────────────

/** Suma los subtotales de todos los items. Resultado redondeado a 2 decimales. */
export function calcularTotalVenta(items: VentaItem[]): number {
  const total = items.reduce((sum, item) => sum + item.subtotal, 0)
  return Math.round(total * 100) / 100
}

/** Diferencia entre lo pagado y el total. Nunca negativo. */
export function calcularVuelto(totalVenta: number, montoPagado: number): number {
  return Math.max(0, Math.round((montoPagado - totalVenta) * 100) / 100)
}

/** Genera un número de ticket con ceros a la izquierda. Ej: "V-000001" */
export function generarNumeroTicket(prefijo: string, correlativo: number): string {
  return `${prefijo}-${correlativo.toString().padStart(6, '0')}`
}

/**
 * Peso neto = peso bruto − (tara × envases).
 * Si cantidadEnvases <= 0 retorna pesoBruto directamente.
 */
export function calcularPesoNeto(
  pesoBruto: number,
  pesoTara: number,
  cantidadEnvases: number
): number {
  if (cantidadEnvases <= 0) return pesoBruto
  return Math.round((pesoBruto - pesoTara * cantidadEnvases) * 100) / 100
}

/** Subtotal = peso neto × precio/kg, redondeado a 2 decimales. */
export function calcularSubtotal(pesoNetoKg: number, precioKg: number): number {
  return Math.round(pesoNetoKg * precioKg * 100) / 100
}
