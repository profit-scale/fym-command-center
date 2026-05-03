import type { ReactNode } from 'react'
import { cn } from '../../lib/format'

interface Props {
  children: ReactNode
  className?: string
  /** When true, no internal padding — useful when the children manage their own layout. */
  flush?: boolean
  /** Hover-lift treatment. */
  hover?: boolean
}

export default function Card({ children, className, flush, hover }: Props) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-800/60 bg-slate-900/40 backdrop-blur',
        hover && 'hover:border-slate-700/80 hover:bg-slate-900/60 transition',
        !flush && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, description, action, className }: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-100 tracking-tight">{title}</h3>
        {description && (
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
