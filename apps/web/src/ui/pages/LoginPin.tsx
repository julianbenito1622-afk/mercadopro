import { useEffect, useState } from 'react'
import { verificarPin } from '../../db/queries/usuarios.queries'
import { obtenerBusiness } from '../../db/queries/configuracion.queries'
import { useAuthStore } from '../../stores/authStore'

interface Props {
  onLogin: () => void
}

export default function LoginPin({ onLogin }: Props) {
  const { iniciarSesionLocal } = useAuthStore()

  const [nombreNegocio, setNombreNegocio] = useState('')
  const [mercado, setMercado] = useState('')
  const [pin, setPin] = useState<string[]>(['', '', '', ''])
  const [error, setError] = useState(false)
  const [verificando, setVerificando] = useState(false)

  useEffect(() => {
    obtenerBusiness('local').then(b => {
      if (b) {
        setNombreNegocio(b.nombre)
        setMercado(b.mercado ?? '')
      }
    })
  }, [])

  async function presionarTecla(tecla: string) {
    if (verificando) return
    setError(false)

    if (tecla === '⌫') {
      setPin(prev => {
        const next = [...prev]
        const idx = [...next].reverse().findIndex(d => d !== '')
        if (idx === -1) return next
        next[next.length - 1 - idx] = ''
        return next
      })
      return
    }

    const posLibre = pin.findIndex(d => d === '')
    if (posLibre === -1) return

    const nuevoPin = [...pin]
    nuevoPin[posLibre] = tecla

    setPin(nuevoPin)

    // Auto-verificar cuando se completen los 4 dígitos
    if (posLibre === 3) {
      const pinStr = nuevoPin.join('')
      setVerificando(true)
      try {
        const usuario = await verificarPin('local', pinStr)
        if (usuario) {
          iniciarSesionLocal(usuario.id, usuario.nombre, usuario.rol)
          onLogin()
        } else {
          setError(true)
          setTimeout(() => {
            setPin(['', '', '', ''])
            setError(false)
          }, 700)
        }
      } finally {
        setVerificando(false)
      }
    }
  }

  const digitos = pin.filter(d => d !== '').length

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-between px-6 pt-16 pb-8">

      {/* Header */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-4xl">⚡</span>
        <p className="text-emerald-400 text-xl font-bold">MercadoPro</p>
        {nombreNegocio && (
          <div className="mt-2 text-center">
            <p className="text-slate-100 text-2xl font-bold">{nombreNegocio}</p>
            {mercado && <p className="text-slate-500 text-sm mt-0.5">{mercado}</p>}
          </div>
        )}
      </div>

      {/* PIN display */}
      <div className="flex flex-col items-center gap-5">
        <p className="text-slate-400 text-base font-medium">Ingresa tu PIN</p>
        <div className={`flex gap-4 transition-all ${error ? 'animate-bounce' : ''}`}>
          {pin.map((_d, i) => (
            <div
              key={i}
              className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-colors ${
                i < digitos
                  ? error
                    ? 'bg-red-600 border-red-500'
                    : 'bg-emerald-600 border-emerald-500'
                  : 'border-slate-700 bg-slate-900'
              }`}
            >
              {i < digitos && (
                <div className="w-3 h-3 rounded-full bg-white" />
              )}
            </div>
          ))}
        </div>
        {error && (
          <p className="text-red-400 text-sm font-medium">PIN incorrecto</p>
        )}
      </div>

      {/* Teclado */}
      <div className="w-full max-w-xs grid grid-cols-3 gap-3">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((t, i) => (
          t === '' ? <div key={i} /> : (
            <button
              key={i}
              onClick={() => presionarTecla(t)}
              disabled={verificando}
              className={`h-[72px] rounded-2xl text-2xl font-bold transition-colors active:scale-95 ${
                t === '⌫'
                  ? 'bg-slate-800 border border-slate-700 text-slate-400'
                  : 'bg-slate-800 border border-slate-700 text-slate-100 active:bg-slate-700'
              }`}
            >
              {t}
            </button>
          )
        ))}
      </div>
    </div>
  )
}
