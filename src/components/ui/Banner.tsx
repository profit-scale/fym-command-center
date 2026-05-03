import { AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/format'

type Tone = 'info' | 'warning' | 'success' | 'danger'

const TONES: Record<Tone, { box: string; text: string; title: string; icon: typeof Info; iconColor: string }> = {
  info:    { box: 'border-sky-500/30 bg-sky-500/10',     text: 'text-sky-200',    title: 'text-sky-100',    icon: Info,           iconColor: 'text-sky-400' },
  warning: { box: 'border-amber-500/30 bg-amber-500/10', text: 'text-amber-200',  title: 'text-amber-100',  icon: AlertTriangle,  iconColor: 'text-amber-400' },
  success: { box: 'border-emerald-500/30 bg-emerald-500/10', text: 'text-emerald-200', title: 'text-emerald-100', icon: CheckCircle2, iconColor: 'text-emerald-400' },
  danger:  { box: 'border-red-500/30 bg-red-500/10',     text: 'text-red-200',    title: 'text-red-100',    icon: XCircle,        iconColor: 'text-red-400' },
}

interface Props {
  tone?: Tone
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}

export default function Banner({ tone = 'info', title, children, action, className }: Props) {
  const cfg = TONES[tone]
  const Icon = cfg.icon
  return (
    <div className={cn('rounded-xl border px-4 py-3 flex items-start gap-3', cfg.box, className)}>
      <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', cfg.iconColor)} />
      <div className={cn('text-xs leading-relaxed flex-1', cfg.text)}>
        {title && <strong className={cn('block mb-0.5', cfg.title)}>{title}</strong>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
