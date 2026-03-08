import { create } from 'zustand'

const SESSION_DURACION_MS = 8 * 60 * 60 * 1000 // 8 horas

function sesionLocalValida(): boolean {
  const ts = localStorage.getItem('mercadopro:session_ts')
  const uid = localStorage.getItem('mercadopro:local_user_id')
  if (!ts || !uid) return false
  return Date.now() - parseInt(ts) < SESSION_DURACION_MS
}

interface AuthState {
  // Cloud auth
  token: string | null
  // Sesión activa
  userId: string | null
  userNombre: string | null
  businessId: string
  branchId: string
  rol: string | null
  estaAutenticado: boolean

  iniciarSesionLocal: (userId: string, nombre: string, rol: string) => void
  setAuth: (token: string, userId: string, businessId: string, branchId: string, rol: string) => void
  cerrarSesion: () => void
}

export const useAuthStore = create<AuthState>(() => {
  // Restaurar sesión local si sigue vigente
  const sesionOk = sesionLocalValida()
  const userId = sesionOk ? localStorage.getItem('mercadopro:local_user_id') : null
  const userNombre = sesionOk ? localStorage.getItem('mercadopro:local_user_nombre') : null
  const rol = sesionOk ? localStorage.getItem('mercadopro:local_rol') : null
  const token = localStorage.getItem('mercadopro:token')

  return {
    token,
    userId,
    userNombre,
    businessId: 'local',
    branchId: 'local-branch',
    rol,
    estaAutenticado: sesionOk || !!token,

    iniciarSesionLocal: (userId, nombre, rol) => {
      localStorage.setItem('mercadopro:local_user_id', userId)
      localStorage.setItem('mercadopro:local_user_nombre', nombre)
      localStorage.setItem('mercadopro:local_rol', rol)
      localStorage.setItem('mercadopro:session_ts', Date.now().toString())
      useAuthStore.setState({ userId, userNombre: nombre, rol, estaAutenticado: true })
    },

    setAuth: (token, userId, businessId, branchId, rol) => {
      localStorage.setItem('mercadopro:token', token)
      localStorage.setItem('mercadopro:userId', userId)
      localStorage.setItem('mercadopro:businessId', businessId)
      localStorage.setItem('mercadopro:branchId', branchId)
      localStorage.setItem('mercadopro:rol', rol)
      useAuthStore.setState({ token, userId, businessId, branchId, rol, estaAutenticado: true })
    },

    cerrarSesion: () => {
      localStorage.removeItem('mercadopro:token')
      localStorage.removeItem('mercadopro:local_user_id')
      localStorage.removeItem('mercadopro:local_user_nombre')
      localStorage.removeItem('mercadopro:local_rol')
      localStorage.removeItem('mercadopro:session_ts')
      localStorage.removeItem('mercadopro:ultima_sync')
      useAuthStore.setState({
        token: null, userId: null, userNombre: null,
        rol: null, estaAutenticado: false,
      })
    },
  }
})
