import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

type JwtPayload = { userId: string; businessId: string; branchId: string; rol: string }
type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

const saleItemSchema = {
  type: 'object',
  required: ['productId', 'cantidad', 'unidadVenta', 'pesoNetoKg', 'precioUnitario', 'subtotal'],
  properties: {
    productId: { type: 'string', minLength: 1 },
    batchId: { type: 'string', minLength: 1 },
    cantidad: { type: 'number', minimum: 0.001 },
    unidadVenta: { type: 'string', minLength: 1 },
    pesoNetoKg: { type: 'number', minimum: 0 },
    precioUnitario: { type: 'number', minimum: 0 },
    subtotal: { type: 'number', minimum: 0 },
  },
  additionalProperties: false,
}

const postVentaSchema = {
  schema: {
    body: {
      type: 'object',
      required: ['items', 'metodoPago', 'total', 'montoPagado'],
      properties: {
        clientId: { type: 'string', minLength: 1 },
        items: { type: 'array', items: saleItemSchema, minItems: 1 },
        metodoPago: { type: 'string', enum: ['EFECTIVO', 'YAPE', 'CREDITO'] },
        total: { type: 'number', minimum: 0.01 },
        montoPagado: { type: 'number', minimum: 0 },
        notas: { type: 'string', maxLength: 500 },
      },
      additionalProperties: false,
    },
  },
}

export async function ventasRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'No autorizado' })
    }
  })

  // GET /ventas — Ventas del día con paginación
  fastify.get<{ Querystring: { fecha?: string; page?: string; limit?: string } }>('/ventas', async (request) => {
    const { businessId } = request.user as JwtPayload
    const fecha = request.query.fecha ? new Date(request.query.fecha) : new Date()
    const inicioDia = new Date(fecha)
    inicioDia.setHours(0, 0, 0, 0)
    const finDia = new Date(fecha)
    finDia.setHours(23, 59, 59, 999)

    const page = Math.max(1, parseInt(request.query.page ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '50')))
    const skip = (page - 1) * limit

    const where = { businessId, fecha: { gte: inicioDia, lte: finDia } }

    const [items, total] = await Promise.all([
      fastify.prisma.sale.findMany({
        where,
        include: {
          client: { select: { nombre: true, nombreCorto: true } },
          saleItems: { include: { product: { select: { nombre: true, nombreCorto: true } } } },
        },
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
      }),
      fastify.prisma.sale.count({ where }),
    ])

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
  })

  // POST /ventas — Registrar venta
  fastify.post<{
    Body: {
      clientId?: string
      items: Array<{
        productId: string
        batchId?: string
        cantidad: number
        unidadVenta: string
        pesoNetoKg: number
        precioUnitario: number
        subtotal: number
      }>
      metodoPago: 'EFECTIVO' | 'YAPE' | 'CREDITO'
      total: number
      montoPagado: number
      notas?: string
    }
  }>('/ventas', postVentaSchema, async (request, reply) => {
    const { businessId, branchId, userId } = request.user as JwtPayload
    const { clientId, items, metodoPago, total, montoPagado } = request.body
    const now = new Date()
    const saleId = crypto.randomUUID()

    // Validar que montoPagado no supere el total en ventas no-crédito
    if (metodoPago !== 'CREDITO' && montoPagado < total) {
      return reply.code(400).send({ error: 'Monto pagado insuficiente para el total de la venta' })
    }

    // Validar clientId si se envió
    if (clientId) {
      const cliente = await fastify.prisma.client.findFirst({
        where: { id: clientId, businessId, activo: true },
        include: { creditProfile: true },
      })
      if (!cliente) {
        return reply.code(422).send({ error: 'Cliente no encontrado o inactivo' })
      }

      // Validar límite de crédito antes de crear la venta
      if (metodoPago === 'CREDITO') {
        const montoPendiente = total - montoPagado
        const perfil = cliente.creditProfile

        if (!perfil) {
          return reply.code(422).send({ error: 'El cliente no tiene perfil de crédito configurado' })
        }
        if (perfil.estado === 'BLOQUEADO') {
          return reply.code(422).send({ error: 'El cliente tiene el crédito bloqueado' })
        }
        if (perfil.limiteCredito > 0 && perfil.saldoActual + montoPendiente > perfil.limiteCredito) {
          return reply.code(422).send({
            error: 'La venta supera el límite de crédito del cliente',
            detalle: {
              limiteCredito: perfil.limiteCredito,
              saldoActual: perfil.saldoActual,
              montoSolicitado: montoPendiente,
              disponible: Math.max(0, perfil.limiteCredito - perfil.saldoActual),
            },
          })
        }
      }
    } else if (metodoPago === 'CREDITO') {
      return reply.code(400).send({ error: 'Se requiere clientId para ventas a crédito' })
    }

    // Validar que cada productId y batchId existan y pertenezcan al negocio
    for (const item of items) {
      const producto = await fastify.prisma.product.findFirst({
        where: { id: item.productId, businessId, activo: true },
      })
      if (!producto) {
        return reply.code(422).send({ error: `Producto no encontrado o inactivo: ${item.productId}` })
      }

      if (item.batchId) {
        const lote = await fastify.prisma.batch.findFirst({
          where: { id: item.batchId, businessId },
        })
        if (!lote) {
          return reply.code(422).send({ error: `Lote no encontrado: ${item.batchId}` })
        }
        if (lote.cantidadActualKg < item.pesoNetoKg) {
          return reply.code(422).send({
            error: `Stock insuficiente en lote ${item.batchId}`,
            detalle: { stockDisponible: lote.cantidadActualKg, solicitado: item.pesoNetoKg },
          })
        }
      }
    }

    // Obtener correlativo
    const configCorrelativo = await fastify.prisma.configuracion.findFirst({
      where: { businessId, clave: 'correlativo_venta' },
    })
    const correlativo = parseInt(configCorrelativo?.valor ?? '0') + 1
    const numeroTicket = `T-${String(correlativo).padStart(6, '0')}`

    const montoPendiente = metodoPago === 'CREDITO' ? total - montoPagado : 0

    const venta = await fastify.prisma.$transaction(async (tx: Tx) => {
      const sale = await tx.sale.create({
        data: {
          id: saleId,
          businessId,
          branchId,
          userId,
          clientId,
          numeroTicket,
          fecha: now,
          subtotal: total,
          total,
          metodoPago,
          estadoPago: metodoPago === 'CREDITO' ? 'CREDITO_PENDIENTE' : 'PAGADO',
          montoPagado,
          montoPendiente,
          notas: request.body.notas,
          syncStatus: 'SYNCED',
          deviceId: 'api-server',
          createdAt: now,
          updatedAt: now,
        },
      })

      for (const item of items) {
        const itemId = crypto.randomUUID()
        await tx.saleItem.create({
          data: {
            id: itemId,
            saleId,
            productId: item.productId,
            batchId: item.batchId,
            cantidad: item.cantidad,
            unidadVenta: item.unidadVenta,
            pesoNetoKg: item.pesoNetoKg,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
            syncStatus: 'SYNCED',
            createdAt: now,
            updatedAt: now,
          },
        })

        if (item.batchId) {
          await tx.batch.update({
            where: { id: item.batchId },
            data: {
              cantidadActualKg: { decrement: item.pesoNetoKg },
              updatedAt: now,
            },
          })
          await tx.stockMovement.create({
            data: {
              id: crypto.randomUUID(),
              batchId: item.batchId,
              tipo: 'VENTA',
              cantidadKg: -item.pesoNetoKg,
              motivo: `Venta ${numeroTicket}`,
              saleItemId: itemId,
              registradoPor: userId,
              fecha: now,
              syncStatus: 'SYNCED',
              createdAt: now,
              updatedAt: now,
            },
          })
        }
      }

      // Actualizar saldo de crédito del cliente
      if (metodoPago === 'CREDITO' && clientId) {
        await tx.creditProfile.updateMany({
          where: { clientId },
          data: {
            saldoActual: { increment: montoPendiente },
            totalHistoricoCredito: { increment: total },
            updatedAt: now,
          },
        })
      }

      // Actualizar correlativo
      if (configCorrelativo?.id) {
        await tx.configuracion.update({
          where: { id: configCorrelativo.id },
          data: { valor: String(correlativo), updatedAt: now },
        })
      }

      return sale
    })

    return reply.code(201).send(venta)
  })

  // GET /ventas/resumen — Resumen del día
  fastify.get('/ventas/resumen', async (request) => {
    const { businessId } = request.user as JwtPayload
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const finDia = new Date()
    finDia.setHours(23, 59, 59, 999)

    const [ventasHoy, porMetodo] = await Promise.all([
      fastify.prisma.sale.aggregate({
        where: { businessId, fecha: { gte: hoy, lte: finDia } },
        _sum: { total: true },
        _count: true,
      }),
      fastify.prisma.sale.groupBy({
        by: ['metodoPago'],
        where: { businessId, fecha: { gte: hoy, lte: finDia } },
        _sum: { total: true },
        _count: true,
      }),
    ])

    return {
      totalVentas: ventasHoy._sum.total ?? 0,
      cantidadVentas: ventasHoy._count,
      porMetodoPago: porMetodo,
    }
  })
}
