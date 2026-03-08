/**
 * Helper compartido para tests de rutas de la API.
 * Construye una instancia de Fastify con Prisma mockeado,
 * sin necesitar una base de datos real.
 */
import Fastify, { FastifyInstance } from 'fastify'
import jwtPlugin from '@fastify/jwt'
import { PrismaClient } from '@prisma/client'
import { vi } from 'vitest'

// ── Mock de Prisma ─────────────────────────────────────────────────────────────

export const prismaMock = {
  appUser: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  business: { create: vi.fn() },
  branch: { create: vi.fn() },
  category: {
    findFirst: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
  configuracion: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  product: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  batch: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  client: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  creditProfile: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  sale: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  saleItem: { create: vi.fn() },
  stockMovement: { create: vi.fn() },
  priceHistory: { create: vi.fn() },
  supplier: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  syncLog: { create: vi.fn() },
  $transaction: vi.fn(),
}

// $transaction delega en el mismo mock (simula transacción)
prismaMock.$transaction.mockImplementation(
  async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock)
)

// ── Factory de app de test ─────────────────────────────────────────────────────

export const TEST_SECRET = 'test-secret-mercadopro'

export const TEST_ADMIN = {
  userId: 'user-admin-1',
  businessId: 'biz-1',
  branchId: 'branch-1',
  rol: 'ADMIN',
}

export const TEST_VENDEDOR = {
  userId: 'user-vend-1',
  businessId: 'biz-1',
  branchId: 'branch-1',
  rol: 'VENDEDOR',
}

export async function buildTestApp(
  routePlugin: (f: FastifyInstance) => Promise<void>
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(jwtPlugin, {
    secret: TEST_SECRET,
    sign: { expiresIn: '1h' },
  })

  // Inyectar Prisma mock como decorator (cast necesario en tests)
  app.decorate('prisma', prismaMock as unknown as PrismaClient)

  await app.register(routePlugin)
  await app.ready()

  return app
}

export function adminToken(app: FastifyInstance): string {
  return app.jwt.sign(TEST_ADMIN)
}

export function vendedorToken(app: FastifyInstance): string {
  return app.jwt.sign(TEST_VENDEDOR)
}

export function resetMocks() {
  for (const model of Object.values(prismaMock)) {
    if (model && typeof model === 'object') {
      for (const fn of Object.values(model)) {
        if (fn && typeof fn === 'function' && 'mockReset' in fn) {
          (fn as ReturnType<typeof vi.fn>).mockReset()
        }
      }
    }
  }
  // Restaurar la implementación de $transaction después del reset
  prismaMock.$transaction.mockImplementation(
    async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock)
  )
}
