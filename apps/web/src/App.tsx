import { Component, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { initDatabase } from './db/database'
import { iniciarSyncAutomatico } from './core/sync/syncEngine'
import { useAuthStore } from './stores/authStore'
import AppLayout from './ui/layouts/AppLayout'
import Onboarding from './ui/pages/Onboarding'
import LoginPin from './ui/pages/LoginPin'
import VentaRapida from './ui/pages/VentaRapida'
import Inventario from './ui/pages/Inventario'
import Clientes from './ui/pages/Clientes'
import Creditos from './ui/pages/Creditos'
import Productos from './ui/pages/Productos'
import ProductoForm from './ui/pages/ProductoForm'
import CierreDia from './ui/pages/CierreDia'
import Configuracion from './ui/pages/Configuracion'
import ClienteForm from './ui/pages/ClienteForm'
import Proveedores from './ui/pages/Proveedores'
import ProveedorForm from './ui/pages/ProveedorForm'

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { tieneError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { tieneError: false }
  }

  static getDerivedStateFromError() {
    return { tieneError: true }
  }

  render() {
    if (this.state.tieneError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-5 px-6">
          <span className="text-5xl">⚠️</span>
          <p className="text-slate-100 text-xl font-bold text-center">Algo salió mal</p>
          <p className="text-slate-500 text-sm text-center">
            Ocurrió un error inesperado en esta pantalla
          </p>
          <button
            onClick={() => window.location.reload()}
            className="h-12 px-8 bg-emerald-600 text-white font-bold rounded-xl text-base"
          >
            Recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Tipos de pantalla ─────────────────────────────────────────────────────────
type Pantalla = 'cargando' | 'onboarding' | 'login' | 'app'

export default function App() {
  const { estaAutenticado } = useAuthStore()
  const [pantalla, setPantalla] = useState<Pantalla>('cargando')
  const [errorDB, setErrorDB] = useState<string | null>(null)

  useEffect(() => {
    initDatabase()
      .then(() => {
        const onboardingDone = localStorage.getItem('mercadopro:onboarding') === 'done'
        if (!onboardingDone) {
          setPantalla('onboarding')
        } else if (estaAutenticado) {
          setPantalla('app')
        } else {
          setPantalla('login')
        }
      })
      .catch((e: unknown) => setErrorDB(e instanceof Error ? e.message : String(e)))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync automático una vez que la app está activa
  useEffect(() => {
    if (pantalla !== 'app') return
    const detenerSync = iniciarSyncAutomatico(60_000)
    return detenerSync
  }, [pantalla])

  if (errorDB) {
    return (
      <div className="min-h-screen bg-slate-950 text-red-400 flex items-center justify-center text-lg px-6 text-center">
        Error al iniciar DB: {errorDB}
      </div>
    )
  }

  if (pantalla === 'cargando') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <span className="text-5xl">⚡</span>
        <p className="text-emerald-400 font-bold text-xl">MercadoPro</p>
        <p className="text-slate-500 text-sm">Iniciando...</p>
      </div>
    )
  }

  if (pantalla === 'onboarding') {
    return (
      <ErrorBoundary>
        <Onboarding onTerminado={() => setPantalla('app')} />
      </ErrorBoundary>
    )
  }

  if (pantalla === 'login') {
    return (
      <ErrorBoundary>
        <LoginPin onLogin={() => setPantalla('app')} />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/venta" replace />} />
            <Route path="/venta" element={<VentaRapida />} />
            <Route path="/inventario" element={<Inventario />} />
            <Route path="/cobrar" element={<Creditos />} />
            <Route path="/cierre" element={<CierreDia />} />
            <Route path="/config" element={<Configuracion />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/nuevo" element={<ClienteForm />} />
            <Route path="/clientes/editar/:id" element={<ClienteForm />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/productos/nuevo" element={<ProductoForm />} />
            <Route path="/productos/editar/:id" element={<ProductoForm />} />
            <Route path="/proveedores" element={<Proveedores />} />
            <Route path="/proveedores/nuevo" element={<ProveedorForm />} />
            <Route path="/proveedores/editar/:id" element={<ProveedorForm />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
