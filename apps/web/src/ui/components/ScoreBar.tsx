interface Props {
  score: number
  /** 'sm' = h-1.5 (listas), 'md' = h-2 (detalle). Default: 'sm' */
  size?: 'sm' | 'md'
}

function colorScore(score: number): string {
  if (score > 70) return 'bg-emerald-500'
  if (score >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

export default function ScoreBar({ score, size = 'sm' }: Props) {
  const altura = size === 'md' ? 'h-2' : 'h-1.5'
  return (
    <div className={`${altura} rounded-full bg-slate-700`}>
      <div
        className={`h-full rounded-full transition-all ${colorScore(score)}`}
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  )
}
