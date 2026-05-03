import { Activity, RefreshCw } from 'lucide-react'
import { useWorkspace } from '../../lib/workspace'
import WorkspaceSwitcher from './WorkspaceSwitcher'

export default function Topbar() {
  const { refresh, loading, workspaces, current } = useWorkspace()
  const ws = workspaces[current]
  const status = ws?.agent_status
  const knownStatus = status === 'running' || status === 'paused'

  return (
    <header className="h-14 border-b border-slate-800/60 bg-slate-950/40 backdrop-blur px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <Activity className="w-3.5 h-3.5 text-indigo-400" />
        <span>Command Center · live</span>
        {knownStatus && (
          <span className="hidden md:inline-flex items-center gap-1.5 ml-3 px-2 py-0.5 rounded-full border border-slate-800 text-[10px] uppercase tracking-[0.2em]">
            <span className={
              'w-1.5 h-1.5 rounded-full ' +
              (status === 'running' ? 'bg-emerald-400 animate-pulse-soft' : 'bg-amber-400')
            } />
            {status}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => refresh()}
          title="Refresh status"
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition"
        >
          <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
        </button>
        <WorkspaceSwitcher />
      </div>
    </header>
  )
}
