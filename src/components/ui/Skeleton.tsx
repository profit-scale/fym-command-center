import { cn } from '../../lib/format'

interface Props {
  className?: string
  width?: number | string
  height?: number | string
  rounded?: string
}

export default function Skeleton({ className, width, height = '0.875rem', rounded = 'rounded-md' }: Props) {
  return (
    <span
      aria-hidden
      className={cn('inline-block bg-slate-800/60 animate-pulse', rounded, className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  )
}
