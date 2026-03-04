import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import prismaPlugin from './plugins/prisma.js'
import { authRoutes } from './routes/auth.js'
import { syncRoutes } from './routes/sync.js'
import { productosRoutes } from './routes/productos.js'
import { clientesRoutes } from './routes/clientes.js'
import { ventasRoutes } from './routes/ventas.js'
import { inventarioRoutes } from './routes/inventario.js'

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
})

async function main() {
  // Plugins
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'mercadopro-dev-secret-change-in-production',
    sign: { expiresIn: '30d' },
  })

  await fastify.register(prismaPlugin)

  // Rutas
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
  }))

  const port = parseInt(process.env.PORT ?? '3001')
  const host = process.env.HOST ?? '0.0.0.0'

  await fastify.listen({ port, host })
  console.log(`MercadoPro API corriendo en http://${host}:${port}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
