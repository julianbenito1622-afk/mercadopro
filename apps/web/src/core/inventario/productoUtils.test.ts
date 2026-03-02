import { describe, it, expect } from 'vitest'
import {
  calcularPrecioNeto,
  calcularPesoNeto,
  convertirAKg,
} from './productoUtils'

describe('calcularPrecioNeto', () => {
  it('82.5kg bruto - 2.5kg tara = 80kg neto × S/2.50 = S/200.00', () => {
    expect(calcularPrecioNeto(82.5, 2.5, 2.5)).toBe(200.00)
  })

  it('sin tara: peso bruto = peso neto', () => {
    expect(calcularPrecioNeto(50, 0, 3.00)).toBe(150.00)
  })
})

describe('calcularPesoNeto', () => {
  it('265kg bruto - 2.5kg tara × 5 jabas = 252.5kg neto', () => {
    expect(calcularPesoNeto(265, 2.5, 5)).toBe(252.5)
  })

  it('sin envases (cantidadEnvases=0): peso bruto = peso neto', () => {
    expect(calcularPesoNeto(100, 2.5, 0)).toBe(100)
  })
})

describe('convertirAKg', () => {
  it('3 sacos × 50kg equivalencia = 150kg', () => {
    expect(convertirAKg(3, 'SACO', 50)).toBe(150)
  })

  it('1 jaba × 20kg equivalencia = 20kg', () => {
    expect(convertirAKg(1, 'JABA', 20)).toBe(20)
  })
})
