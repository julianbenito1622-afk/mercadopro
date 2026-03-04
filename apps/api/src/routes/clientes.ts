import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

type JwtPayload = { userId: string; businessId: string; branchId: string; rol: string }
type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export async function clientesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'No autorizado' })
    }
  })

  // GET /clientes
  fastify.get('/clientes', async (request) => {
    const { businessId } = request.user as JwtPayload
    return fastify.prisma.client.findMany({
      where: { businessId, activo: true },
      include: { creditProfile: true },
      orderBy: [{ esFrecuente: 'desc' }, { nombre: 'asc' }],
    })
  })

  // GET /clientes/:id
  fastify.get<{ Params: { id: string } }>('/clientes/:id', async (request, reply) => {
    const { businessId } = request.user as JwtPayload
    const cliente = await fastify.prisma.client.findFirst({
      where: { id: request.params.id, businessId },
      include: {
        creditProfile: true,
        payments: { orderBy: { fecha: 'desc' }, take: 5 },
      },
    })
    if (!cliente) return reply.code(404).send({ error: 'Cliente no encontrado' })
    return cliente
  })

  // POST /clientes
  fastify.post<{
    Body: {
      nombre: string
      nombreCorto: string
      celular?: string
      tipo?: string
      dniRuc?: string
      esFrecuente?: boolean
      limiteCredito?: number
      plazoDias?: number
    }
  }>('/clientes', async (request, reply) => {
    const { businessId } = request.user as JwtPayload
    const now = new Date()
    const clientId = crypto.randomUUID()

    const cliente = await fastify.prisma.$transaction(async (tx: Tx) => {
      const c = await tx.client.create({
        data: {
          id: clientId,
          businessId,
          nombre: request.body.nombre,
          nombreCorto: request.body.nombreCorto,
          celular: request.body.celular,
          tipo: request.body.tipo ?? 'MINORISTA',
          dniRuc: request.body.dniRuc,
          esFrecuente: request.body.esFrecuente ?? false,
          syncStatus: 'SYNCED',
          createdAt: now,
          updatedAt: now,
        },
      })

      await tx.creditProfile.create({
        data: {
          id: crypto.randomUUID(),
          clientId,
          limiteCredito: request.body.limiteCredito ?? 0,
          plazoDias: request.body.plazoDias ?? 3,
          syncStatus: 'SYNCED',
          createdAt: now,
          updatedAt: now,
        },
      })

      return c
    })

    return reply.code(201).send(cliente)
  })

  // PATCH /clientes/:id
  fastify.patch<{
    Params: { id: string }
    Body: Partial<{
      nombre: string
      nombreCorto: string
      celular: string
      tipo: string
      esFrecuente: boolean
      activo: boolean
      limiteCredito: number
      plazoDias: number
      estadoCredito: string
    }>
  }>('/clientes/:id', async (request, reply) => {
    const { businessId } = request.user as JwtPayload
    const now = new Date()

    const existing = await fastify.prisma.client.findFirst({
      where: { id: request.params.id, businessId },
    })
    if (!existing) return reply.code(404).send({ error: 'Cliente no encontrado' })

    const { limiteCredito, plazoDias, estadoCredito, ...clientData } = request.body

    await fastify.prisma.$transaction(async (tx: Tx) => {
      await tx.client.update({
        where: { id: request.params.id },
        data: { ...clientData, updatedAt: now },
      })

      if (limiteCredito !== undefined || plazoDias !== undefined || estadoCredito !== undefined) {
        await tx.creditProfile.updateMany({
          where: { clientId: request.params.id },
          data: {
            ...(limiteCredito !== undefined && { limiteCredito }),
            ...(plazoDias !== undefined && { plazoDias }),
            ...(estadoCredito !== undefined && { estado: estadoCredito }),
            updatedAt: now,
          },
        })
      }
    })

    return fastify.prisma.client.findFirst({
      where: { id: request.params.id },
      include: { creditProfile: true },
    })
  })

  // GET /clientes/:id/deuda — Saldo actual del cliente
  fastify.get<{ Params: { id: string } }>('/clientes/:id/deuda', async (request, reply) => {
    const { businessId } = request.user as JwtPayload
    const cliente = await fastify.prisma.client.findFirst({
      where: { id: request.params.id, businessId },
      include: { creditProfile: true },
    })
    if (!cliente) return reply.code(404).send({ error: 'Cliente no encontrado' })

    const ventasPendientes = await fastify.prisma.sale.findMany({
      where: { clientId: request.params.id, estadoPago: 'CREDITO_PENDIENTE' },
      orderBy: { fecha: 'asc' },
    })

    return {
      saldoActual: cliente.creditProfile?.saldoActual ?? 0,
      limiteCredito: cliente.creditProfile?.limiteCredito ?? 0,
      ventasPendientes,
    }
  })
}
