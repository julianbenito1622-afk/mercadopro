import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import compress from '@fastify/compress'
import prismaPlugin from './plugins/prisma.js'
import { authRoutes } from './routes/auth.js'
import { syncRoutes } from './routes/sync.js'
import { productosRoutes } from './routes/productos.js'
import { clientesRoutes } from './routes/clientes.js'
import { ventasRoutes } from './routes/ventas.js'
import { inventarioRoutes } from './routes/inventario.js'

type JwtPayload = { userId?: string; businessId?: string }

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
})

async function main() {
  // ── Plugins ────────────────────────────────────────────────────────────────
  await fastify.register(compress, {
    global: true,
    encodings: ['br', 'gzip', 'deflate'],
    threshold: 1024,
  })

  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'mercadopro-dev-secret-change-in-production',
    sign: { expiresIn: '30d' },
  })

  await fastify.register(prismaPlugin)

  // ── Manejador de errores global (logging centralizado) ────────────────────
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode ?? 500
    const esErrorInterno = statusCode >= 500

    // Loguear con contexto completo para errores de servidor
    if (esErrorInterno) {
      fastify.log.error({
        err: {
          message: error.message,
          stack: error.stack,
          code: error.code,
        },
        request: {
          method: request.method,
          url: request.url,
          params: request.params,
        },
        usuario: {
          userId: (request.user as JwtPayload | undefined)?.userId,
          businessId: (request.user as JwtPayload | undefined)?.businessId,
        },
        statusCode,
      }, 'Error interno del servidor')
    } else {
      // Errores de cliente (4xx): log de nivel warn con menos detalle
      fastify.log.warn({
        method: request.method,
        url: request.url,
        statusCode,
        error: error.message,
      }, 'Error de cliente')
    }

    // Respuesta al cliente: no exponer detalles internos en producción
    reply.code(statusCode).send({
      error: esErrorInterno && process.env.NODE_ENV === 'production'
        ? 'Error interno del servidor'
        : error.message,
      statusCode,
    })
  })

  // ── Rutas ──────────────────────────────────────────────────────────────────
  await fastify.register(authRoutes)
  await fastify.register(syncRoutes)
  await fastify.register(productosRoutes)
  await fastify.register(clientesRoutes)
  await fastify.register(ventasRoutes)
  await fastify.register(inventarioRoutes)

  // Health check
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    environment: process.env.NODE_ENV ?? 'development',
  }))

  const port = parseInt(process.env.PORT ?? '3001')
  const host = process.env.HOST ?? '0.0.0.0'

  await fastify.listen({ port, host })
  fastify.log.info(`MercadoPro API corriendo en http://${host}:${port}`)
}

main().catch((err) => {
  fastify.log.error(err, 'Error fatal al iniciar el servidor')
  process.exit(1)
})
