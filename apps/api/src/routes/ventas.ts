import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

type JwtPayload = { userId: string; businessId: string; branchId: string; rol: string }
type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export async function ventasRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'No autorizado' })
    }
  })

  // GET /ventas — Ventas del día
  fastify.get<{ Querystring: { fecha?: string } }>('/ventas', async (request) => {
    const { businessId } = request.user as JwtPayload
    const fecha = request.query.fecha ? new Date(request.query.fecha) : new Date()
    const inicioDia = new Date(fecha)
    inicioDia.setHours(0, 0, 0, 0)
    const finDia = new Date(fecha)
    finDia.setHours(23, 59, 59, 999)

    return fastify.prisma.sale.findMany({
      where: {
        businessId,
        fecha: { gte: inicioDia, lte: finDia },
      },
      include: {
        client: { select: { nombre: true, nombreCorto: true } },
        saleItems: { include: { product: { select: { nombre: true, nombreCorto: true } } } },
      },
      orderBy: { fecha: 'desc' },
    })
  })

  // POST /ventas — Registrar venta (desde sync o directa)
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
  }>('/ventas', async (request, reply) => {
    const { businessId, branchId, userId } = request.user as JwtPayload
    const now = new Date()
    const saleId = crypto.randomUUID()

    // Obtener correlativo
    const configCorrelativo = await fastify.prisma.configuracion.findFirst({
      where: { businessId, clave: 'correlativo_venta' },
    })
    const correlativo = parseInt(configCorrelativo?.valor ?? '0') + 1
    const numeroTicket = `T-${String(correlativo).padStart(6, '0')}`

    const montoPendiente = request.body.metodoPago === 'CREDITO'
      ? request.body.total - request.body.montoPagado
      : 0

    const venta = await fastify.prisma.$transaction(async (tx: Tx) => {
      // Crear venta
      const sale = await tx.sale.create({
        data: {
          id: saleId,
          businessId,
          branchId,
          userId,
          clientId: request.body.clientId,
          numeroTicket,
          fecha: now,
          subtotal: request.body.total,
          total: request.body.total,
          metodoPago: request.body.metodoPago,
          estadoPago: request.body.metodoPago === 'CREDITO' ? 'CREDITO_PENDIENTE' : 'PAGADO',
          montoPagado: request.body.montoPagado,
          montoPendiente,
          notas: request.body.notas,
          syncStatus: 'SYNCED',
          deviceId: 'api-server',
          createdAt: now,
          updatedAt: now,
        },
      })

      // Crear items
      for (const item of request.body.items) {
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

        // Descontar stock del lote si aplica
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
      if (request.body.metodoPago === 'CREDITO' && request.body.clientId) {
        await tx.creditProfile.updateMany({
          where: { clientId: request.body.clientId },
          data: {
            saldoActual: { increment: montoPendiente },
            totalHistoricoCredito: { increment: request.body.total },
            updatedAt: now,
          },
        })
      }

      // Actualizar correlativo
      await tx.configuracion.update({
        where: { id: configCorrelativo?.id },
        data: { valor: String(correlativo), updatedAt: now },
      })

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
