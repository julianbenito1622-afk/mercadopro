import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { FastifyInstance } from 'fastify'
import { authRoutes } from '../routes/auth.js'
import { buildTestApp, prismaMock, resetMocks } from './testApp.js'

let app: FastifyInstance

beforeEach(async () => {
  resetMocks()
  app = await buildTestApp(authRoutes)
})

afterAll(async () => {
  await app.close()
})

// ── POST /auth/registro ────────────────────────────────────────────────────────

describe('POST /auth/registro', () => {
  it('crea negocio y retorna token con 201', async () => {
    // $transaction ya está mockeado para llamar al callback
    prismaMock.business.create.mockResolvedValue({})
    prismaMock.branch.create.mockResolvedValue({})
    prismaMock.appUser.create.mockResolvedValue({})
    prismaMock.category.create.mockResolvedValue({})
    prismaMock.configuracion.create.mockResolvedValue({})

    const res = await app.inject({
      method: 'POST',
      url: '/auth/registro',
      payload: {
        negocio: { nombre: 'Verduras Pepe', mercado: 'La Parada' },
        usuario: { nombre: 'Pedro Pérez', celular: '987654321', pin: '1234' },
      },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.token).toBeDefined()
    expect(body.businessId).toBeDefined()
    expect(body.userId).toBeDefined()
  })

  it('rechaza celular con formato inválido', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/registro',
      payload: {
        negocio: { nombre: 'Test' },
        usuario: { nombre: 'Test', celular: '123', pin: '1234' },
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rechaza PIN menor a 4 dígitos', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/registro',
      payload: {
        negocio: { nombre: 'Test' },
        usuario: { nombre: 'Test', celular: '987654321', pin: '12' },
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rechaza nombre de negocio menor a 2 caracteres', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/registro',
      payload: {
        negocio: { nombre: 'A' },
        usuario: { nombre: 'Test', celular: '987654321', pin: '1234' },
      },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── POST /auth/login ───────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  it('retorna token si credenciales son correctas', async () => {
    prismaMock.appUser.findFirst.mockResolvedValueOnce({
      id: 'user-1',
      businessId: 'biz-1',
      branchId: 'branch-1',
      rol: 'ADMIN',
      activo: true,
    })

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { celular: '987654321', pin: '1234' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.token).toBeDefined()
    expect(body.rol).toBe('ADMIN')
  })

  it('retorna 401 si las credenciales son inválidas', async () => {
    prismaMock.appUser.findFirst.mockResolvedValueOnce(null)

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { celular: '987654321', pin: '9999' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toContain('Credenciales inválidas')
  })
})
