import type { Decimal } from './producto.types'

export type TipoCliente = 'MINORISTA' | 'RESTAURANTE' | 'MAYORISTA' | 'PUBLICO'
export type EstadoCredito = 'ACTIVO' | 'BLOQUEADO' | 'SUSPENDIDO'

export interface Cliente {
  id: string
  businessId: string
  nombre: string
  nombreCorto: string
  celular: string
  tipo: TipoCliente
  dniRuc: string | null
  direccion: string | null
  esFrecuente: boolean
  ordenPantalla: number
  activo: boolean
}

export interface PerfilCredito {
  id: string
  clientId: string
  limiteCredito: Decimal
  plazoDias: number
  saldoActual: Decimal
  score: number
  estado: EstadoCredito
  fechaUltimoPago: string | null
  totalHistoricoCredito: Decimal
  totalHistoricoPagado: Decimal
  vecesMoroso: number
}
