/**
 * Calcula el precio neto de una venta por peso.
 * precioNeto = (pesoBrutoKg - pesoTaraKg) * precioUnitarioKg
 */
export function calcularPrecioNeto(
  pesoBrutoKg: number,
  pesoTaraKg: number,
  precioUnitarioKg: number
): number {
  return Math.round((pesoBrutoKg - pesoTaraKg) * precioUnitarioKg * 100) / 100
}

/**
 * Convierte una cantidad en la unidad dada a kilogramos.
 * resultado = cantidad * equivalenciaKg
 */
export function convertirAKg(
  cantidad: number,
  _unidad: string,
  equivalenciaKg: number
): number {
  return Math.round(cantidad * equivalenciaKg * 1000) / 1000
}

/**
 * Calcula el peso neto descontando la tara de cada envase.
 * pesoNeto = pesoBrutoKg - (pesoTaraKg * cantidadEnvases)
 */
export function calcularPesoNeto(
  pesoBrutoKg: number,
  pesoTaraKg: number,
  cantidadEnvases: number
): number {
  return Math.round((pesoBrutoKg - pesoTaraKg * cantidadEnvases) * 1000) / 1000
}
