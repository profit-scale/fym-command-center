import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Circle } from 'lucide-react'
import { useWorkspace } from '../../lib/workspace'
import { cn } from '../../lib/format'

export default function WorkspaceSwitcher() {
  const { workspaces, current, setCurrent, loading } = useWorkspace()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const ws = workspaces[current]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 h-9 pl-3 pr-2 rounded-lg border border-slate-800/80 bg-slate-900/60 hover:bg-slate-900/80 transition text-sm"
      >
        <div className="flex flex-col items-start text-left min-w-0 leading-tight">
          <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500">Workspace</span>
          <span className="text-slate-100 font-medium truncate max-w-[180px]">
            {loading && !ws ? '…' : ws?.name ?? current ?? 'No workspace'}
          </span>
        </div>
        <span className={cn('w-1.5 h-1.5 rounded-full', ws?.agent_status === 'running' ? 'bg-emerald-400 animate-pulse-soft' : 'bg-slate-600')} />
        <ChevronsUpDown className="w-3.5 h-3.5 text-slate-500" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-800/80 bg-slate-950/95 backdrop-blur shadow-2xl shadow-black/60 z-30 overflow-hidden">
          <div className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-slate-600 border-b border-slate-800/60">
            Switch workspace
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {Object.entries(workspaces).map(([slug, w]) => {
              const active = slug === current
              return (
                <button
                  key={slug}
                  onClick={() => { setCurrent(slug); setOpen(false) }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-slate-800/40 transition',
                    active && 'bg-indigo-500/10',
                  )}
                >
                  <Circle className={cn(
                    'w-2 h-2 fill-current',
                    w.agent_status === 'running' ? 'text-emerald-400' : 'text-slate-600',
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-100 truncate">{w.name ?? slug}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {w.contacts_total ?? 0} contacts · {w.outbound_24h ?? 0} sent today · {w.agent_status ?? 'unknown'}
                    </div>
                  </div>
                  {active && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
