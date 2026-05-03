import type { ReactNode } from 'react'
import { cn } from '../../lib/format'

type Tone = 'neutral' | 'indigo' | 'emerald' | 'amber' | 'red' | 'cyan' | 'violet'

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-800/60 text-slate-300 border-slate-700/60',
  indigo:  'bg-indigo-500/15 text-indigo-200 border-indigo-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  amber:   'bg-amber-500/15 text-amber-200 border-amber-500/30',
  red:     'bg-red-500/15 text-red-200 border-red-500/30',
  cyan:    'bg-cyan-500/15 text-cyan-200 border-cyan-500/30',
  violet:  'bg-violet-500/15 text-violet-200 border-violet-500/30',
}

interface Props {
  children: ReactNode
  tone?: Tone
  className?: string
  dot?: boolean
}

export default function Badge({ children, tone = 'neutral', className, dot }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', tone === 'emerald' ? 'bg-emerald-400 animate-pulse-soft' : 'bg-current opacity-70')} />}
      {children}
    </span>
  )
}
