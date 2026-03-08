import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { FastifyInstance } from 'fastify'
import { inventarioRoutes } from '../routes/inventario.js'
import { buildTestApp, adminToken, vendedorToken, prismaMock, resetMocks } from './testApp.js'

let app: FastifyInstance
let tokenAdmin: string
let tokenVendedor: string

const LOTE_BASE = {
  id: 'lote-1',
  cantidadActualKg: 100,
  businessId: 'biz-1',
}

beforeEach(async () => {
  resetMocks()
  app = await buildTestApp(inventarioRoutes)
  tokenAdmin = adminToken(app)
  tokenVendedor = vendedorToken(app)
})

afterAll(async () => {
  await app.close()
})

// ── Ajuste de stock ───────────────────────────────────────────────────────────

describe('PATCH /lotes/:id/ajuste — validación de stock', () => {
  it('rechaza ajuste que resultaría en stock negativo', async () => {
    prismaMock.batch.findFirst.mockResolvedValueOnce(LOTE_BASE)

    const res = await app.inject({
      method: 'PATCH',
      url: '/lotes/lote-1/ajuste',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      payload: { cantidadKg: -150, motivo: 'Error de conteo' },  // 100 - 150 = -50
    })
    expect(res.statusCode).toBe(422)
    const body = res.json()
    expect(body.error).toContain('stock negativo')
    expect(body.detalle.stockActual).toBe(100)
    expect(body.detalle.resultadoSiAplicara).toBe(-50)
  })

  it('permite ajuste negativo válido (sin llegar a negativo)', async () => {
    prismaMock.batch.findFirst.mockResolvedValueOnce(LOTE_BASE)
    prismaMock.batch.update.mockResolvedValue({})
    prismaMock.stockMovement.create.mockResolvedValue({})

    const res = await app.inject({
      method: 'PATCH',
      url: '/lotes/lote-1/ajuste',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      payload: { cantidadKg: -50, motivo: 'Merma por humedad' },  // 100 - 50 = 50 ✓
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().cantidadActualKg).toBe(50)
  })

  it('permite ajuste positivo (reposición)', async () => {
    prismaMock.batch.findFirst.mockResolvedValueOnce(LOTE_BASE)
    prismaMock.batch.update.mockResolvedValue({})
    prismaMock.stockMovement.create.mockResolvedValue({})

    const res = await app.inject({
      method: 'PATCH',
      url: '/lotes/lote-1/ajuste',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      payload: { cantidadKg: 25, motivo: 'Reposición desde almacén' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().cantidadActualKg).toBe(125)
  })

  it('retorna 404 si el lote no existe', async () => {
    prismaMock.batch.findFirst.mockResolvedValueOnce(null)

    const res = await app.inject({
      method: 'PATCH',
      url: '/lotes/inexistente/ajuste',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      payload: { cantidadKg: -10, motivo: 'Test' },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── RBAC: solo ADMIN puede ajustar stock ─────────────────────────────────────

describe('PATCH /lotes/:id/ajuste — RBAC', () => {
  it('rechaza ajuste por usuario con rol VENDEDOR', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/lotes/lote-1/ajuste',
      headers: { Authorization: `Bearer ${tokenVendedor}` },
      payload: { cantidadKg: -10, motivo: 'Test' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toContain('administrador')
  })
})

// ── Validación de schema en ajuste ───────────────────────────────────────────

describe('PATCH /lotes/:id/ajuste — schema', () => {
  it('rechaza body sin motivo', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/lotes/lote-1/ajuste',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      payload: { cantidadKg: -10 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rechaza motivo muy corto (< 3 chars)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/lotes/lote-1/ajuste',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      payload: { cantidadKg: -10, motivo: 'ab' },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── POST /lotes: validación de FKs ────────────────────────────────────────────

describe('POST /lotes — validación de FKs y RBAC', () => {
  it('rechaza si el productId no existe', async () => {
    prismaMock.product.findFirst.mockResolvedValueOnce(null)

    const res = await app.inject({
      method: 'POST',
      url: '/lotes',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      payload: {
        productId: 'prod-inexistente',
        cantidadInicialKg: 50,
        costoUnitario: 2.5,
        fechaVencimientoEstimada: '2027-01-01',
      },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error).toContain('Producto no encontrado')
  })

  it('rechaza fecha de vencimiento en el pasado', async () => {
    prismaMock.product.findFirst.mockResolvedValueOnce({ id: 'prod-1', activo: true })

    const res = await app.inject({
      method: 'POST',
      url: '/lotes',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      payload: {
        productId: 'prod-1',
        cantidadInicialKg: 50,
        costoUnitario: 2.5,
        fechaVencimientoEstimada: '2020-01-01',  // pasado
      },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('fecha de vencimiento')
  })

  it('rechaza creación de lote por VENDEDOR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/lotes',
      headers: { Authorization: `Bearer ${tokenVendedor}` },
      payload: {
        productId: 'prod-1',
        cantidadInicialKg: 50,
        costoUnitario: 2.5,
        fechaVencimientoEstimada: '2027-01-01',
      },
    })
    expect(res.statusCode).toBe(403)
  })
})
