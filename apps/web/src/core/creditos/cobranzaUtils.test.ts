import { describe, it, expect } from 'vitest'
import {
  calcularDiasVencido,
  estaVencido,
  clasificarDeuda,
  formatearDiasVencido,
} from './cobranzaUtils'

// Helpers para crear fechas relativas al momento actual
function haceDias(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}

// ── calcularDiasVencido ───────────────────────────────────────────────────────

describe('calcularDiasVencido', () => {
  it('venta hace 5 días con plazo 3 → 2 días vencido', () => {
    expect(calcularDiasVencido(haceDias(5), 3)).toBe(2)
  })

  it('venta hace 1 día con plazo 3 → -2 (dentro del plazo)', () => {
    expect(calcularDiasVencido(haceDias(1), 3)).toBe(-2)
  })

  it('venta hace 10 días con plazo 7 → 3 días vencido', () => {
    expect(calcularDiasVencido(haceDias(10), 7)).toBe(3)
  })

  it('venta hace 15 días con plazo 3 → 12 días vencido', () => {
    expect(calcularDiasVencido(haceDias(15), 3)).toBe(12)
  })
})

// ── estaVencido ───────────────────────────────────────────────────────────────

describe('estaVencido', () => {
  it('venta hace 5 días con plazo 3 → vencido', () => {
    expect(estaVencido(haceDias(5), 3)).toBe(true)
  })

  it('venta hace 2 días con plazo 5 → no vencido', () => {
    expect(estaVencido(haceDias(2), 5)).toBe(false)
  })

  it('venta hace 7 días con plazo 7 → no vencido (justo al límite)', () => {
    expect(estaVencido(haceDias(7), 7)).toBe(false)
  })

  it('venta hace 8 días con plazo 7 → vencido', () => {
    expect(estaVencido(haceDias(8), 7)).toBe(true)
  })
})

// ── clasificarDeuda ───────────────────────────────────────────────────────────

describe('clasificarDeuda', () => {
  it('-2 días (dentro del plazo) → AL_DIA', () => {
    expect(clasificarDeuda(-2)).toBe('AL_DIA')
  })

  it('0 días → AL_DIA', () => {
    expect(clasificarDeuda(0)).toBe('AL_DIA')
  })

  it('2 días vencido → POR_VENCER', () => {
    expect(clasificarDeuda(2)).toBe('POR_VENCER')
  })

  it('7 días vencido → VENCIDO', () => {
    expect(clasificarDeuda(7)).toBe('VENCIDO')
  })

  it('15 días vencido → CRITICO', () => {
    expect(clasificarDeuda(15)).toBe('CRITICO')
  })
})

// ── formatearDiasVencido ──────────────────────────────────────────────────────

describe('formatearDiasVencido', () => {
  it('0 → "Hoy"', () => {
    expect(formatearDiasVencido(0)).toBe('Hoy')
  })

  it('1 → "Hace 1 día"', () => {
    expect(formatearDiasVencido(1)).toBe('Hace 1 día')
  })

  it('3 → "Hace 3 días"', () => {
    expect(formatearDiasVencido(3)).toBe('Hace 3 días')
  })

  it('5 → "¡5 días vencido!"', () => {
    expect(formatearDiasVencido(5)).toBe('¡5 días vencido!')
  })

  it('12 → "¡12 días vencido!"', () => {
    expect(formatearDiasVencido(12)).toBe('¡12 días vencido!')
  })
})
