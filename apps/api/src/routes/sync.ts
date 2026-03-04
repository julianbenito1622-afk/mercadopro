import { FastifyInstance } from 'fastify'
import crypto from 'crypto'

// Tablas sincronizables y su orden de inserción (respeta FK)
const SYNC_ORDER = [
  'category',
  'container_type',
  'supplier',
  'product',
  'product_unit',
  'client',
  'credit_profile',
  'batch',
  'stock_movement',
  'sale',
  'sale_item',
  'payment',
  'price_history',
  'consignment',
  'consignment_batch',
]

// Mapeo tabla → modelo Prisma
const TABLE_TO_MODEL: Record<string, string> = {
  category: 'category',
  container_type: 'containerType',
  supplier: 'supplier',
  product: 'product',
  product_unit: 'productUnit',
  client: 'client',
  credit_profile: 'creditProfile',
  batch: 'batch',
  stock_movement: 'stockMovement',
  sale: 'sale',
  sale_item: 'saleItem',
  payment: 'payment',
  price_history: 'priceHistory',
  consignment: 'consignment',
  consignment_batch: 'consignmentBatch',
}

type JwtPayload = {
  userId: string
  businessId: string
  branchId: string
  rol: string
}

export async function syncRoutes(fastify: FastifyInstance) {
  // Middleware de autenticación para todas las rutas de sync
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'No autorizado' })
    }
  })

  // POST /sync/push — Enviar cambios locales al servidor
  fastify.post<{
    Body: {
      deviceId: string
      registros: Array<{
        id: string
        tabla: string
        operacion: 'INSERT' | 'UPDATE' | 'DELETE'
        datos: Record<string, unknown>
        timestampLocal: string
      }>
    }
  }>('/sync/push', async (request, reply) => {
    const { userId, businessId } = request.user as JwtPayload
    const { deviceId, registros } = request.body
    const now = new Date()

    const resultados: Array<{ id: string; estado: 'OK' | 'ERROR'; error?: string }> = []

    // Ordenar registros según dependencias
    const ordenados = [...registros].sort((a, b) => {
      const ia = SYNC_ORDER.indexOf(a.tabla)
      const ib = SYNC_ORDER.indexOf(b.tabla)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })

    for (const registro of ordenados) {
      try {
        const modelo = TABLE_TO_MODEL[registro.tabla]
        if (!modelo) {
          resultados.push({ id: registro.id, estado: 'ERROR', error: `Tabla desconocida: ${registro.tabla}` })
          continue
        }

        // Inyectar businessId para seguridad (evitar que un device escriba en otro negocio)
        const datos = {
          ...registro.datos,
          syncStatus: 'SYNCED',
        }

        // Verificar que el registro pertenece al negocio del usuario
        if ('businessId' in datos && datos.businessId !== businessId) {
          resultados.push({ id: registro.id, estado: 'ERROR', error: 'Registro no pertenece a este negocio' })
          continue
        }

        const prismaModel = (fastify.prisma as unknown as Record<string, unknown>)[modelo] as {
          upsert: (args: unknown) => Promise<unknown>
          delete: (args: unknown) => Promise<unknown>
        }

        if (registro.operacion === 'DELETE') {
          await prismaModel.delete({ where: { id: registro.datos['id'] } })
        } else {
          // Upsert: INSERT o UPDATE
          await prismaModel.upsert({
            where: { id: registro.datos['id'] },
            create: datos,
            update: { ...datos, updatedAt: now },
          })
        }

        // Registrar en sync_log del servidor
        await fastify.prisma.syncLog.create({
          data: {
            id: crypto.randomUUID(),
            deviceId,
            businessId,
            tabla: registro.tabla,
            registroId: String(registro.datos['id']),
            operacion: registro.operacion,
            datosJson: JSON.stringify(registro.datos),
            timestampLocal: new Date(registro.timestampLocal),
            timestampServidor: now,
            estado: 'APLICADO',
            createdAt: now,
            updatedAt: now,
          },
        })

        resultados.push({ id: registro.id, estado: 'OK' })
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Error desconocido'
        resultados.push({ id: registro.id, estado: 'ERROR', error })

        // Registrar fallo en log
        await fastify.prisma.syncLog.create({
          data: {
            id: crypto.randomUUID(),
            deviceId,
            businessId,
            tabla: registro.tabla,
            registroId: String(registro.datos['id'] ?? 'unknown'),
            operacion: registro.operacion,
            datosJson: JSON.stringify(registro.datos),
            timestampLocal: new Date(registro.timestampLocal),
            estado: 'ERROR',
            error,
            createdAt: now,
            updatedAt: now,
          },
        })
      }
    }

    const exitosos = resultados.filter((r) => r.estado === 'OK').length
    return { sincronizados: exitosos, total: registros.length, resultados }
  })

  // GET /sync/pull — Obtener cambios del servidor desde última sincronización
  fastify.get<{
    Querystring: { desde?: string; tablas?: string }
  }>('/sync/pull', async (request, reply) => {
    const { businessId } = request.user as JwtPayload
    const { desde, tablas } = request.query

    const desdeDate = desde ? new Date(desde) : new Date(0)
    const tablasFilter = tablas ? tablas.split(',') : SYNC_ORDER

    const cambios: Record<string, unknown[]> = {}

    for (const tabla of tablasFilter) {
      const modelo = TABLE_TO_MODEL[tabla]
      if (!modelo) continue

      const prismaModel = (fastify.prisma as unknown as Record<string, unknown>)[modelo] as {
        findMany: (args: unknown) => Promise<unknown[]>
      }

      try {
        // Buscar registros actualizados desde la última sync, filtrados por businessId
        const whereClause: Record<string, unknown> = {
          updatedAt: { gt: desdeDate },
        }

        // Solo tablas con businessId directo
        if (['category', 'supplier', 'product', 'client', 'batch', 'consignment', 'containerType'].includes(modelo)) {
          whereClause['businessId'] = businessId
        }

        const registros = await prismaModel.findMany({ where: whereClause })
        cambios[tabla] = registros
      } catch {
        cambios[tabla] = []
      }
    }

    return {
      timestamp: new Date().toISOString(),
      cambios,
    }
  })

  // GET /sync/estado — Estado de sincronización del dispositivo
  fastify.get<{
    Querystring: { deviceId: string }
  }>('/sync/estado', async (request, reply) => {
    const { businessId } = request.user as JwtPayload
    const { deviceId } = request.query

    const [pendientes, errores, ultima] = await Promise.all([
      fastify.prisma.syncLog.count({
        where: { businessId, deviceId, estado: 'PENDIENTE' },
      }),
      fastify.prisma.syncLog.count({
        where: { businessId, deviceId, estado: 'ERROR' },
      }),
      fastify.prisma.syncLog.findFirst({
        where: { businessId, deviceId, estado: 'APLICADO' },
        orderBy: { timestampServidor: 'desc' },
      }),
    ])

    return {
      pendientes,
      errores,
      ultimaSincronizacion: ultima?.timestampServidor ?? null,
    }
  })
}
