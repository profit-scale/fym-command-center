import { cn } from '../../lib/format'
import { initials as initialsOf } from '../../lib/format'

interface Props {
  firstName?: string | null
  lastName?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-11 h-11 text-sm',
}

// Hash a stable index off the name so the same person always gets the same gradient.
const PALETTE = [
  'from-indigo-500 to-violet-500',
  'from-violet-500 to-fuchsia-500',
  'from-cyan-500 to-blue-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
]

function paletteFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

export default function Avatar({ firstName, lastName, size = 'md', className }: Props) {
  const init = initialsOf(firstName, lastName)
  const seed = (firstName ?? '') + (lastName ?? '') + init
  const palette = paletteFor(seed || 'fym')
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold text-white ring-1 ring-white/5 shadow-inner shadow-black/30',
        `bg-gradient-to-br ${palette}`,
        SIZE[size],
        className,
      )}
    >
      {init}
    </span>
  )
}
