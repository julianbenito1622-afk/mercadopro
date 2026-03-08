import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { requireAdmin } from '../middleware/requireAdmin.js'

type JwtPayload = { userId: string; businessId: string; branchId: string; rol: string }
type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

const postLoteSchema = {
  schema: {
    body: {
      type: 'object',
      required: ['productId', 'cantidadInicialKg', 'costoUnitario', 'fechaVencimientoEstimada'],
      properties: {
        productId: { type: 'string', minLength: 1 },
        supplierId: { type: 'string', minLength: 1 },
        tipoIngreso: { type: 'string', enum: ['COMPRA_DIRECTA', 'CONSIGNACION', 'DEVOLUCION', 'AJUSTE'] },
        cantidadInicialKg: { type: 'number', minimum: 0.001 },
        costoUnitario: { type: 'number', minimum: 0 },
        fechaVencimientoEstimada: { type: 'string', format: 'date' },
        envaseCantidad: { type: 'integer', minimum: 0 },
        notas: { type: 'string', maxLength: 500 },
      },
      additionalProperties: false,
    },
  },
}

const patchAjusteSchema = {
  schema: {
    body: {
      type: 'object',
      required: ['cantidadKg', 'motivo'],
      properties: {
        cantidadKg: { type: 'number' },
        motivo: { type: 'string', minLength: 3, maxLength: 200 },
      },
      additionalProperties: false,
    },
  },
}

const postProveedorSchema = {
  schema: {
    body: {
      type: 'object',
      required: ['nombre'],
      properties: {
        nombre: { type: 'string', minLength: 2, maxLength: 100 },
        celular: { type: 'string', pattern: '^[0-9]{9}$' },
        tipo: { type: 'string', enum: ['DIRECTO', 'CONSIGNACION', 'MIXTO'] },
        zonaOrigen: { type: 'string', maxLength: 100 },
        comisionConsignacion: { type: 'number', minimum: 0, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
}

export async function inventarioRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'No autorizado' })
    }
  })

  // GET /lotes
  fastify.get<{ Querystring: { estado?: string; page?: string; limit?: string } }>('/lotes', async (request) => {
    const { businessId } = request.user as JwtPayload
    const page = Math.max(1, parseInt(request.query.page ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '50')))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { businessId }
    if (request.query.estado) where['estado'] = request.query.estado

    const [items, total] = await Promise.all([
      fastify.prisma.batch.findMany({
        where,
        include: {
          product: { select: { nombre: true, nombreCorto: true, unidadVentaPrincipal: true } },
          supplier: { select: { nombre: true } },
        },
        orderBy: { fechaVencimientoEstimada: 'asc' },
        skip,
        take: limit,
      }),
      fastify.prisma.batch.count({ where }),
    ])

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
  })

  // GET /lotes/:id
  fastify.get<{ Params: { id: string } }>('/lotes/:id', async (request, reply) => {
    const { businessId } = request.user as JwtPayload
    const lote = await fastify.prisma.batch.findFirst({
      where: { id: request.params.id, businessId },
      include: {
        product: true,
        supplier: true,
        stockMovements: { orderBy: { fecha: 'desc' }, take: 20 },
      },
    })
    if (!lote) return reply.code(404).send({ error: 'Lote no encontrado' })
    return lote
  })

  // POST /lotes
  fastify.post<{
    Body: {
      productId: string
      supplierId?: string
      tipoIngreso?: string
      cantidadInicialKg: number
      costoUnitario: number
      fechaVencimientoEstimada: string
      envaseCantidad?: number
      notas?: string
    }
  }>('/lotes', { ...postLoteSchema, preHandler: [requireAdmin] }, async (request, reply) => {
    const { businessId, branchId, userId } = request.user as JwtPayload
    const now = new Date()
    const batchId = crypto.randomUUID()

    // Validar que el producto exista y pertenezca al negocio
    const producto = await fastify.prisma.product.findFirst({
      where: { id: request.body.productId, businessId, activo: true },
    })
    if (!producto) {
      return reply.code(422).send({ error: 'Producto no encontrado o inactivo' })
    }

    // Validar proveedor si se envió
    if (request.body.supplierId) {
      const proveedor = await fastify.prisma.supplier.findFirst({
        where: { id: request.body.supplierId, businessId },
      })
      if (!proveedor) {
        return reply.code(422).send({ error: 'Proveedor no encontrado' })
      }
    }

    // Validar que la fecha de vencimiento sea futura
    const fechaVenc = new Date(request.body.fechaVencimientoEstimada)
    if (fechaVenc <= now) {
      return reply.code(400).send({ error: 'La fecha de vencimiento estimada debe ser una fecha futura' })
    }

    const costoTotal = request.body.cantidadInicialKg * request.body.costoUnitario

    const lote = await fastify.prisma.$transaction(async (tx: Tx) => {
      const b = await tx.batch.create({
        data: {
          id: batchId,
          businessId,
          branchId,
          productId: request.body.productId,
          supplierId: request.body.supplierId,
          tipoIngreso: request.body.tipoIngreso ?? 'COMPRA_DIRECTA',
          fechaEntrada: now,
          cantidadInicialKg: request.body.cantidadInicialKg,
          cantidadActualKg: request.body.cantidadInicialKg,
          costoUnitario: request.body.costoUnitario,
          costoTotal,
          envaseCantidad: request.body.envaseCantidad ?? 0,
          fechaVencimientoEstimada: fechaVenc,
          estado: 'FRESCO',
          notas: request.body.notas,
          syncStatus: 'SYNCED',
          createdAt: now,
          updatedAt: now,
        },
      })

      await tx.stockMovement.create({
        data: {
          id: crypto.randomUUID(),
          batchId,
          tipo: 'ENTRADA',
          cantidadKg: request.body.cantidadInicialKg,
          motivo: 'Ingreso inicial de lote',
          registradoPor: userId,
          fecha: now,
          syncStatus: 'SYNCED',
          createdAt: now,
          updatedAt: now,
        },
      })

      return b
    })

    return reply.code(201).send(lote)
  })

  // PATCH /lotes/:id/ajuste — Ajustar stock
  fastify.patch<{
    Params: { id: string }
    Body: { cantidadKg: number; motivo: string }
  }>('/lotes/:id/ajuste', { ...patchAjusteSchema, preHandler: [requireAdmin] }, async (request, reply) => {
    const { businessId, userId } = request.user as JwtPayload
    const now = new Date()

    const lote = await fastify.prisma.batch.findFirst({
      where: { id: request.params.id, businessId },
    })
    if (!lote) return reply.code(404).send({ error: 'Lote no encontrado' })

    const nuevaCantidad = lote.cantidadActualKg + request.body.cantidadKg

    // Validar que el ajuste no resulte en stock negativo
    if (nuevaCantidad < 0) {
      return reply.code(422).send({
        error: 'El ajuste resultaría en stock negativo',
        detalle: {
          stockActual: lote.cantidadActualKg,
          ajuste: request.body.cantidadKg,
          resultadoSiAplicara: nuevaCantidad,
        },
      })
    }

    await fastify.prisma.$transaction(async (tx: Tx) => {
      await tx.batch.update({
        where: { id: request.params.id },
        data: { cantidadActualKg: nuevaCantidad, updatedAt: now },
      })
      await tx.stockMovement.create({
        data: {
          id: crypto.randomUUID(),
          batchId: request.params.id,
          tipo: 'AJUSTE',
          cantidadKg: request.body.cantidadKg,
          motivo: request.body.motivo,
          registradoPor: userId,
          fecha: now,
          syncStatus: 'SYNCED',
          createdAt: now,
          updatedAt: now,
        },
      })
    })

    return { cantidadActualKg: nuevaCantidad }
  })

  // GET /proveedores
  fastify.get('/proveedores', async (request) => {
    const { businessId } = request.user as JwtPayload
    return fastify.prisma.supplier.findMany({
      where: { businessId },
      orderBy: { nombre: 'asc' },
    })
  })

  // POST /proveedores
  fastify.post<{
    Body: { nombre: string; celular?: string; tipo?: string; zonaOrigen?: string; comisionConsignacion?: number }
  }>('/proveedores', { ...postProveedorSchema, preHandler: [requireAdmin] }, async (request, reply) => {
    const { businessId } = request.user as JwtPayload
    const now = new Date()
    const proveedor = await fastify.prisma.supplier.create({
      data: {
        id: crypto.randomUUID(),
        businessId,
        ...request.body,
        tipo: request.body.tipo ?? 'DIRECTO',
        syncStatus: 'SYNCED',
        createdAt: now,
        updatedAt: now,
      },
    })
    return reply.code(201).send(proveedor)
  })
}
