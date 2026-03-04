import { FastifyInstance } from 'fastify'
import crypto from 'crypto'

type JwtPayload = { userId: string; businessId: string; branchId: string; rol: string }

export async function productosRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'No autorizado' })
    }
  })

  // GET /productos
  fastify.get('/productos', async (request) => {
    const { businessId } = request.user as JwtPayload
    return fastify.prisma.product.findMany({
      where: { businessId, activo: true },
      include: { category: true },
      orderBy: { nombre: 'asc' },
    })
  })

  // GET /productos/:id
  fastify.get<{ Params: { id: string } }>('/productos/:id', async (request, reply) => {
    const { businessId } = request.user as JwtPayload
    const producto = await fastify.prisma.product.findFirst({
      where: { id: request.params.id, businessId },
      include: { category: true, priceHistory: { orderBy: { fecha: 'desc' }, take: 5 } },
    })
    if (!producto) return reply.code(404).send({ error: 'Producto no encontrado' })
    return producto
  })

  // POST /productos
  fastify.post<{
    Body: {
      categoryId: string
      nombre: string
      nombreCorto: string
      unidadVentaPrincipal?: string
      precioVentaActual: number
      requierePesaje?: boolean
      vidaUtilDias?: number
      esPantallaRapida?: boolean
      ordenPantalla?: number
    }
  }>('/productos', async (request, reply) => {
    const { businessId, userId } = request.user as JwtPayload
    const now = new Date()
    const producto = await fastify.prisma.product.create({
      data: {
        id: crypto.randomUUID(),
        businessId,
        ...request.body,
        syncStatus: 'SYNCED',
        createdAt: now,
        updatedAt: now,
      },
    })
    return reply.code(201).send(producto)
  })

  // PATCH /productos/:id
  fastify.patch<{
    Params: { id: string }
    Body: Partial<{
      nombre: string
      nombreCorto: string
      precioVentaActual: number
      esPantallaRapida: boolean
      ordenPantalla: number
      activo: boolean
    }>
  }>('/productos/:id', async (request, reply) => {
    const { businessId, userId } = request.user as JwtPayload
    const now = new Date()

    const existing = await fastify.prisma.product.findFirst({
      where: { id: request.params.id, businessId },
    })
    if (!existing) return reply.code(404).send({ error: 'Producto no encontrado' })

    // Si cambia el precio, registrar historial
    if (request.body.precioVentaActual !== undefined && request.body.precioVentaActual !== existing.precioVentaActual) {
      await fastify.prisma.priceHistory.create({
        data: {
          id: crypto.randomUUID(),
          productId: existing.id,
          precioAnterior: existing.precioVentaActual,
          precioNuevo: request.body.precioVentaActual,
          fecha: now,
          registradoPor: userId,
          syncStatus: 'SYNCED',
          createdAt: now,
          updatedAt: now,
        },
      })
    }

    const updated = await fastify.prisma.product.update({
      where: { id: request.params.id },
      data: { ...request.body, updatedAt: now },
    })
    return updated
  })

  // DELETE /productos/:id (soft delete)
  fastify.delete<{ Params: { id: string } }>('/productos/:id', async (request, reply) => {
    const { businessId } = request.user as JwtPayload
    const existing = await fastify.prisma.product.findFirst({
      where: { id: request.params.id, businessId },
    })
    if (!existing) return reply.code(404).send({ error: 'Producto no encontrado' })

    await fastify.prisma.product.update({
      where: { id: request.params.id },
      data: { activo: false, updatedAt: new Date() },
    })
    return reply.code(204).send()
  })

  // GET /categorias
  fastify.get('/categorias', async (request) => {
    const { businessId } = request.user as JwtPayload
    return fastify.prisma.category.findMany({
      where: { businessId },
      orderBy: { orden: 'asc' },
    })
  })
}
