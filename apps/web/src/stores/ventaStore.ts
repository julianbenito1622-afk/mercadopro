import { create } from 'zustand'
import { type VentaItem, calcularTotalVenta } from '../core/ventas/ventaUtils'

// Alineado con MetodoPago de packages/shared/types/venta.types.ts
// 'CONTADO' era un alias interno — ahora usamos 'EFECTIVO' consistentemente
export type MetodoPago = 'EFECTIVO' | 'YAPE' | 'CREDITO'

interface VentaStore {
  clienteId: string | null
  clienteNombre: string
  items: VentaItem[]
  metodoPago: MetodoPago

  setCliente: (id: string | null, nombre: string) => void
  agregarItem: (item: VentaItem) => void
  eliminarItem: (index: number) => void
  setMetodoPago: (metodo: MetodoPago) => void
  calcularTotal: () => number
  limpiarVenta: () => void
}

export const useVentaStore = create<VentaStore>((set, get) => ({
  clienteId: null,
  clienteNombre: 'CONTADO',
  items: [],
  metodoPago: 'EFECTIVO',

  setCliente: (id, nombre) =>
    set({
      clienteId: id,
      clienteNombre: nombre,
      // Si vuelven a contado, quitar crédito como método de pago seleccionado
      metodoPago: id === null ? 'EFECTIVO' : get().metodoPago,
    }),

  agregarItem: (item) =>
    set((state) => ({ items: [...state.items, item] })),

  eliminarItem: (index) =>
    set((state) => ({ items: state.items.filter((_, i) => i !== index) })),

  setMetodoPago: (metodo) => set({ metodoPago: metodo }),

  calcularTotal: () => calcularTotalVenta(get().items),

  limpiarVenta: () =>
    set({
      clienteId: null,
      clienteNombre: 'CONTADO',
      items: [],
      metodoPago: 'EFECTIVO',
    }),
}))

// Re-export VentaItem para que otros módulos no necesiten importar de dos lugares
export type { VentaItem }
