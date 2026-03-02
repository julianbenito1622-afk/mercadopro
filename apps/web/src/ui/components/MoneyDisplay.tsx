interface Props {
  monto: number
  className?: string
}

/** Muestra un monto con formato peruano: S/ 1,234.56 */
export default function MoneyDisplay({ monto, className = '' }: Props) {
  const [entero, centavos] = monto.toFixed(2).split('.')
  const enteroFormateado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (
    <span className={className}>
      S/ {enteroFormateado}.{centavos}
    </span>
  )
}
