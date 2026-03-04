import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  obtenerProductoPorId,
  obtenerCategorias,
  obtenerHistorialPrecios,
  crearProducto,
  actualizarProducto,
  actualizarPrecio,
  desactivarProducto,
  type CategoriaRow,
  type HistorialPrecioRow,
} from '../../db/queries/productos.queries'

const UNIDADES = ['KG', 'SACO', 'JABA', 'CAJA', 'UNIDAD'] as const
type Unidad = typeof UNIDADES[number]

function formatPrecio(precio: number) {
  return `S/ ${precio.toFixed(2)}`
}

export default function ProductoForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const esEdicion = Boolean(id)

  const [categorias, setCategorias] = useState<CategoriaRow[]>([])
  const [historial, setHistorial] = useState<HistorialPrecioRow[]>([])
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [precioNuevo, setPrecioNuevo] = useState('')
  const [mostrarActualizarPrecio, setMostrarActualizarPrecio] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [errores, setErrores] = useState<{ nombre?: string; nombreCorto?: string; precio?: string }>({})

  function validar(): boolean {
    const nuevosErrores: typeof errores = {}
    if (!nombre.trim()) {
      nuevosErrores.nombre = 'El nombre es obligatorio'
    }
    if (!nombreCorto.trim()) {
      nuevosErrores.nombreCorto = 'El nombre corto es obligatorio'
    } else if (nombreCorto.trim().length > 8) {
      nuevosErrores.nombreCorto = 'Máximo 8 caracteres'
    }
    const precioNum = parseFloat(precio)
    if (!precio || isNaN(precioNum) || precioNum <= 0) {
      nuevosErrores.precio = 'El precio debe ser mayor a 0'
    }
    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  // Campos del formulario
  const [nombre, setNombre] = useState('')
  const [nombreCorto, setNombreCorto] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [unidad, setUnidad] = useState<Unidad>('KG')
  const [precio, setPrecio] = useState('')
  const [requierePesaje, setRequierePesaje] = useState(true)
  const [vidaUtilDias, setVidaUtilDias] = useState('7')
  const [esPantallaRapida, setEsPantallaRapida] = useState(false)
  const [ordenPantalla, setOrdenPantalla] = useState('0')

  useEffect(() => {
    const cargar = async () => {
      const cats = await obtenerCategorias()
      setCategorias(cats)
      if (cats.length > 0) setCategoryId(cats[0].id)

      if (esEdicion && id) {
        const prod = await obtenerProductoPorId(id)
        if (prod) {
          setNombre(prod.nombre)
          setNombreCorto(prod.nombre_corto)
          setCategoryId(prod.category_id)
          setUnidad(prod.unidad_venta_principal as Unidad)
          setPrecio(prod.precio_venta_actual.toString())
          setRequierePesaje(prod.requiere_pesaje === 1)
          setVidaUtilDias(prod.vida_util_dias.toString())
          setEsPantallaRapida(prod.es_pantalla_rapida === 1)
          setOrdenPantalla(prod.orden_pantalla.toString())
        }
        const hist = await obtenerHistorialPrecios(id)
        setHistorial(hist)
      }
      setCargando(false)
    }
    cargar()
  }, [id, esEdicion])

  const handleGuardar = async () => {
    if (!validar()) return
    setGuardando(true)
    try {
      if (esEdicion && id) {
        await actualizarProducto(id, {
          category_id: categoryId,
          nombre: nombre.trim(),
          nombre_corto: nombreCorto.trim(),
          unidad_venta_principal: unidad,
          precio_venta_actual: parseFloat(precio),
          requiere_pesaje: requierePesaje ? 1 : 0,
          vida_util_dias: parseInt(vidaUtilDias) || 7,
          es_pantalla_rapida: esPantallaRapida ? 1 : 0,
          orden_pantalla: parseInt(ordenPantalla) || 0,
        })
      } else {
        await crearProducto({
          business_id: 'local',
          category_id: categoryId,
          nombre: nombre.trim(),
          nombre_corto: nombreCorto.trim(),
          unidad_venta_principal: unidad,
          precio_venta_actual: parseFloat(precio),
          requiere_pesaje: requierePesaje ? 1 : 0,
          vida_util_dias: parseInt(vidaUtilDias) || 7,
          es_pantalla_rapida: esPantallaRapida ? 1 : 0,
          orden_pantalla: parseInt(ordenPantalla) || 0,
        })
      }
      navigate('/productos')
    } finally {
      setGuardando(false)
    }
  }

  const handleDesactivar = async () => {
    if (!id) return
    setGuardando(true)
    try {
      await desactivarProducto(id)
      navigate('/productos')
    } finally {
      setGuardando(false)
    }
  }

  const handleActualizarPrecio = async () => {
    if (!id || !precioNuevo) return
    setGuardando(true)
    try {
      await actualizarPrecio(id, parseFloat(precioNuevo), 'local-user')
      setPrecio(precioNuevo)
      setPrecioNuevo('')
      setMostrarActualizarPrecio(false)
      const hist = await obtenerHistorialPrecios(id)
      setHistorial(hist)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-950 text-slate-400 text-lg">
        Cargando...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
        <button
          onClick={() => navigate('/productos')}
          className="w-10 h-10 flex items-center justify-center text-slate-400 text-xl"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">
          {esEdicion ? 'Editar Producto' : 'Nuevo Producto'}
        </h1>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-5">
        {/* Nombre */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-sm">Nombre *</label>
          <input
            type="text"
            value={nombre}
            onChange={e => { setNombre(e.target.value); setErrores(prev => ({ ...prev, nombre: undefined })) }}
            placeholder="Ej: Papa Blanca Huayro"
            className={`h-12 px-4 bg-slate-800 border rounded-lg text-slate-100 placeholder-slate-500 text-base focus:outline-none ${errores.nombre ? 'border-red-500' : 'border-slate-600 focus:border-emerald-500'}`}
          />
          {errores.nombre && <p className="text-red-400 text-xs">{errores.nombre}</p>}
        </div>

        {/* Nombre corto */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-sm">
            Nombre corto *{' '}
            <span className={nombreCorto.length >= 8 ? 'text-amber-400' : 'text-slate-500'}>
              ({nombreCorto.length}/8)
            </span>
          </label>
          <input
            type="text"
            value={nombreCorto}
            onChange={e => { setNombreCorto(e.target.value.slice(0, 8)); setErrores(prev => ({ ...prev, nombreCorto: undefined })) }}
            placeholder="Ej: P.BLANCA"
            maxLength={8}
            className={`h-12 px-4 bg-slate-800 border rounded-lg text-slate-100 placeholder-slate-500 text-base focus:outline-none ${errores.nombreCorto ? 'border-red-500' : 'border-slate-600 focus:border-emerald-500'}`}
          />
          {errores.nombreCorto && <p className="text-red-400 text-xs">{errores.nombreCorto}</p>}
        </div>

        {/* Categoría */}
        <div className="flex flex-col gap-2">
          <label className="text-slate-400 text-sm">Categoría</label>
          <div className="flex flex-wrap gap-2">
            {categorias.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoryId(cat.id)}
                className={`px-4 h-10 rounded-lg text-sm font-medium ${
                  categoryId === cat.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {cat.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Unidad */}
        <div className="flex flex-col gap-2">
          <label className="text-slate-400 text-sm">Unidad de venta principal</label>
          <div className="flex flex-wrap gap-2">
            {UNIDADES.map(u => (
              <button
                key={u}
                onClick={() => setUnidad(u)}
                className={`px-4 h-10 rounded-lg text-sm font-medium ${
                  unidad === u
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* Precio */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-sm">Precio de venta *</label>
          <div className={`flex items-center h-14 bg-slate-800 border rounded-lg overflow-hidden ${errores.precio ? 'border-red-500' : 'border-slate-600 focus-within:border-emerald-500'}`}>
            <span className="px-4 text-slate-400 text-base font-semibold">S/</span>
            <input
              type="number"
              value={precio}
              onChange={e => { setPrecio(e.target.value); setErrores(prev => ({ ...prev, precio: undefined })) }}
              placeholder="0.00"
              step="0.10"
              min="0"
              className="flex-1 h-full bg-transparent text-slate-100 text-xl font-bold placeholder-slate-600 focus:outline-none pr-4"
            />
          </div>
          {errores.precio && <p className="text-red-400 text-xs">{errores.precio}</p>}
        </div>

        {/* Requiere pesaje */}
        <div className="flex items-center justify-between h-12">
          <span className="text-slate-300">Requiere pesaje</span>
          <button
            onClick={() => setRequierePesaje(v => !v)}
            className={`w-14 h-8 rounded-full transition-colors flex items-center ${
              requierePesaje ? 'bg-emerald-600 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <span className="w-6 h-6 bg-white rounded-full mx-1 shadow" />
          </button>
        </div>

        {/* Vida útil */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-sm">Días de vida útil</label>
          <input
            type="number"
            value={vidaUtilDias}
            onChange={e => setVidaUtilDias(e.target.value)}
            min="1"
            className="h-12 px-4 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 text-base focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Pantalla rápida */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between h-12">
            <span className="text-slate-300">Mostrar en pantalla rápida</span>
            <button
              onClick={() => setEsPantallaRapida(v => !v)}
              className={`w-14 h-8 rounded-full transition-colors flex items-center ${
                esPantallaRapida ? 'bg-emerald-600 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <span className="w-6 h-6 bg-white rounded-full mx-1 shadow" />
            </button>
          </div>
          {esPantallaRapida && (
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 text-sm">Orden en pantalla</label>
              <input
                type="number"
                value={ordenPantalla}
                onChange={e => setOrdenPantalla(e.target.value)}
                min="0"
                className="h-12 px-4 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 text-base focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}
        </div>

        {/* Guardar */}
        <button
          onClick={handleGuardar}
          disabled={guardando}
          className="w-full h-16 bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-lg font-bold rounded-xl mt-2"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>

        {/* Sección edición: actualizar precio + historial */}
        {esEdicion && (
          <div className="flex flex-col gap-4 border-t border-slate-800 pt-4">
            <button
              onClick={() => setMostrarActualizarPrecio(v => !v)}
              className="w-full h-12 bg-slate-800 border border-slate-600 text-slate-300 font-semibold rounded-xl"
            >
              Actualizar Precio
            </button>

            {mostrarActualizarPrecio && (
              <div className="flex gap-3">
                <div className="flex items-center flex-1 h-12 bg-slate-800 border border-slate-600 rounded-lg overflow-hidden focus-within:border-emerald-500">
                  <span className="px-3 text-slate-400 font-semibold">S/</span>
                  <input
                    type="number"
                    value={precioNuevo}
                    onChange={e => setPrecioNuevo(e.target.value)}
                    placeholder={precio}
                    step="0.10"
                    min="0"
                    className="flex-1 h-full bg-transparent text-slate-100 text-lg font-bold focus:outline-none pr-3"
                  />
                </div>
                <button
                  onClick={handleActualizarPrecio}
                  disabled={guardando || !precioNuevo}
                  className="h-12 px-5 bg-emerald-600 disabled:bg-slate-700 text-white font-bold rounded-lg"
                >
                  OK
                </button>
              </div>
            )}

            {historial.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-slate-500 text-xs uppercase tracking-wider">
                  Últimos precios
                </p>
                {historial.map(h => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between py-2 border-b border-slate-800 text-sm"
                  >
                    <span className="text-slate-500">
                      {new Date(h.fecha).toLocaleDateString('es-PE')}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 line-through">
                        {formatPrecio(h.precio_anterior)}
                      </span>
                      <span className="text-emerald-400 font-semibold">
                        {formatPrecio(h.precio_nuevo)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Zona de peligro */}
            <div className="border-t border-red-900 pt-4 flex flex-col gap-2">
              {!confirmarEliminar ? (
                <button
                  onClick={() => setConfirmarEliminar(true)}
                  className="w-full h-12 border border-red-800 text-red-400 font-semibold rounded-xl text-sm"
                >
                  Desactivar producto
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-red-400 text-sm text-center">
                    ¿Confirmas desactivar este producto?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmarEliminar(false)}
                      className="flex-1 h-12 bg-slate-800 text-slate-300 font-semibold rounded-xl text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleDesactivar}
                      disabled={guardando}
                      className="flex-1 h-12 bg-red-700 text-white font-bold rounded-xl text-sm"
                    >
                      Sí, desactivar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
