import type { UnidadVenta } from '../types/producto.types'

export const UNIDADES_MEDIDA: Record<UnidadVenta, string> = {
  KG: 'Kilogramo',
  UNIDAD: 'Unidad',
  SACO: 'Saco',
  JABA: 'Jaba',
  CAJA: 'Caja',
  ARROBA: 'Arroba',
} as const

// Peso equivalente en kg por unidad (para unidades de peso fijo)
export const EQUIVALENCIAS_KG: Partial<Record<UnidadVenta, number>> = {
  SACO: 50,
  JABA: 20,
  ARROBA: 11.5,
} as const
