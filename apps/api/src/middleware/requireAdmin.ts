import { FastifyRequest, FastifyReply } from 'fastify'

type JwtPayload = { userId: string; businessId: string; branchId: string; rol: string }

/**
 * Middleware RBAC: solo permite acceso a usuarios con rol ADMIN.
 * Aplicar como preHandler en rutas de gestión (productos, inventario, proveedores).
 *
 * Uso:
 *   fastify.post('/ruta', { preHandler: [requireAdmin] }, handler)
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { rol } = request.user as JwtPayload
  if (rol !== 'ADMIN') {
    return reply.code(403).send({
      error: 'Acceso denegado: se requiere rol de administrador',
      rolRequerido: 'ADMIN',
      rolActual: rol,
    })
  }
}
