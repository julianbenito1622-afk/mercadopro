import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/registro — Crear nuevo negocio + usuario admin
  fastify.post<{
    Body: {
      negocio: { nombre: string; ruc?: string; mercado?: string }
      usuario: { nombre: string; celular: string; pin: string }
    }
  }>('/auth/registro', {
    schema: {
      body: {
        type: 'object',
        required: ['negocio', 'usuario'],
        properties: {
          negocio: {
            type: 'object',
            required: ['nombre'],
            properties: {
              nombre: { type: 'string', minLength: 2 },
              ruc: { type: 'string' },
              mercado: { type: 'string' },
            },
          },
          usuario: {
            type: 'object',
            required: ['nombre', 'celular', 'pin'],
            properties: {
              nombre: { type: 'string', minLength: 2 },
              celular: { type: 'string', pattern: '^[0-9]{9}$' },
              pin: { type: 'string', minLength: 4, maxLength: 6 },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { negocio, usuario } = request.body
    const now = new Date()

    const businessId = crypto.randomUUID()
    const branchId = crypto.randomUUID()
    const userId = crypto.randomUUID()

    // Crear negocio, sucursal principal y usuario admin en una transacción
    await fastify.prisma.$transaction(async (tx: Tx) => {
      await tx.business.create({
        data: {
          id: businessId,
          nombre: negocio.nombre,
          ruc: negocio.ruc,
          mercado: negocio.mercado,
          syncStatus: 'SYNCED',
          createdAt: now,
          updatedAt: now,
        },
      })

      await tx.branch.create({
        data: {
          id: branchId,
          businessId,
          nombre: 'Principal',
          syncStatus: 'SYNCED',
          createdAt: now,
          updatedAt: now,
        },
      })

      // PIN hasheado
      const pinHash = crypto.createHash('sha256').update(usuario.pin).digest('hex')

      await tx.appUser.create({
        data: {
          id: userId,
          businessId,
          branchId,
          nombre: usuario.nombre,
          celular: usuario.celular,
          pin: pinHash,
          rol: 'ADMIN',
          syncStatus: 'SYNCED',
          createdAt: now,
          updatedAt: now,
        },
      })

      // Categorías por defecto
      const categorias = ['Tubérculos', 'Frutas', 'Verduras', 'Carnes', 'Otros']
      for (let i = 0; i < categorias.length; i++) {
        await tx.category.create({
          data: {
            id: crypto.randomUUID(),
            businessId,
            nombre: categorias[i],
            orden: i + 1,
            syncStatus: 'SYNCED',
            createdAt: now,
            updatedAt: now,
          },
        })
      }

      // Correlativo de tickets
      await tx.configuracion.create({
        data: {
          id: crypto.randomUUID(),
          businessId,
          clave: 'correlativo_venta',
          valor: '0',
          createdAt: now,
          updatedAt: now,
        },
      })
    })

    const token = fastify.jwt.sign({
      userId,
      businessId,
      branchId,
      rol: 'ADMIN',
    })

    return reply.code(201).send({
      token,
      businessId,
      branchId,
      userId,
    })
  })

  // POST /auth/login — Login con celular + PIN
  fastify.post<{
    Body: { celular: string; pin: string }
  }>('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['celular', 'pin'],
        properties: {
          celular: { type: 'string' },
          pin: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { celular, pin } = request.body
    const pinHash = crypto.createHash('sha256').update(pin).digest('hex')

    const user = await fastify.prisma.appUser.findFirst({
      where: { celular, pin: pinHash, activo: true },
    })

    if (!user) {
      return reply.code(401).send({ error: 'Credenciales inválidas' })
    }

    const token = fastify.jwt.sign({
      userId: user.id,
      businessId: user.businessId,
      branchId: user.branchId,
      rol: user.rol,
    })

    return { token, userId: user.id, businessId: user.businessId, branchId: user.branchId, rol: user.rol }
  })
}
