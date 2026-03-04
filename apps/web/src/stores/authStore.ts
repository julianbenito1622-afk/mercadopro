import { create } from 'zustand'

interface AuthState {
  token: string | null
  userId: string | null
  businessId: string | null
  branchId: string | null
  rol: string | null
  estaAutenticado: boolean
  setAuth: (token: string, userId: string, businessId: string, branchId: string, rol: string) => void
  cerrarSesion: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('mercadopro:token'),
  userId: localStorage.getItem('mercadopro:userId'),
  businessId: localStorage.getItem('mercadopro:businessId'),
  branchId: localStorage.getItem('mercadopro:branchId'),
  rol: localStorage.getItem('mercadopro:rol'),
  estaAutenticado: !!localStorage.getItem('mercadopro:token'),

  setAuth: (token, userId, businessId, branchId, rol) => {
    localStorage.setItem('mercadopro:token', token)
    localStorage.setItem('mercadopro:userId', userId)
    localStorage.setItem('mercadopro:businessId', businessId)
    localStorage.setItem('mercadopro:branchId', branchId)
    localStorage.setItem('mercadopro:rol', rol)
    set({ token, userId, businessId, branchId, rol, estaAutenticado: true })
  },

  cerrarSesion: () => {
    localStorage.removeItem('mercadopro:token')
    localStorage.removeItem('mercadopro:userId')
    localStorage.removeItem('mercadopro:businessId')
    localStorage.removeItem('mercadopro:branchId')
    localStorage.removeItem('mercadopro:rol')
    localStorage.removeItem('mercadopro:ultima_sync')
    set({ token: null, userId: null, businessId: null, branchId: null, rol: null, estaAutenticado: false })
  },
}))
