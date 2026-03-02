import type { MetodoPago } from '../types/venta.types'

export function esMontoValido(monto: number): boolean {
  return monto > 0 && Number.isFinite(monto)
}

export function esMetodoPagoValido(metodo: string): metodo is MetodoPago {
  const metodos: MetodoPago[] = ['EFECTIVO', 'CREDITO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'MIXTO']
  return metodos.includes(metodo as MetodoPago)
}
