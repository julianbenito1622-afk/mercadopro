// ── Verificación de crédito ───────────────────────────────────────────────────

/**
 * Verifica si se puede otorgar crédito para una nueva venta.
 * Regla: saldo actual + monto nueva venta <= límite de crédito.
 */
export function verificarCredito(
  saldoActual: number,
  montoNuevaVenta: number,
  limiteCredito: number
): { permitido: boolean; razon?: string } {
  if (montoNuevaVenta <= 0) {
    return { permitido: false, razon: 'El monto de la venta debe ser mayor a cero' }
  }
  if (saldoActual + montoNuevaVenta > limiteCredito) {
    const disponible = limiteCredito - saldoActual
    return {
      permitido: false,
      razon: `Límite excedido. Disponible: S/ ${disponible.toFixed(2)}`,
    }
  }
  return { permitido: true }
}

// ── Score de crédito ──────────────────────────────────────────────────────────

/**
 * Calcula el score de crédito del cliente (0-100).
 * - Pago rápido (diasPromedioPago bajo) sube el score.
 * - Más ventas históricas sube el score (hasta +20).
 * - Veces vencido baja el score fuertemente.
 */
export function calcularScore(
  diasPromedioPago: number,
  ventasTotales: number,
  vecesVencido: number
): number {
  const penaltyPago = Math.min(diasPromedioPago * 3, 60)
  const bonusVentas = Math.min(ventasTotales / 5, 20)
  const penaltyMoroso = vecesVencido * 10
  const score = 100 - penaltyPago + bonusVentas - penaltyMoroso
  return Math.max(0, Math.min(100, Math.round(score)))
}

// ── Estado de crédito ─────────────────────────────────────────────────────────

/**
 * Determina el estado del crédito según los días vencidos.
 *
 * diasVencido <= 0  → AL_DIA
 * diasVencido 1-4   → POR_VENCER
 * diasVencido 5-13  → VENCIDO
 * diasVencido >= 14 → BLOQUEADO
 */
export function obtenerEstadoCredito(
  diasVencido: number
): 'AL_DIA' | 'POR_VENCER' | 'VENCIDO' | 'BLOQUEADO' {
  if (diasVencido <= 0) return 'AL_DIA'
  if (diasVencido <= 4) return 'POR_VENCER'
  if (diasVencido <= 13) return 'VENCIDO'
  return 'BLOQUEADO'
}

// ── Formato de deuda ──────────────────────────────────────────────────────────

/**
 * Formatea un monto como moneda peruana. Ej: 1234.56 → "S/ 1,234.56"
 */
export function formatearDeuda(monto: number): string {
  const partes = monto.toFixed(2).split('.')
  const entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `S/ ${entero}.${partes[1]}`
}
