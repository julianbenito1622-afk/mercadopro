import { Component, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { initDatabase } from './db/database'
import { iniciarSyncAutomatico } from './core/sync/syncEngine'
import AppLayout from './ui/layouts/AppLayout'
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

export default function App() {
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initDatabase()
      .then(() => { setError(null); setListo(true) })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  // Iniciar motor de sync automático si hay API configurada
  useEffect(() => {
    if (!listo) return
    const detenerSync = iniciarSyncAutomatico(60_000)
    return detenerSync
  }, [listo])

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-red-400 flex items-center justify-center text-lg">
        Error al iniciar DB: {error}
      </div>
    )
  }

  if (!listo) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-lg">
        Iniciando...
      </div>
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
