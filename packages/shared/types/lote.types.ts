import type { Decimal } from './producto.types'
import type { SyncStatus } from './venta.types'

export type TipoIngreso = 'COMPRA_DIRECTA' | 'CONSIGNACION'
export type EstadoLote = 'FRESCO' | 'ADVERTENCIA' | 'CRITICO' | 'AGOTADO' | 'MERMA_TOTAL'

export interface TipoEnvase {
  id: string
  businessId: string
  nombre: string
  pesoTaraKg: Decimal
  descripcion: string
}

export interface Lote {
  id: string
  businessId: string
  branchId: string
  productId: string
  supplierId: string
  tipoIngreso: TipoIngreso
  fechaEntrada: string
  cantidadInicialKg: Decimal
  cantidadActualKg: Decimal
  costoUnitario: Decimal
  costoTotal: Decimal
  envaseCantidad: number
  envaseTipoId: string | null
  fechaVencimientoEstimada: string
  estado: EstadoLote
  alertaMermaDias: number
  notas: string | null
  syncStatus: SyncStatus
  createdAt: string
  updatedAt: string
}

export interface MovimientoStock {
  id: string
  batchId: string
  tipo: 'ENTRADA' | 'VENTA' | 'MERMA' | 'AJUSTE' | 'DEVOLUCION'
  cantidadKg: Decimal
  motivo: string | null
  saleItemId: string | null
  registradoPor: string
  fecha: string
  syncStatus: SyncStatus
}
