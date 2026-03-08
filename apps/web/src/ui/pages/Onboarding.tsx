import { useState } from 'react'
import { actualizarBusiness, limpiarDatosDemo } from '../../db/queries/configuracion.queries'
import { crearUsuarioAdmin } from '../../db/queries/usuarios.queries'
import { useAuthStore } from '../../stores/authStore'

const MERCADOS = [
  'GMML Santa Anita',
  'La Parada (La Victoria)',
  'Unicachi (Comas)',
  'Unicachi (Pro)',
  'Mercado Productores SJL',
  'Mercado Moshoqueque (Chiclayo)',
  'Mercado Mayorista Trujillo',
  'Otro',
]

const PIN_VACIO = ['', '', '', '']

interface Props {
  onTerminado: () => void
}

type Paso = 1 | 2 | 3

export default function Onboarding({ onTerminado }: Props) {
  const { iniciarSesionLocal } = useAuthStore()

  const [paso, setPaso] = useState<Paso>(1)

  // Paso 1
  const [nombreNegocio, setNombreNegocio] = useState('')
  const [mercado, setMercado] = useState('')

  // Paso 2
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [pin, setPin] = useState<string[]>([...PIN_VACIO])
  const [pinConfirm, setPinConfirm] = useState<string[]>([...PIN_VACIO])
  const [pinActivo, setPinActivo] = useState<'pin' | 'confirm'>('pin')
  const [errorPin, setErrorPin] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function presionarTeclaPin(tecla: string) {
    const current = pinActivo === 'pin' ? pin : pinConfirm
    const setter = pinActivo === 'pin' ? setPin : setPinConfirm
    setErrorPin(null)

    if (tecla === '⌫') {
      const idx = [...current].reverse().findIndex(d => d !== '')
      if (idx === -1) return
      const pos = current.length - 1 - idx
      const next = [...current]
      next[pos] = ''
      setter(next)
      return
    }

    const pos = current.findIndex(d => d === '')
    if (pos === -1) return
    const next = [...current]
    next[pos] = tecla

    setter(next)

    // Auto-avanzar al confirm cuando se completa el PIN
    if (pinActivo === 'pin' && pos === 3) {
      setTimeout(() => setPinActivo('confirm'), 200)
    }
  }

  async function finalizar() {
    const pinStr = pin.join('')
    const pinConfirmStr = pinConfirm.join('')

    if (pinStr.length < 4) { setErrorPin('Ingresa un PIN de 4 dígitos'); return }
    if (pinStr !== pinConfirmStr) {
      setErrorPin('Los PINs no coinciden')
      setPinConfirm([...PIN_VACIO])
      setPinActivo('confirm')
      return
    }

    setGuardando(true)
    try {
      await limpiarDatosDemo()
      await actualizarBusiness('local', { nombre: nombreNegocio.trim(), mercado: mercado || null })
      const userId = await crearUsuarioAdmin({ businessId: 'local', nombre: nombreUsuario.trim(), pin: pinStr })
      localStorage.setItem('mercadopro:onboarding', 'done')
      iniciarSesionLocal(userId, nombreUsuario.trim(), 'ADMIN')
      setPaso(3)
    } catch (e) {
      setErrorPin(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const pinLleno = pin.every(d => d !== '')
  const confirmLleno = pinConfirm.every(d => d !== '')

  // ── Render ────────────────────────────────────────────────────────────────

  if (paso === 3) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 px-6">
        <div className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center text-4xl">
          ✓
        </div>
        <div className="text-center">
          <p className="text-slate-100 text-2xl font-bold">{nombreNegocio}</p>
          <p className="text-slate-500 text-base mt-1">{mercado}</p>
        </div>
        <p className="text-slate-400 text-center text-base">
          Hola, <span className="text-slate-100 font-semibold">{nombreUsuario}</span>.<br />
          Tu cuenta está lista.
        </p>
        <button
          onClick={onTerminado}
          className="w-full max-w-xs h-14 bg-emerald-600 text-white text-lg font-bold rounded-2xl"
        >
          Empezar →
        </button>
      </div>
    )
  }

  if (paso === 2) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col px-6 pt-10 pb-6">
        {/* Header */}
        <button onClick={() => setPaso(1)} className="text-slate-500 text-2xl mb-6 self-start">←</button>
        <p className="text-slate-500 text-sm mb-1">Paso 2 de 2</p>
        <h1 className="text-slate-100 text-2xl font-bold mb-6">Tu usuario</h1>

        {/* Nombre */}
        <label className="text-slate-500 text-sm font-medium mb-1">Tu nombre</label>
        <input
          type="text"
          placeholder="Ej: Juan Pérez"
          value={nombreUsuario}
          onChange={e => setNombreUsuario(e.target.value)}
          className="h-14 bg-slate-900 border border-slate-700 rounded-xl px-4 text-slate-100 text-lg mb-6 focus:outline-none focus:border-emerald-500"
          autoComplete="off"
        />

        {/* PIN */}
        <div className="flex gap-6 mb-4">
          <div
            onClick={() => setPinActivo('pin')}
            className={`flex-1 flex flex-col gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
              pinActivo === 'pin' ? 'border-emerald-500 bg-slate-900' : 'border-slate-800 bg-slate-900'
            }`}
          >
            <span className="text-slate-500 text-xs font-medium">PIN</span>
            <div className="flex gap-2 justify-center">
              {pin.map((d, i) => (
                <div
                  key={i}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${
                    d ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                  }`}
                />
              ))}
            </div>
          </div>

          <div
            onClick={() => pinLleno && setPinActivo('confirm')}
            className={`flex-1 flex flex-col gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
              pinActivo === 'confirm' ? 'border-emerald-500 bg-slate-900' : 'border-slate-800 bg-slate-900'
            }`}
          >
            <span className="text-slate-500 text-xs font-medium">Confirmar PIN</span>
            <div className="flex gap-2 justify-center">
              {pinConfirm.map((d, i) => (
                <div
                  key={i}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${
                    d ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {errorPin && (
          <p className="text-red-400 text-sm text-center mb-2">{errorPin}</p>
        )}

        {/* Teclado numérico */}
        <div className="grid grid-cols-3 gap-3 mt-auto mb-4">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((t, i) => (
            t === '' ? <div key={i} /> : (
              <button
                key={i}
                onClick={() => presionarTeclaPin(t)}
                className="h-16 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-2xl font-bold active:bg-slate-700"
              >
                {t}
              </button>
            )
          ))}
        </div>

        <button
          onClick={finalizar}
          disabled={!nombreUsuario.trim() || !pinLleno || !confirmLleno || guardando}
          className="w-full h-14 bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-white text-lg font-bold rounded-2xl"
        >
          {guardando ? 'Guardando...' : 'Crear cuenta'}
        </button>
      </div>
    )
  }

  // Paso 1
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col px-6 pt-14 pb-6">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <span className="text-4xl">⚡</span>
        <span className="text-emerald-400 text-2xl font-bold">MercadoPro</span>
      </div>

      <p className="text-slate-500 text-sm mb-1">Paso 1 de 2</p>
      <h1 className="text-slate-100 text-2xl font-bold mb-1">Configura tu puesto</h1>
      <p className="text-slate-500 text-sm mb-8">Solo lo harás una vez</p>

      {/* Nombre del negocio */}
      <label className="text-slate-500 text-sm font-medium mb-1">Nombre de tu puesto o negocio</label>
      <input
        type="text"
        placeholder="Ej: Pollería Don José, Verduras San Isidro"
        value={nombreNegocio}
        onChange={e => setNombreNegocio(e.target.value)}
        className="h-14 bg-slate-900 border border-slate-700 rounded-xl px-4 text-slate-100 text-base mb-6 focus:outline-none focus:border-emerald-500"
        autoComplete="off"
      />

      {/* Mercado */}
      <label className="text-slate-500 text-sm font-medium mb-1">¿En qué mercado estás?</label>
      <select
        value={mercado}
        onChange={e => setMercado(e.target.value)}
        className="h-14 bg-slate-900 border border-slate-700 rounded-xl px-4 text-slate-100 text-base mb-8 focus:outline-none focus:border-emerald-500 appearance-none"
      >
        <option value="">Selecciona tu mercado</option>
        {MERCADOS.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <button
        onClick={() => setPaso(2)}
        disabled={!nombreNegocio.trim() || !mercado}
        className="mt-auto w-full h-14 bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-white text-lg font-bold rounded-2xl"
      >
        Siguiente →
      </button>
    </div>
  )
}
