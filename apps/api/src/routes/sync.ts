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

// Límite de registros por tabla en pull
const PULL_LIMIT_POR_TABLA = 500

type JwtPayload = {
  userId: string
  businessId: string
  branchId: string
  rol: string
}

export async function syncRoutes(fastify: FastifyInstance) {
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

    const resultados: Array<{ id: string; estado: 'OK' | 'OMITIDO' | 'ERROR'; error?: string; motivo?: string }> = []

    // Ordenar registros según dependencias FK
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

        // Verificar que el registro pertenece al negocio del usuario
        const datos = { ...registro.datos, syncStatus: 'SYNCED' }
        if ('businessId' in datos && datos.businessId !== businessId) {
          resultados.push({ id: registro.id, estado: 'ERROR', error: 'Registro no pertenece a este negocio' })
          continue
        }

        const prismaModel = (fastify.prisma as unknown as Record<string, unknown>)[modelo] as {
          findUnique: (args: unknown) => Promise<{ updatedAt?: Date } | null>
          upsert: (args: unknown) => Promise<unknown>
          delete: (args: unknown) => Promise<unknown>
        }

        if (registro.operacion === 'DELETE') {
          // Para DELETE: verificar que exista y pertenezca al negocio
          const existente = await prismaModel.findUnique({ where: { id: registro.datos['id'] } })
          if (existente) {
            await prismaModel.delete({ where: { id: registro.datos['id'] } })
          }
        } else {
          // Resolución de conflictos: last-write-wins basado en updatedAt
          const existente = await prismaModel.findUnique({ where: { id: registro.datos['id'] } })

          if (existente?.updatedAt) {
            const tsServidor = new Date(existente.updatedAt).getTime()
            const tsCliente = new Date(registro.timestampLocal).getTime()

            // Si el servidor tiene una versión más reciente, omitir el cambio del cliente
            if (tsServidor > tsCliente) {
              resultados.push({
                id: registro.id,
                estado: 'OMITIDO',
                motivo: `Versión del servidor más reciente (${existente.updatedAt.toISOString()} > ${registro.timestampLocal})`,
              })

              // Registrar en log como omitido
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
                  estado: 'OMITIDO',
                  createdAt: now,
                  updatedAt: now,
                },
              }).catch(() => {/* log no crítico */})

              continue
            }
          }

          // Aplicar cambio del cliente (es más reciente o no existe en servidor)
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
        }).catch(() => {/* log no crítico */})
      }
    }

    const exitosos = resultados.filter((r) => r.estado === 'OK').length
    const omitidos = resultados.filter((r) => r.estado === 'OMITIDO').length
    return { sincronizados: exitosos, omitidos, total: registros.length, resultados }
  })

  // GET /sync/pull — Cambios del servidor con paginación por tabla
  fastify.get<{
    Querystring: { desde?: string; tablas?: string; limite?: string }
  }>('/sync/pull', async (request) => {
    const { businessId } = request.user as JwtPayload
    const { desde, tablas } = request.query
    const limitePorTabla = Math.min(
      PULL_LIMIT_POR_TABLA,
      Math.max(1, parseInt(request.query.limite ?? String(PULL_LIMIT_POR_TABLA)))
    )

    const desdeDate = desde ? new Date(desde) : new Date(0)
    const tablasFilter = tablas ? tablas.split(',') : SYNC_ORDER

    const cambios: Record<string, unknown[]> = {}
    const totalesPorTabla: Record<string, number> = {}

    for (const tabla of tablasFilter) {
      const modelo = TABLE_TO_MODEL[tabla]
      if (!modelo) continue

      const prismaModel = (fastify.prisma as unknown as Record<string, unknown>)[modelo] as {
        findMany: (args: unknown) => Promise<unknown[]>
        count: (args: unknown) => Promise<number>
      }

      try {
        const whereClause: Record<string, unknown> = {
          updatedAt: { gt: desdeDate },
        }

        // Filtrar por businessId en tablas que lo tienen directamente
        if (['category', 'supplier', 'product', 'client', 'batch', 'consignment', 'containerType'].includes(modelo)) {
          whereClause['businessId'] = businessId
        }

        const [registros, total] = await Promise.all([
          prismaModel.findMany({
            where: whereClause,
            orderBy: { updatedAt: 'asc' },
            take: limitePorTabla,
          }),
          prismaModel.count({ where: whereClause }),
        ])

        cambios[tabla] = registros
        totalesPorTabla[tabla] = total
      } catch {
        cambios[tabla] = []
        totalesPorTabla[tabla] = 0
      }
    }

    // Indicar si hay más datos (el cliente debe hacer otro pull con cursor actualizado)
    const hayMas = Object.entries(totalesPorTabla).some(([tabla, total]) => {
      return total > (cambios[tabla]?.length ?? 0)
    })

    return {
      timestamp: new Date().toISOString(),
      cambios,
      totalesPorTabla,
      hayMas,
      limitePorTabla,
    }
  })

  // GET /sync/estado — Estado de sincronización del dispositivo
  fastify.get<{
    Querystring: { deviceId: string }
  }>('/sync/estado', async (request, reply) => {
    const { businessId } = request.user as JwtPayload
    const { deviceId } = request.query

    if (!deviceId) {
      return reply.code(400).send({ error: 'deviceId es requerido' })
    }

    const [pendientes, errores, omitidos, ultima] = await Promise.all([
      fastify.prisma.syncLog.count({
        where: { businessId, deviceId, estado: 'PENDIENTE' },
      }),
      fastify.prisma.syncLog.count({
        where: { businessId, deviceId, estado: 'ERROR' },
      }),
      fastify.prisma.syncLog.count({
        where: { businessId, deviceId, estado: 'OMITIDO' },
      }),
      fastify.prisma.syncLog.findFirst({
        where: { businessId, deviceId, estado: 'APLICADO' },
        orderBy: { timestampServidor: 'desc' },
      }),
    ])

    return {
      pendientes,
      errores,
      omitidos,
      ultimaSincronizacion: ultima?.timestampServidor ?? null,
    }
  })
}
