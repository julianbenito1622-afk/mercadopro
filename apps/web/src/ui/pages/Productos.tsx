import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  obtenerProductos,
  obtenerCategorias,
  type ProductoRow,
  type CategoriaRow,
} from '../../db/queries/productos.queries'

const BADGE_COLORS: Record<string, string> = {
  'cat-tuberculos': 'bg-amber-900 text-amber-200',
  'cat-frutas':     'bg-orange-900 text-orange-200',
  'cat-verduras':   'bg-green-900 text-green-200',
  'cat-carnes':     'bg-red-900 text-red-200',
}
function badgeColor(categoryId: string) {
  return BADGE_COLORS[categoryId] ?? 'bg-slate-800 text-slate-300'
}

function formatPrecio(precio: number) {
  return `S/ ${precio.toFixed(2)}`
}

export default function Productos() {
  const navigate = useNavigate()
  const [productos, setProductos] = useState<ProductoRow[]>([])
  const [categorias, setCategorias] = useState<CategoriaRow[]>([])
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      const prods = await obtenerProductos('local')
      const cats = await obtenerCategorias()
      setProductos(prods)
      setCategorias(cats)
    }
    cargar().finally(() => setCargando(false))
  }, [])

  const productosFiltrados = productos.filter(p => {
    const coincideCategoria = categoriaFiltro === 'todos' || p.category_id === categoriaFiltro
    const coincideBusqueda =
      busqueda === '' ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.nombre_corto.toLowerCase().includes(busqueda.toLowerCase())
    return coincideCategoria && coincideBusqueda
  })

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Buscador */}
      <div className="px-4 pt-4 pb-2">
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full h-12 px-4 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 text-base focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Chips de categorías */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setCategoriaFiltro('todos')}
          className={`shrink-0 px-4 h-9 rounded-full text-sm font-medium ${
            categoriaFiltro === 'todos'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          Todos
        </button>
        {categorias.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategoriaFiltro(cat.id)}
            className={`shrink-0 px-4 h-9 rounded-full text-sm font-medium ${
              categoriaFiltro === cat.id
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {cat.nombre}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {cargando ? (
          <p className="text-center text-slate-500 pt-16">Cargando...</p>
        ) : productosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 gap-4">
            <p className="text-slate-500 text-lg">No hay productos registrados</p>
            <button
              onClick={() => navigate('/productos/nuevo')}
              className="px-6 h-12 bg-emerald-600 text-white rounded-lg font-semibold"
            >
              Crear primer producto
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {productosFiltrados.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/productos/editar/${p.id}`)}
                className="w-full text-left bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between min-h-[72px]"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-slate-100 text-lg font-semibold leading-tight">
                    {p.nombre}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor(p.category_id)}`}
                    >
                      {p.categoria_nombre}
                    </span>
                    <span className="text-slate-500 text-xs">{p.unidad_venta_principal}</span>
                  </div>
                </div>
                <span className="text-2xl font-bold text-emerald-400 shrink-0 ml-4">
                  {formatPrecio(p.precio_venta_actual)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Botón flotante + Nuevo */}
      <button
        onClick={() => navigate('/productos/nuevo')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-emerald-500 text-white rounded-full text-2xl font-bold shadow-lg flex items-center justify-center"
        aria-label="Nuevo producto"
      >
        +
      </button>
    </div>
  )
}
