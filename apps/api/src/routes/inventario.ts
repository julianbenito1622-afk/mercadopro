import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

type JwtPayload = { userId: string; businessId: string; branchId: string; rol: string }
type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export async function inventarioRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'No autorizado' })
    }
  })

  // GET /lotes
  fastify.get<{ Querystring: { estado?: string } }>('/lotes', async (request) => {
    const { businessId } = request.user as JwtPayload
    const where: Record<string, unknown> = { businessId }
    if (request.query.estado) where['estado'] = request.query.estado

    return fastify.prisma.batch.findMany({
      where,
      include: {
        product: { select: { nombre: true, nombreCorto: true, unidadVentaPrincipal: true } },
        supplier: { select: { nombre: true } },
      },
      orderBy: { fechaVencimientoEstimada: 'asc' },
    })
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
  }>('/lotes', async (request, reply) => {
    const { businessId, branchId, userId } = request.user as JwtPayload
    const now = new Date()
    const batchId = crypto.randomUUID()
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
          fechaVencimientoEstimada: new Date(request.body.fechaVencimientoEstimada),
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
  }>('/lotes/:id/ajuste', async (request, reply) => {
    const { businessId, userId } = request.user as JwtPayload
    const now = new Date()

    const lote = await fastify.prisma.batch.findFirst({
      where: { id: request.params.id, businessId },
    })
    if (!lote) return reply.code(404).send({ error: 'Lote no encontrado' })

    const nuevaCantidad = lote.cantidadActualKg + request.body.cantidadKg

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
  }>('/proveedores', async (request, reply) => {
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
