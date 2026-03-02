// ── Tipos ─────────────────────────────────────────────────────────────────────

export type EstadoLote = 'FRESCO' | 'ADVERTENCIA' | 'CRITICO' | 'AGOTADO' | 'MERMA_TOTAL'

// ── Estado del lote ───────────────────────────────────────────────────────────

/**
 * Calcula el estado de un lote a partir de la cantidad disponible y días para vencer.
 *
 * AGOTADO:     cantidadActualKg <= 0
 * CRITICO:     diasParaVencer <= 0  (ya venció o vence hoy)
 * ADVERTENCIA: diasParaVencer <= alertaMermaDias
 * FRESCO:      diasParaVencer > alertaMermaDias
 */
export function calcularEstadoLote(
  cantidadActualKg: number,
  diasParaVencer: number,
  alertaMermaDias: number
): EstadoLote {
  if (cantidadActualKg <= 0) return 'AGOTADO'
  if (diasParaVencer <= 0) return 'CRITICO'
  if (diasParaVencer <= alertaMermaDias) return 'ADVERTENCIA'
  return 'FRESCO'
}

// ── Vencimiento ───────────────────────────────────────────────────────────────

/**
 * Calcula cuántos días faltan hasta la fecha de vencimiento estimada.
 * Resultado negativo = ya venció.
 * Resultado 0 = vence hoy (menos de 24h restantes).
 */
export function calcularDiasParaVencer(fechaVencimientoIso: string): number {
  return Math.ceil(
    (new Date(fechaVencimientoIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
}

// ── Merma ─────────────────────────────────────────────────────────────────────

/**
 * Calcula el porcentaje de merma respecto a la cantidad inicial.
 * merma% = (inicial - actual) / inicial × 100
 * Redondeado a 1 decimal. Nunca negativo.
 */
export function calcularPorcentajeMerma(
  cantidadInicialKg: number,
  cantidadActualKg: number
): number {
  if (cantidadInicialKg <= 0) return 0
  const merma = ((cantidadInicialKg - cantidadActualKg) / cantidadInicialKg) * 100
  return Math.round(Math.max(0, merma) * 10) / 10
}

// ── Valor e inventario ────────────────────────────────────────────────────────

/**
 * Calcula el valor actual del lote en soles.
 * valor = cantidad_actual_kg × costo_unitario_kg
 * Redondeado a 2 decimales.
 */
export function calcularValorInventario(
  cantidadActualKg: number,
  costoUnitario: number
): number {
  return Math.round(cantidadActualKg * costoUnitario * 100) / 100
}

/**
 * Calcula el margen bruto porcentual entre precio de venta y costo.
 * margen% = ((precio - costo) / precio) × 100
 * Redondeado a 1 decimal. Devuelve 0 si precio <= 0.
 */
export function calcularMargen(precioVenta: number, costoUnitario: number): number {
  if (precioVenta <= 0) return 0
  return Math.round(((precioVenta - costoUnitario) / precioVenta) * 100 * 10) / 10
}

// ── Alerta ────────────────────────────────────────────────────────────────────

/**
 * Indica si el lote requiere atención inmediata:
 * - Agotado (cantidad <= 0)
 * - O próximo a vencer (diasParaVencer <= alertaMermaDias)
 */
export function estaEnAlerta(
  cantidadActualKg: number,
  diasParaVencer: number,
  alertaMermaDias: number
): boolean {
  if (cantidadActualKg <= 0) return true
  return diasParaVencer <= alertaMermaDias
}

// ── Formateo ──────────────────────────────────────────────────────────────────

/**
 * Formatea kilogramos con 1 decimal y separador de miles.
 * Ej: 1500.5 → "1,500.5 kg" | 25 → "25.0 kg"
 */
export function formatearKg(kg: number): string {
  const [entero, decimal] = kg.toFixed(1).split('.')
  const enteroFormateado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${enteroFormateado}.${decimal} kg`
}

/**
 * Texto relativo de días para vencer.
 *
 * diasParaVencer < 0  → "Venció hace N día(s)"
 * diasParaVencer = 0  → "Vence hoy"
 * diasParaVencer = 1  → "Mañana"
 * diasParaVencer > 1  → "N días"
 */
export function formatearDiasVencer(diasParaVencer: number): string {
  if (diasParaVencer < 0) {
    const abs = Math.abs(diasParaVencer)
    return `Venció hace ${abs} día${abs !== 1 ? 's' : ''}`
  }
  if (diasParaVencer === 0) return 'Vence hoy'
  if (diasParaVencer === 1) return 'Mañana'
  return `${diasParaVencer} días`
}
