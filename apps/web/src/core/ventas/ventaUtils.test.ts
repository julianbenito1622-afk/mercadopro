import { describe, it, expect } from 'vitest'
import {
  calcularTotalVenta,
  calcularVuelto,
  generarNumeroTicket,
  calcularPesoNeto,
  calcularSubtotal,
  type VentaItem,
} from './ventaUtils'

describe('calcularTotalVenta', () => {
  it('3 items: 80kg*S/1.80 + 25kg*S/2.50 + 10kg*S/1.20 = S/218.50', () => {
    const items: VentaItem[] = [
      { producto_id: '1', nombre: 'Papa', nombre_corto: 'PAPA',   cantidad_kg: 80, precio_unitario: 1.80, subtotal: 144.00 },
      { producto_id: '2', nombre: 'Tomate', nombre_corto: 'TOM', cantidad_kg: 25, precio_unitario: 2.50, subtotal: 62.50 },
      { producto_id: '3', nombre: 'Cebolla', nombre_corto: 'CEB', cantidad_kg: 10, precio_unitario: 1.20, subtotal: 12.00 },
    ]
    expect(calcularTotalVenta(items)).toBe(218.50)
  })
})

describe('calcularVuelto', () => {
  it('total S/218.50, paga S/220 → vuelto S/1.50', () => {
    expect(calcularVuelto(218.50, 220)).toBe(1.50)
  })

  it('pago exacto → vuelto S/0.00', () => {
    expect(calcularVuelto(100, 100)).toBe(0)
  })
})

describe('generarNumeroTicket', () => {
  it('prefijo "V", correlativo 1 → "V-000001"', () => {
    expect(generarNumeroTicket('V', 1)).toBe('V-000001')
  })

  it('prefijo "V", correlativo 999 → "V-000999"', () => {
    expect(generarNumeroTicket('V', 999)).toBe('V-000999')
  })
})

describe('calcularPesoNeto', () => {
  it('82.5kg bruto - 2.5kg tara × 1 envase = 80kg neto', () => {
    expect(calcularPesoNeto(82.5, 2.5, 1)).toBe(80)
  })

  it('sin envases: peso bruto = peso neto', () => {
    expect(calcularPesoNeto(100, 2.5, 0)).toBe(100)
  })
})

describe('calcularSubtotal', () => {
  it('80kg × S/2.50/kg = S/200.00', () => {
    expect(calcularSubtotal(80, 2.50)).toBe(200.00)
  })
})
