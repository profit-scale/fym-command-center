import { useNavigate } from 'react-router-dom'
import { ArrowRight, Building2 } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import { useWorkspace } from '../lib/workspace'
import { formatNumber, formatDuration, timeAgo } from '../lib/format'

export default function Workspaces() {
  const { workspaces, current, setCurrent } = useWorkspace()
  const nav = useNavigate()

  function open(slug: string) {
    setCurrent(slug)
    nav('/')
  }

  const total = Object.values(workspaces).length
  const running = Object.values(workspaces).filter((w) => w.agent_status === 'running').length
  const totalContacts = Object.values(workspaces).reduce((s, w) => s + Number(w.contacts_total ?? 0), 0)
  const out24 = Object.values(workspaces).reduce((s, w) => s + Number(w.outbound_24h ?? 0), 0)

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Workspaces</h1>
        <p className="text-sm text-slate-500 mt-1">All workspaces this engine is running.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Workspaces" value={formatNumber(total)} icon={Building2} accent="from-indigo-500/40 to-violet-500/40" />
        <StatCard label="Running"    value={formatNumber(running)} accent="from-emerald-500/40 to-teal-500/40" />
        <StatCard label="Contacts"   value={formatNumber(totalContacts)} accent="from-cyan-500/40 to-sky-500/40" />
        <StatCard label="Sent · 24h" value={formatNumber(out24)} accent="from-amber-500/40 to-orange-500/40" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(workspaces).map(([slug, w]) => {
          const isCurrent = slug === current
          const tone = w.agent_status === 'running' ? 'emerald' : w.agent_status === 'paused' ? 'amber' : 'neutral'
          return (
            <Card key={slug} hover>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-base font-semibold text-slate-100 tracking-tight">{w.name ?? slug}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">{slug}</div>
                </div>
                <Badge tone={tone as 'emerald' | 'amber' | 'neutral'} dot>{w.agent_status ?? 'unknown'}</Badge>
              </div>
              <dl className="grid grid-cols-3 gap-3 text-xs mb-3">
                <Cell label="Contacts" value={formatNumber(w.contacts_total)} />
                <Cell label="Sent · 24h" value={formatNumber(w.outbound_24h)} />
                <Cell label="Replies · 24h" value={formatNumber(w.inbound_24h)} />
              </dl>
              <dl className="grid grid-cols-2 gap-3 text-xs mb-4 pt-3 border-t border-slate-800/60">
                <Cell label="Contact rate" value={`${(Number(w.contact_rate ?? 0)).toFixed(1)}%`} />
                <Cell label="Speed to lead" value={formatDuration(w.speed_to_lead_median_seconds ?? w.speed_to_lead_seconds)} />
              </dl>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Last sent {timeAgo(w.last_outbound)}</span>
                <button
                  onClick={() => open(slug)}
                  className="inline-flex items-center gap-1.5 text-indigo-300 hover:text-indigo-200 transition"
                >
                  {isCurrent ? 'Open' : 'Switch & open'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium">{label}</dt>
      <dd className="text-base font-semibold text-slate-100 tabular-nums tracking-tight mt-0.5">{value}</dd>
    </div>
  )
}
