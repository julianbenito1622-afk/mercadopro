import { describe, it, expect } from 'vitest'
import {
  calcularEstadoLote,
  calcularDiasParaVencer,
  calcularPorcentajeMerma,
  calcularValorInventario,
  calcularMargen,
  estaEnAlerta,
  formatearKg,
  formatearDiasVencer,
} from './loteUtils'

// ── calcularEstadoLote ────────────────────────────────────────────────────────

describe('calcularEstadoLote', () => {
  it('cantidad = 0 → AGOTADO sin importar días', () => {
    expect(calcularEstadoLote(0, 10, 2)).toBe('AGOTADO')
  })

  it('cantidad negativa → AGOTADO', () => {
    expect(calcularEstadoLote(-5, 10, 2)).toBe('AGOTADO')
  })

  it('días = 0 → CRITICO (vence hoy)', () => {
    expect(calcularEstadoLote(100, 0, 2)).toBe('CRITICO')
  })

  it('días negativos → CRITICO (ya venció)', () => {
    expect(calcularEstadoLote(50, -3, 2)).toBe('CRITICO')
  })

  it('días <= alerta → ADVERTENCIA', () => {
    expect(calcularEstadoLote(100, 2, 3)).toBe('ADVERTENCIA')
    expect(calcularEstadoLote(100, 1, 2)).toBe('ADVERTENCIA')
  })

  it('días = alerta exacto → ADVERTENCIA', () => {
    expect(calcularEstadoLote(200, 2, 2)).toBe('ADVERTENCIA')
  })

  it('días > alerta → FRESCO', () => {
    expect(calcularEstadoLote(500, 14, 2)).toBe('FRESCO')
    expect(calcularEstadoLote(100, 3, 2)).toBe('FRESCO')
  })

  it('lote con stock pero alerta_merma_dias alto → ADVERTENCIA', () => {
    expect(calcularEstadoLote(50, 5, 7)).toBe('ADVERTENCIA')
  })
})

// ── calcularDiasParaVencer ────────────────────────────────────────────────────

describe('calcularDiasParaVencer', () => {
  it('fecha 7 días en el futuro → ~7 días', () => {
    const fecha = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const dias = calcularDiasParaVencer(fecha)
    expect(dias).toBeGreaterThan(5)
    expect(dias).toBeLessThanOrEqual(8)
  })

  it('fecha en el pasado → valor no positivo', () => {
    const fecha = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const dias = calcularDiasParaVencer(fecha)
    expect(dias).toBeLessThanOrEqual(0)
  })

  it('fecha 30 días en el futuro → ~30', () => {
    const fecha = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const dias = calcularDiasParaVencer(fecha)
    expect(dias).toBeGreaterThan(28)
    expect(dias).toBeLessThanOrEqual(31)
  })
})

// ── calcularPorcentajeMerma ───────────────────────────────────────────────────

describe('calcularPorcentajeMerma', () => {
  it('500 kg inicial, 450 actual → 10% merma', () => {
    expect(calcularPorcentajeMerma(500, 450)).toBe(10)
  })

  it('sin merma → 0%', () => {
    expect(calcularPorcentajeMerma(200, 200)).toBe(0)
  })

  it('todo merma → 100%', () => {
    expect(calcularPorcentajeMerma(100, 0)).toBe(100)
  })

  it('cantidad inicial 0 → 0% (evita división por cero)', () => {
    expect(calcularPorcentajeMerma(0, 0)).toBe(0)
  })

  it('100 kg inicial, 75 actual → 25% merma', () => {
    expect(calcularPorcentajeMerma(100, 75)).toBe(25)
  })

  it('no puede ser negativo (actual > inicial por error de datos)', () => {
    expect(calcularPorcentajeMerma(100, 120)).toBe(0)
  })

  it('resultado redondeado a 1 decimal', () => {
    // 80 kg inicial, 53 actual → 33.75% → 33.8%
    expect(calcularPorcentajeMerma(80, 53)).toBe(33.8)
  })
})

// ── calcularValorInventario ───────────────────────────────────────────────────

describe('calcularValorInventario', () => {
  it('450 kg × S/ 0.80/kg → S/ 360.00', () => {
    expect(calcularValorInventario(450, 0.80)).toBe(360)
  })

  it('65 kg × S/ 1.80/kg → S/ 117.00', () => {
    expect(calcularValorInventario(65, 1.80)).toBe(117)
  })

  it('cantidad 0 → S/ 0.00', () => {
    expect(calcularValorInventario(0, 2.50)).toBe(0)
  })

  it('resultado redondeado a 2 decimales', () => {
    // 3 kg × S/ 1.33 = S/ 3.99
    expect(calcularValorInventario(3, 1.33)).toBe(3.99)
  })
})

// ── calcularMargen ────────────────────────────────────────────────────────────

describe('calcularMargen', () => {
  it('precio S/ 2.50, costo S/ 0.80 → margen 68%', () => {
    expect(calcularMargen(2.50, 0.80)).toBe(68)
  })

  it('precio igual a costo → 0% margen', () => {
    expect(calcularMargen(1.80, 1.80)).toBe(0)
  })

  it('precio 0 → 0% (evita división por cero)', () => {
    expect(calcularMargen(0, 0.80)).toBe(0)
  })

  it('precio S/ 3.00, costo S/ 1.50 → 50% margen', () => {
    expect(calcularMargen(3.00, 1.50)).toBe(50)
  })

  it('resultado redondeado a 1 decimal', () => {
    // (5 - 3.33) / 5 × 100 = 33.4%
    expect(calcularMargen(5, 3.33)).toBe(33.4)
  })
})

// ── estaEnAlerta ──────────────────────────────────────────────────────────────

describe('estaEnAlerta', () => {
  it('cantidad 0 → alerta (agotado)', () => {
    expect(estaEnAlerta(0, 10, 2)).toBe(true)
  })

  it('días para vencer <= alerta → alerta', () => {
    expect(estaEnAlerta(100, 2, 3)).toBe(true)
    expect(estaEnAlerta(100, 0, 2)).toBe(true)
  })

  it('días negativos → alerta', () => {
    expect(estaEnAlerta(50, -1, 2)).toBe(true)
  })

  it('días > alerta y stock disponible → sin alerta', () => {
    expect(estaEnAlerta(200, 14, 2)).toBe(false)
    expect(estaEnAlerta(50, 3, 2)).toBe(false)
  })
})

// ── formatearKg ───────────────────────────────────────────────────────────────

describe('formatearKg', () => {
  it('450 → "450.0 kg"', () => {
    expect(formatearKg(450)).toBe('450.0 kg')
  })

  it('1500 → "1,500.0 kg"', () => {
    expect(formatearKg(1500)).toBe('1,500.0 kg')
  })

  it('25.5 → "25.5 kg"', () => {
    expect(formatearKg(25.5)).toBe('25.5 kg')
  })

  it('0 → "0.0 kg"', () => {
    expect(formatearKg(0)).toBe('0.0 kg')
  })

  it('1000000 → "1,000,000.0 kg"', () => {
    expect(formatearKg(1000000)).toBe('1,000,000.0 kg')
  })
})

// ── formatearDiasVencer ───────────────────────────────────────────────────────

describe('formatearDiasVencer', () => {
  it('días > 1 → "N días"', () => {
    expect(formatearDiasVencer(14)).toBe('14 días')
    expect(formatearDiasVencer(3)).toBe('3 días')
  })

  it('días = 1 → "Mañana"', () => {
    expect(formatearDiasVencer(1)).toBe('Mañana')
  })

  it('días = 0 → "Vence hoy"', () => {
    expect(formatearDiasVencer(0)).toBe('Vence hoy')
  })

  it('días = -1 → "Venció hace 1 día"', () => {
    expect(formatearDiasVencer(-1)).toBe('Venció hace 1 día')
  })

  it('días = -5 → "Venció hace 5 días"', () => {
    expect(formatearDiasVencer(-5)).toBe('Venció hace 5 días')
  })

  it('días negativos pluralizan correctamente', () => {
    expect(formatearDiasVencer(-2)).toBe('Venció hace 2 días')
    expect(formatearDiasVencer(-10)).toBe('Venció hace 10 días')
  })
})
