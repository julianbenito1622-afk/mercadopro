// Taras predefinidas en kilogramos
export const TARAS_PREDEFINIDAS = {
  JABA_MADERA: 2.5,
  CAJA_PLASTICA: 1.2,
  SACO_POLIPROPILENO: 0.3,
  SIN_ENVASE: 0,
} as const

export type NombreEnvase = keyof typeof TARAS_PREDEFINIDAS
