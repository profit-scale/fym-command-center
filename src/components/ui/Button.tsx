import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/format'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-900/40 hover:from-indigo-400 hover:to-violet-500 active:from-indigo-600 active:to-violet-700 border border-indigo-400/40',
  secondary:
    'bg-slate-800/60 text-slate-100 hover:bg-slate-700/60 border border-slate-700/60',
  ghost:
    'text-slate-300 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent',
  danger:
    'bg-red-500/15 text-red-200 hover:bg-red-500/25 border border-red-500/30',
}

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-9 px-4 text-sm rounded-lg gap-2',
  lg: 'h-11 px-5 text-sm rounded-xl gap-2',
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  iconLeft,
  iconRight,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-r-transparent animate-spin" />
      ) : (
        iconLeft
      )}
      {children}
      {iconRight}
    </button>
  )
}
