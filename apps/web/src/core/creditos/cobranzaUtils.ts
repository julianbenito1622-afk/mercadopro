/**
 * Calcula cuántos días han pasado desde que venció el plazo.
 * Resultado negativo = aún dentro del plazo.
 * Resultado positivo = días de retraso.
 */
export function calcularDiasVencido(fechaVenta: string, plazoDias: number): number {
  const fechaMs = new Date(fechaVenta).getTime()
  const diasTranscurridos = Math.floor((Date.now() - fechaMs) / (1000 * 60 * 60 * 24))
  return diasTranscurridos - plazoDias
}

export function estaVencido(fechaVenta: string, plazoDias: number): boolean {
  return calcularDiasVencido(fechaVenta, plazoDias) > 0
}

export function clasificarDeuda(
  diasVencido: number
): 'AL_DIA' | 'POR_VENCER' | 'VENCIDO' | 'CRITICO' {
  if (diasVencido <= 0) return 'AL_DIA'
  if (diasVencido <= 3) return 'POR_VENCER'
  if (diasVencido <= 10) return 'VENCIDO'
  return 'CRITICO'
}

export function formatearDiasVencido(dias: number): string {
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Hace 1 día'
  if (dias < 5) return `Hace ${dias} días`
  return `¡${dias} días vencido!`
}
