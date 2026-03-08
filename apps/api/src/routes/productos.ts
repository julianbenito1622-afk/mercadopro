import { FastifyInstance } from 'fastify'
import crypto from 'crypto'

type JwtPayload = { userId: string; businessId: string; branchId: string; rol: string }

const postProductoSchema = {
  schema: {
    body: {
      type: 'object',
      required: ['categoryId', 'nombre', 'nombreCorto', 'precioVentaActual'],
      properties: {
        categoryId: { type: 'string', minLength: 1 },
        nombre: { type: 'string', minLength: 2, maxLength: 100 },
        nombreCorto: { type: 'string', minLength: 1, maxLength: 20 },
        unidadVentaPrincipal: { type: 'string', enum: ['KG', 'UNIDAD', 'CAJA', 'BOLSA'] },
        precioVentaActual: { type: 'number', minimum: 0.01 },
        requierePesaje: { type: 'boolean' },
        vidaUtilDias: { type: 'integer', minimum: 1 },
        esPantallaRapida: { type: 'boolean' },
        ordenPantalla: { type: 'integer', minimum: 0 },
      },
      additionalProperties: false,
    },
  },
}

const patchProductoSchema = {
  schema: {
    body: {
      type: 'object',
      minProperties: 1,
      properties: {
        nombre: { type: 'string', minLength: 2, maxLength: 100 },
        nombreCorto: { type: 'string', minLength: 1, maxLength: 20 },
        precioVentaActual: { type: 'number', minimum: 0.01 },
        esPantallaRapida: { type: 'boolean' },
        ordenPantalla: { type: 'integer', minimum: 0 },
        activo: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
}

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
  }>('/productos', postProductoSchema, async (request, reply) => {
    const { businessId, userId } = request.user as JwtPayload
    const now = new Date()

    // Validar que la categoría exista y pertenezca al negocio
    const categoria = await fastify.prisma.category.findFirst({
      where: { id: request.body.categoryId, businessId },
    })
    if (!categoria) {
      return reply.code(422).send({ error: 'Categoría no encontrada' })
    }

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
  }>('/productos/:id', patchProductoSchema, async (request, reply) => {
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
