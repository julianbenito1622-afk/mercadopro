import { consultarSQL, ejecutarSQL, generarId, fechaActual } from '../dbUtils'

// ── Tipos locales (snake_case = columnas SQLite) ──────────────────────────────

export interface CategoriaRow {
  id: string
  business_id: string
  nombre: string
  orden: number
}

export interface ProductoRow {
  id: string
  business_id: string
  category_id: string
  categoria_nombre: string
  nombre: string
  nombre_corto: string
  unidad_venta_principal: string
  unidad_base: string
  precio_venta_actual: number
  requiere_pesaje: number
  vida_util_dias: number
  activo: number
  es_pantalla_rapida: number
  orden_pantalla: number
  imagen_url: string | null
}

export interface HistorialPrecioRow {
  id: string
  precio_anterior: number
  precio_nuevo: number
  fecha: string
  registrado_por: string
}

export interface NuevoProductoData {
  business_id: string
  category_id: string
  nombre: string
  nombre_corto: string
  unidad_venta_principal?: string
  unidad_base?: string
  precio_venta_actual: number
  requiere_pesaje?: number
  vida_util_dias?: number
  es_pantalla_rapida?: number
  orden_pantalla?: number
}

export interface ActualizarProductoData {
  category_id?: string
  nombre?: string
  nombre_corto?: string
  unidad_venta_principal?: string
  precio_venta_actual?: number
  requiere_pesaje?: number
  vida_util_dias?: number
  es_pantalla_rapida?: number
  orden_pantalla?: number
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function obtenerCategorias(): Promise<CategoriaRow[]> {
  return consultarSQL<CategoriaRow>(
    'SELECT * FROM category ORDER BY orden'
  )
}

export async function obtenerProductos(businessId: string): Promise<ProductoRow[]> {
  return consultarSQL<ProductoRow>(
    `SELECT p.*, c.nombre AS categoria_nombre
     FROM product p
     JOIN category c ON p.category_id = c.id
     WHERE p.activo = 1 AND p.business_id = ?
     ORDER BY p.orden_pantalla, p.nombre`,
    [businessId]
  )
}

export async function obtenerProductosPantalla(businessId: string): Promise<ProductoRow[]> {
  return consultarSQL<ProductoRow>(
    `SELECT p.*, c.nombre AS categoria_nombre
     FROM product p
     JOIN category c ON p.category_id = c.id
     WHERE p.activo = 1 AND p.es_pantalla_rapida = 1 AND p.business_id = ?
     ORDER BY p.orden_pantalla
     LIMIT 12`,
    [businessId]
  )
}

export async function obtenerProductoPorId(id: string): Promise<ProductoRow | null> {
  const rows = await consultarSQL<ProductoRow>(
    `SELECT p.*, c.nombre AS categoria_nombre
     FROM product p
     JOIN category c ON p.category_id = c.id
     WHERE p.id = ?`,
    [id]
  )
  return rows[0] ?? null
}

export async function obtenerHistorialPrecios(productId: string): Promise<HistorialPrecioRow[]> {
  return consultarSQL<HistorialPrecioRow>(
    `SELECT id, precio_anterior, precio_nuevo, fecha, registrado_por
     FROM price_history
     WHERE product_id = ?
     ORDER BY fecha DESC
     LIMIT 5`,
    [productId]
  )
}

export async function crearProducto(data: NuevoProductoData): Promise<string> {
  const id = generarId()
  const now = fechaActual()
  await ejecutarSQL(
    `INSERT INTO product (
       id, business_id, category_id, nombre, nombre_corto,
       unidad_venta_principal, unidad_base, precio_venta_actual,
       requiere_pesaje, vida_util_dias, activo,
       es_pantalla_rapida, orden_pantalla,
       sync_status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'LOCAL', ?, ?)`,
    [
      id,
      data.business_id,
      data.category_id,
      data.nombre,
      data.nombre_corto,
      data.unidad_venta_principal ?? 'KG',
      data.unidad_base ?? 'KG',
      data.precio_venta_actual,
      data.requiere_pesaje ?? 1,
      data.vida_util_dias ?? 7,
      data.es_pantalla_rapida ?? 0,
      data.orden_pantalla ?? 0,
      now,
      now,
    ]
  )
  return id
}

export async function actualizarProducto(id: string, data: ActualizarProductoData): Promise<void> {
  const campos = Object.keys(data) as (keyof ActualizarProductoData)[]
  if (campos.length === 0) return
  const now = fechaActual()
  const sets = campos.map(k => `${k} = ?`).join(', ')
  const valores: (string | number | null)[] = campos.map(
    k => data[k] as string | number | null
  )
  await ejecutarSQL(
    `UPDATE product SET ${sets}, updated_at = ? WHERE id = ?`,
    [...valores, now, id]
  )
}

export async function actualizarPrecio(
  productId: string,
  precioNuevo: number,
  userId: string
): Promise<void> {
  const now = fechaActual()
  const rows = await consultarSQL<{ precio_venta_actual: number }>(
    'SELECT precio_venta_actual FROM product WHERE id = ?',
    [productId]
  )
  if (rows.length === 0) return
  const precioAnterior = rows[0].precio_venta_actual

  await ejecutarSQL(
    'UPDATE product SET precio_venta_actual = ?, updated_at = ? WHERE id = ?',
    [precioNuevo, now, productId]
  )
  await ejecutarSQL(
    `INSERT INTO price_history (
       id, product_id, precio_anterior, precio_nuevo,
       fecha, registrado_por, sync_status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'LOCAL', ?, ?)`,
    [generarId(), productId, precioAnterior, precioNuevo, now, userId, now, now]
  )
}

export async function desactivarProducto(id: string): Promise<void> {
  await ejecutarSQL(
    'UPDATE product SET activo = 0, updated_at = ? WHERE id = ?',
    [fechaActual(), id]
  )
}
