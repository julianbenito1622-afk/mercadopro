import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

type JwtPayload = { userId: string; businessId: string; branchId: string; rol: string }
type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

const postClienteSchema = {
  schema: {
    body: {
      type: 'object',
      required: ['nombre', 'nombreCorto'],
      properties: {
        nombre: { type: 'string', minLength: 2, maxLength: 100 },
        nombreCorto: { type: 'string', minLength: 1, maxLength: 20 },
        celular: { type: 'string', pattern: '^[0-9]{9}$' },
        tipo: { type: 'string', enum: ['MINORISTA', 'MAYORISTA', 'RESTAURANTE', 'OTRO'] },
        dniRuc: { type: 'string', minLength: 8, maxLength: 11 },
        esFrecuente: { type: 'boolean' },
        limiteCredito: { type: 'number', minimum: 0 },
        plazoDias: { type: 'integer', minimum: 1, maximum: 365 },
      },
      additionalProperties: false,
    },
  },
}

const patchClienteSchema = {
  schema: {
    body: {
      type: 'object',
      minProperties: 1,
      properties: {
        nombre: { type: 'string', minLength: 2, maxLength: 100 },
        nombreCorto: { type: 'string', minLength: 1, maxLength: 20 },
        celular: { type: 'string', pattern: '^[0-9]{9}$' },
        tipo: { type: 'string', enum: ['MINORISTA', 'MAYORISTA', 'RESTAURANTE', 'OTRO'] },
        esFrecuente: { type: 'boolean' },
        activo: { type: 'boolean' },
        limiteCredito: { type: 'number', minimum: 0 },
        plazoDias: { type: 'integer', minimum: 1, maximum: 365 },
        estadoCredito: { type: 'string', enum: ['AL_DIA', 'POR_VENCER', 'VENCIDO', 'BLOQUEADO'] },
      },
      additionalProperties: false,
    },
  },
}

export async function clientesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'No autorizado' })
    }
  })

  // GET /clientes
  fastify.get<{ Querystring: { page?: string; limit?: string; buscar?: string } }>('/clientes', async (request) => {
    const { businessId } = request.user as JwtPayload
    const page = Math.max(1, parseInt(request.query.page ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '50')))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { businessId, activo: true }
    if (request.query.buscar) {
      where['OR'] = [
        { nombre: { contains: request.query.buscar, mode: 'insensitive' } },
        { nombreCorto: { contains: request.query.buscar, mode: 'insensitive' } },
        { celular: { contains: request.query.buscar } },
      ]
    }

    const [items, total] = await Promise.all([
      fastify.prisma.client.findMany({
        where,
        include: { creditProfile: true },
        orderBy: [{ esFrecuente: 'desc' }, { nombre: 'asc' }],
        skip,
        take: limit,
      }),
      fastify.prisma.client.count({ where }),
    ])

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
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
  }>('/clientes', postClienteSchema, async (request, reply) => {
    const { businessId } = request.user as JwtPayload
    const now = new Date()
    const clientId = crypto.randomUUID()

    // Validar unicidad de celular dentro del negocio
    if (request.body.celular) {
      const existe = await fastify.prisma.client.findFirst({
        where: { businessId, celular: request.body.celular, activo: true },
      })
      if (existe) {
        return reply.code(422).send({ error: 'Ya existe un cliente activo con ese número de celular' })
      }
    }

    // Validar unicidad de dniRuc dentro del negocio
    if (request.body.dniRuc) {
      const existe = await fastify.prisma.client.findFirst({
        where: { businessId, dniRuc: request.body.dniRuc },
      })
      if (existe) {
        return reply.code(422).send({ error: 'Ya existe un cliente con ese DNI/RUC' })
      }
    }

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
  }>('/clientes/:id', patchClienteSchema, async (request, reply) => {
    const { businessId } = request.user as JwtPayload
    const now = new Date()

    const existing = await fastify.prisma.client.findFirst({
      where: { id: request.params.id, businessId },
    })
    if (!existing) return reply.code(404).send({ error: 'Cliente no encontrado' })

    // Validar unicidad de celular si se cambia
    if (request.body.celular && request.body.celular !== existing.celular) {
      const ocupado = await fastify.prisma.client.findFirst({
        where: { businessId, celular: request.body.celular, activo: true, id: { not: request.params.id } },
      })
      if (ocupado) {
        return reply.code(422).send({ error: 'Ya existe otro cliente activo con ese número de celular' })
      }
    }

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
            ...(estadoCredito !== undefined && { estadoCredito }),
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
