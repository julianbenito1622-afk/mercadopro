import type { EstadoCredito } from '../types/cliente.types'

export const COLORES_ESTADO_CREDITO: Record<EstadoCredito, string> = {
  ACTIVO: 'emerald',
  BLOQUEADO: 'red',
  SUSPENDIDO: 'amber',
} as const

export const PLAZOS_CREDITO = [3, 5, 7] as const
export type PlazoCreditoDias = (typeof PLAZOS_CREDITO)[number]
