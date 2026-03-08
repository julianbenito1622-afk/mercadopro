import { consultarSQL, ejecutarSQL, generarId, fechaActual } from '../dbUtils'

export interface UsuarioRow {
  id: string
  business_id: string
  branch_id: string | null
  nombre: string
  celular: string
  rol: string
  activo: number
}

export async function obtenerUsuariosActivos(businessId: string): Promise<UsuarioRow[]> {
  return consultarSQL<UsuarioRow>(
    `SELECT id, business_id, branch_id, nombre, celular, rol, activo
     FROM app_user WHERE business_id = ? AND activo = 1 ORDER BY nombre`,
    [businessId]
  )
}

export async function verificarPin(businessId: string, pin: string): Promise<UsuarioRow | null> {
  const rows = await consultarSQL<UsuarioRow>(
    `SELECT id, business_id, branch_id, nombre, celular, rol, activo
     FROM app_user WHERE business_id = ? AND pin = ? AND activo = 1 LIMIT 1`,
    [businessId, pin]
  )
  return rows[0] ?? null
}

export async function crearUsuarioAdmin(data: {
  businessId: string
  nombre: string
  pin: string
  celular?: string
}): Promise<string> {
  const id = generarId()
  const now = fechaActual()
  await ejecutarSQL(
    `INSERT INTO app_user (id, business_id, branch_id, nombre, celular, pin, rol, activo, sync_status, created_at, updated_at)
     VALUES (?, ?, 'local-branch', ?, ?, ?, 'ADMIN', 1, 'LOCAL', ?, ?)`,
    [id, data.businessId, data.nombre, data.celular ?? '', data.pin, now, now]
  )
  return id
}
