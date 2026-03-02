import { describe, it, expect } from 'vitest'
import {
  verificarCredito,
  calcularScore,
  obtenerEstadoCredito,
  formatearDeuda,
} from './creditoUtils'

// ── verificarCredito ──────────────────────────────────────────────────────────

describe('verificarCredito', () => {
  it('deuda S/400 + venta S/200 > límite S/500 → NO permitido', () => {
    const result = verificarCredito(400, 200, 500)
    expect(result.permitido).toBe(false)
    expect(result.razon).toBeDefined()
  })

  it('deuda S/200 + venta S/200 <= límite S/500 → SÍ permitido', () => {
    const result = verificarCredito(200, 200, 500)
    expect(result.permitido).toBe(true)
  })

  it('deuda S/0 + venta S/600 > límite S/500 → NO permitido', () => {
    const result = verificarCredito(0, 600, 500)
    expect(result.permitido).toBe(false)
    expect(result.razon).toBeDefined()
  })
})

// ── calcularScore ─────────────────────────────────────────────────────────────

describe('calcularScore', () => {
  it('3 días promedio, 50 ventas, 0 veces vencido → score alto (>70)', () => {
    const score = calcularScore(3, 50, 0)
    expect(score).toBeGreaterThan(70)
  })

  it('15 días promedio, 5 ventas, 8 veces vencido → score bajo (<30)', () => {
    const score = calcularScore(15, 5, 8)
    expect(score).toBeLessThan(30)
  })
})

// ── obtenerEstadoCredito ──────────────────────────────────────────────────────

describe('obtenerEstadoCredito', () => {
  it('0 días vencido → AL_DIA', () => {
    expect(obtenerEstadoCredito(0)).toBe('AL_DIA')
  })

  it('3 días vencido → POR_VENCER', () => {
    expect(obtenerEstadoCredito(3)).toBe('POR_VENCER')
  })

  it('6 días vencido → VENCIDO', () => {
    expect(obtenerEstadoCredito(6)).toBe('VENCIDO')
  })

  it('15 días vencido → BLOQUEADO', () => {
    expect(obtenerEstadoCredito(15)).toBe('BLOQUEADO')
  })
})

// ── formatearDeuda ────────────────────────────────────────────────────────────

describe('formatearDeuda', () => {
  it('1234.56 → "S/ 1,234.56"', () => {
    expect(formatearDeuda(1234.56)).toBe('S/ 1,234.56')
  })

  it('0 → "S/ 0.00"', () => {
    expect(formatearDeuda(0)).toBe('S/ 0.00')
  })

  it('350 → "S/ 350.00"', () => {
    expect(formatearDeuda(350)).toBe('S/ 350.00')
  })
})
