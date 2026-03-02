import type { Decimal, UnidadVenta } from './producto.types'

export type MetodoPago = 'EFECTIVO' | 'CREDITO' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA' | 'MIXTO'
export type EstadoPago = 'PAGADO' | 'PENDIENTE' | 'PARCIAL' | 'ANULADO'
export type SyncStatus = 'LOCAL' | 'SYNCING' | 'SYNCED' | 'CONFLICT'

export interface Venta {
  id: string
  businessId: string
  branchId: string
  userId: string
  clientId: string | null
  numeroTicket: string
  fecha: string // ISO 8601
  subtotal: Decimal
  descuento: Decimal
  total: Decimal
  metodoPago: MetodoPago
  estadoPago: EstadoPago
  montoPagado: Decimal
  montoPendiente: Decimal
  fechaVencimientoCredito: string | null
  notas: string | null
  syncStatus: SyncStatus
  deviceId: string
  createdAt: string
  updatedAt: string
}

export interface DetalleVenta {
  id: string
  saleId: string
  productId: string
  batchId: string
  cantidad: Decimal
  unidadVenta: UnidadVenta
  pesoBrutoKg: Decimal
  pesoTaraKg: Decimal
  pesoNetoKg: Decimal
  precioUnitario: Decimal
  subtotal: Decimal
}

export interface Pago {
  id: string
  clientId: string
  saleId: string | null
  monto: Decimal
  metodo: Exclude<MetodoPago, 'CREDITO' | 'MIXTO'>
  fecha: string
  referencia: string | null
  notas: string | null
  registradoPor: string
  syncStatus: SyncStatus
}
