export type SyncOperacion = 'INSERT' | 'UPDATE' | 'DELETE'
export type SyncEstado = 'PENDIENTE' | 'ENVIADO' | 'CONFIRMADO' | 'CONFLICTO'

export interface SyncLog {
  id: string
  deviceId: string
  tabla: string
  registroId: string
  operacion: SyncOperacion
  datosJson: string
  timestampLocal: string
  timestampServidor: string | null
  estado: SyncEstado
  intentos: number
  error: string | null
}

export interface SyncPayload {
  deviceId: string
  cambios: SyncCambio[]
  ultimoSync: string | null
}

export interface SyncCambio {
  tabla: string
  operacion: SyncOperacion
  registroId: string
  datos: Record<string, unknown>
  timestamp: string
}
