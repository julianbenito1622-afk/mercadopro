import type { EstadoLote } from '../types/lote.types'

export const COLORES_ESTADO_LOTE: Record<EstadoLote, string> = {
  FRESCO: 'emerald',
  ADVERTENCIA: 'amber',
  CRITICO: 'red',
  AGOTADO: 'slate',
  MERMA_TOTAL: 'red',
} as const

// Días antes del vencimiento para cambiar de estado
export const UMBRALES_ESTADO_LOTE = {
  ADVERTENCIA: 3,
  CRITICO: 1,
} as const
