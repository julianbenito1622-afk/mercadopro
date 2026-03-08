import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { FastifyInstance } from 'fastify'
import { ventasRoutes } from '../routes/ventas.js'
import { buildTestApp, adminToken, prismaMock, resetMocks } from './testApp.js'

let app: FastifyInstance
let token: string

const ITEM_BASE = {
  productId: 'prod-1',
  cantidad: 10,
  unidadVenta: 'KG',
  pesoNetoKg: 10,
  precioUnitario: 5,
  subtotal: 50,
}

const CLIENTE_AL_DIA = {
  id: 'client-1',
  activo: true,
  creditProfile: {
    estado: 'AL_DIA',
    limiteCredito: 500,
    saldoActual: 0,
  },
}

beforeEach(async () => {
  resetMocks()
  app = await buildTestApp(ventasRoutes)
  token = adminToken(app)

  // Default: producto existe
  prismaMock.product.findFirst.mockResolvedValue({ id: 'prod-1', activo: true })
  // Default: correlativo
  prismaMock.configuracion.findFirst.mockResolvedValue({ id: 'cfg-1', valor: '0' })
  prismaMock.configuracion.update.mockResolvedValue({})
  prismaMock.sale.create.mockResolvedValue({ id: 'sale-1', numeroTicket: 'T-000001' })
  prismaMock.saleItem.create.mockResolvedValue({})
})

afterAll(async () => {
  await app.close()
})

// ── Validación de crédito ──────────────────────────────────────────────────────

describe('POST /ventas — validación de crédito', () => {
  it('rechaza venta a crédito sin clientId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        items: [ITEM_BASE],
        metodoPago: 'CREDITO',
        total: 50,
        montoPagado: 0,
      },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('clientId')
  })

  it('rechaza cuando saldo + venta supera el límite de crédito', async () => {
    prismaMock.client.findFirst.mockResolvedValueOnce({
      ...CLIENTE_AL_DIA,
      creditProfile: { estado: 'AL_DIA', limiteCredito: 100, saldoActual: 80 },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        clientId: 'client-1',
        items: [ITEM_BASE],
        metodoPago: 'CREDITO',
        total: 50,      // saldo 80 + 50 > límite 100
        montoPagado: 0,
      },
    })
    expect(res.statusCode).toBe(422)
    const body = res.json()
    expect(body.error).toContain('límite de crédito')
    expect(body.detalle).toBeDefined()
    expect(body.detalle.disponible).toBe(20)   // 100 - 80 = 20
  })

  it('rechaza cuando el cliente tiene crédito bloqueado', async () => {
    prismaMock.client.findFirst.mockResolvedValueOnce({
      ...CLIENTE_AL_DIA,
      creditProfile: { estado: 'BLOQUEADO', limiteCredito: 500, saldoActual: 200 },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        clientId: 'client-1',
        items: [ITEM_BASE],
        metodoPago: 'CREDITO',
        total: 50,
        montoPagado: 0,
      },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error).toContain('bloqueado')
  })

  it('permite venta a crédito dentro del límite', async () => {
    prismaMock.client.findFirst.mockResolvedValueOnce(CLIENTE_AL_DIA)
    prismaMock.creditProfile.updateMany.mockResolvedValue({})

    const res = await app.inject({
      method: 'POST',
      url: '/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        clientId: 'client-1',
        items: [ITEM_BASE],
        metodoPago: 'CREDITO',
        total: 50,       // saldo 0 + 50 <= límite 500
        montoPagado: 0,
      },
    })
    expect(res.statusCode).toBe(201)
  })

  it('permite venta en efectivo sin clientId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        items: [ITEM_BASE],
        metodoPago: 'EFECTIVO',
        total: 50,
        montoPagado: 50,
      },
    })
    expect(res.statusCode).toBe(201)
  })

  it('rechaza si montoPagado < total en venta en efectivo', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        items: [ITEM_BASE],
        metodoPago: 'EFECTIVO',
        total: 100,
        montoPagado: 50,  // insuficiente
      },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('Monto pagado insuficiente')
  })
})

// ── Validación de FKs ─────────────────────────────────────────────────────────

describe('POST /ventas — validación de FKs', () => {
  it('rechaza si el clientId no existe', async () => {
    prismaMock.client.findFirst.mockResolvedValueOnce(null)

    const res = await app.inject({
      method: 'POST',
      url: '/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        clientId: 'cliente-inexistente',
        items: [ITEM_BASE],
        metodoPago: 'EFECTIVO',
        total: 50,
        montoPagado: 50,
      },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error).toContain('Cliente no encontrado')
  })

  it('rechaza si el productId no existe', async () => {
    prismaMock.client.findFirst.mockResolvedValueOnce(CLIENTE_AL_DIA)
    prismaMock.product.findFirst.mockResolvedValueOnce(null)

    const res = await app.inject({
      method: 'POST',
      url: '/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        clientId: 'client-1',
        items: [{ ...ITEM_BASE, productId: 'prod-inexistente' }],
        metodoPago: 'EFECTIVO',
        total: 50,
        montoPagado: 50,
      },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error).toContain('Producto no encontrado')
  })

  it('rechaza si stock del lote es insuficiente', async () => {
    prismaMock.client.findFirst.mockResolvedValueOnce(CLIENTE_AL_DIA)
    prismaMock.product.findFirst.mockResolvedValueOnce({ id: 'prod-1', activo: true })
    prismaMock.batch.findFirst.mockResolvedValueOnce({ id: 'lote-1', cantidadActualKg: 5 })

    const res = await app.inject({
      method: 'POST',
      url: '/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        clientId: 'client-1',
        items: [{ ...ITEM_BASE, batchId: 'lote-1', pesoNetoKg: 10 }],  // 10kg > 5kg disponibles
        metodoPago: 'EFECTIVO',
        total: 50,
        montoPagado: 50,
      },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error).toContain('Stock insuficiente')
    expect(res.json().detalle.stockDisponible).toBe(5)
  })
})

// ── Validación de schema ───────────────────────────────────────────────────────

describe('POST /ventas — validación de schema', () => {
  it('rechaza body sin items', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        metodoPago: 'EFECTIVO',
        total: 50,
        montoPagado: 50,
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rechaza items vacío', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        items: [],
        metodoPago: 'EFECTIVO',
        total: 50,
        montoPagado: 50,
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rechaza metodoPago inválido', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        items: [ITEM_BASE],
        metodoPago: 'BITCOIN',
        total: 50,
        montoPagado: 50,
      },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── Autenticación ─────────────────────────────────────────────────────────────

describe('GET /ventas — autenticación', () => {
  it('rechaza petición sin token', async () => {
    prismaMock.sale.findMany.mockResolvedValue([])
    prismaMock.sale.count.mockResolvedValue(0)
    const res = await app.inject({ method: 'GET', url: '/ventas' })
    expect(res.statusCode).toBe(401)
  })
})
