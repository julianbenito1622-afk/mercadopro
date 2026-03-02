// Celulares peruanos: 9 dígitos comenzando con 9
export function esCelularValido(celular: string): boolean {
  return /^9\d{8}$/.test(celular)
}

export function esDniValido(dni: string): boolean {
  return /^\d{8}$/.test(dni)
}

export function esRucValido(ruc: string): boolean {
  return /^\d{11}$/.test(ruc)
}
