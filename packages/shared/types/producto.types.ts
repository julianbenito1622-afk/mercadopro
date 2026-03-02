// Alias para montos monetarios — usar decimal.js cuando se integre al core
export type Decimal = number

export type UnidadVenta = 'KG' | 'UNIDAD' | 'SACO' | 'JABA' | 'CAJA' | 'ARROBA'

export interface Categoria {
  id: string
  businessId: string
  nombre: string
  orden: number
}

export interface Producto {
  id: string
  businessId: string
  categoryId: string
  nombre: string
  nombreCorto: string
  unidadVentaPrincipal: UnidadVenta
  unidadBase: 'KG'
  precioVentaActual: Decimal
  requierePesaje: boolean
  vidaUtilDias: number
  activo: boolean
  ordenPantalla: number
  imagenUrl: string | null
}

export interface ProductoUnidad {
  productId: string
  unidad: Exclude<UnidadVenta, 'KG' | 'UNIDAD'>
  equivalenciaKg: Decimal
  esPesoVariable: boolean
}
