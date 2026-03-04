import { create } from 'zustand'
import { obtenerResumenDia } from '../db/queries/ventas.queries'

interface DiaStore {
  totalHoy: number
  recargarTotal: () => Promise<void>
}

export const useDiaStore = create<DiaStore>((set) => ({
  totalHoy: 0,
  recargarTotal: async () => {
    const resumen = await obtenerResumenDia('local')
    set({ totalHoy: resumen.total_dia })
  },
}))
