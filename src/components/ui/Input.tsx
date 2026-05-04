import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/format'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  iconLeft?: ReactNode
  hint?: string
  invalid?: boolean
}

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { iconLeft, hint, invalid, className, ...rest },
  ref,
) {
  return (
    <div className="w-full">
      <div className="relative">
        {iconLeft && (
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 pointer-events-none">
            {iconLeft}
          </span>
        )}
        <input
          ref={ref}
          {...rest}
          className={cn(
            'w-full h-9 rounded-lg border bg-slate-950/50 text-sm text-slate-100 placeholder:text-slate-500',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400/50 transition',
            iconLeft ? 'pl-9 pr-3' : 'px-3',
            invalid ? 'border-red-500/50' : 'border-slate-800/80 hover:border-slate-700/80',
            className,
          )}
        />
      </div>
      {hint && <div className={cn('mt-1 text-[11px]', invalid ? 'text-red-400' : 'text-slate-500')}>{hint}</div>}
    </div>
  )
})

export default Input

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hint?: string
  invalid?: boolean
}

// Forwarded ref so callers (e.g. AICommander) can focus() the textarea
// programmatically after a send. Plain destructure was the previous shape;
// keeping the API the same except for the new ref support.
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { hint, invalid, className, ...rest },
  ref,
) {
  return (
    <div className="w-full">
      <textarea
        ref={ref}
        {...rest}
        className={cn(
          'w-full rounded-lg border bg-slate-950/50 text-sm text-slate-100 placeholder:text-slate-500 px-3 py-2.5',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400/50 transition resize-y',
          invalid ? 'border-red-500/50' : 'border-slate-800/80 hover:border-slate-700/80',
          className,
        )}
      />
      {hint && <div className={cn('mt-1 text-[11px]', invalid ? 'text-red-400' : 'text-slate-500')}>{hint}</div>}
    </div>
  )
})
