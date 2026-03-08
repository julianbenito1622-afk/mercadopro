import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import ScoreBar from '../ScoreBar'

// El componente renderiza:
// <div class="h-1.5 rounded-full bg-slate-700">   ← wrapper
//   <div class="h-full rounded-full ... bg-color" style="width:X%" />  ← barra interior
// </div>

// RTL monta en: [container(div)] > [wrapper ScoreBar(div)] > [barra interna(div)]
function getBarraInterna(container: HTMLElement): HTMLElement {
  return container.querySelector('div > div > div') as HTMLElement
}

function getWrapper(container: HTMLElement): HTMLElement {
  // El wrapper de ScoreBar es el primer div hijo del container de RTL
  return container.querySelector('div > div') as HTMLElement
}

describe('ScoreBar', () => {
  it('muestra barra verde para score alto (> 70)', () => {
    const { container } = render(<ScoreBar score={85} />)
    expect(getBarraInterna(container).className).toContain('bg-emerald-500')
  })

  it('muestra barra amarilla para score medio (40-70)', () => {
    const { container } = render(<ScoreBar score={55} />)
    expect(getBarraInterna(container).className).toContain('bg-amber-500')
  })

  it('muestra barra roja para score bajo (< 40)', () => {
    const { container } = render(<ScoreBar score={20} />)
    expect(getBarraInterna(container).className).toContain('bg-red-500')
  })

  it('limita el ancho al 100% para score > 100', () => {
    const { container } = render(<ScoreBar score={150} />)
    expect(getBarraInterna(container).getAttribute('style')).toContain('width: 100%')
  })

  it('muestra 0% para score negativo', () => {
    const { container } = render(<ScoreBar score={-10} />)
    expect(getBarraInterna(container).getAttribute('style')).toContain('width: 0%')
  })

  it('usa altura h-1.5 por defecto (size sm)', () => {
    const { container } = render(<ScoreBar score={50} />)
    expect(getWrapper(container).className).toContain('h-1.5')
  })

  it('usa altura h-2 con size md', () => {
    const { container } = render(<ScoreBar score={50} size="md" />)
    expect(getWrapper(container).className).toContain('h-2')
  })
})
