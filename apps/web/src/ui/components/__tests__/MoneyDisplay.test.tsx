import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MoneyDisplay from '../MoneyDisplay'

describe('MoneyDisplay', () => {
  it('formatea monto entero correctamente', () => {
    render(<MoneyDisplay monto={100} />)
    expect(screen.getByText('S/ 100.00')).toBeDefined()
  })

  it('formatea monto con decimales', () => {
    render(<MoneyDisplay monto={218.50} />)
    expect(screen.getByText('S/ 218.50')).toBeDefined()
  })

  it('formatea monto con separador de miles', () => {
    render(<MoneyDisplay monto={1234.56} />)
    expect(screen.getByText('S/ 1,234.56')).toBeDefined()
  })

  it('formatea monto cero', () => {
    render(<MoneyDisplay monto={0} />)
    expect(screen.getByText('S/ 0.00')).toBeDefined()
  })

  it('formatea monto mayor a un millón', () => {
    render(<MoneyDisplay monto={1000000} />)
    expect(screen.getByText('S/ 1,000,000.00')).toBeDefined()
  })

  it('aplica className personalizada', () => {
    const { container } = render(<MoneyDisplay monto={50} className="text-emerald-400" />)
    const span = container.querySelector('span')
    expect(span?.className).toContain('text-emerald-400')
  })
})
