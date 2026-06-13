interface ProgressBarProps {
  value: number   // 0-100
  className?: string
  color?: string
}

export function ProgressBar({ value, className = '', color = 'var(--green-mid)' }: ProgressBarProps) {
  return (
    <div className={`h-[7px] bg-[var(--bg3)] rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  )
}
