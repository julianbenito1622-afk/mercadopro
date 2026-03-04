import { consultarSQL, ejecutarSQL, fechaActual } from '../dbUtils'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface BusinessRow {
  id: string
  nombre: string
  ruc: string | null
  mercado: string | null
  plan: string
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function obtenerBusiness(businessId: string): Promise<BusinessRow | null> {
  const rows = await consultarSQL<BusinessRow>(
    'SELECT id, nombre, ruc, mercado, plan FROM business WHERE id = ?',
    [businessId]
  )
  return rows[0] ?? null
}

export async function actualizarBusiness(
  businessId: string,
  data: { nombre?: string; ruc?: string | null; mercado?: string | null }
): Promise<void> {
  const campos = Object.keys(data)
  if (campos.length === 0) return
  const sets = campos.map(k => `${k} = ?`).join(', ')
  const valores: (string | number | null)[] = campos.map(
    k => (data[k as keyof typeof data] ?? null) as string | null
  )
  await ejecutarSQL(
    `UPDATE business SET ${sets}, updated_at = ? WHERE id = ?`,
    [...valores, fechaActual(), businessId]
  )
}

export async function obtenerConfiguracion(businessId: string, clave: string): Promise<string | null> {
  const rows = await consultarSQL<{ valor: string }>(
    'SELECT valor FROM configuracion WHERE business_id = ? AND clave = ?',
    [businessId, clave]
  )
  return rows[0]?.valor ?? null
}

export async function actualizarConfiguracion(
  businessId: string,
  clave: string,
  valor: string
): Promise<void> {
  await ejecutarSQL(
    'UPDATE configuracion SET valor = ?, updated_at = ? WHERE business_id = ? AND clave = ?',
    [valor, fechaActual(), businessId, clave]
  )
}
