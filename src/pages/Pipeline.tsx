import { useEffect, useMemo, useState } from 'react'
import { Columns3 } from 'lucide-react'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { api } from '../lib/api'
import { useWorkspace } from '../lib/workspace'
import { formatPhone, timeAgo } from '../lib/format'
import type { Contact } from '../lib/types'
import { useNavigate } from 'react-router-dom'

const STAGE_ORDER = ['new', 'engaged', 'qualified', 'booked', 'sold', 'lost'] as const

const STAGE_COLOR: Record<string, string> = {
  new: 'from-slate-500/40 to-slate-600/40',
  engaged: 'from-cyan-500/40 to-sky-500/40',
  qualified: 'from-indigo-500/40 to-violet-500/40',
  booked: 'from-violet-500/40 to-fuchsia-500/40',
  sold: 'from-emerald-500/40 to-teal-500/40',
  lost: 'from-red-500/40 to-rose-500/40',
}

export default function Pipeline() {
  const { current: workspace, syncStamp } = useWorkspace()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    try {
      type R = { contacts: Contact[] }
      const res = await api<R>(`/api/admin/contacts/${encodeURIComponent(workspace)}`, { query: { limit: 500 } })
      setContacts(res.contacts ?? [])
    } catch {
      setContacts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (syncStamp > 0) load()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [workspace, syncStamp])

  const grouped = useMemo(() => {
    const m = new Map<string, Contact[]>()
    for (const stage of STAGE_ORDER) m.set(stage, [])
    for (const c of contacts) {
      const s = c.lead_stage ?? 'new'
      if (!m.has(s)) m.set(s, [])
      m.get(s)!.push(c)
    }
    return m
  }, [contacts])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Pipeline</h1>
        <p className="text-sm text-slate-500 mt-1">Funnel by stage — click a card to open the conversation.</p>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {Array.from(grouped.entries()).map(([stage, list]) => (
            <div key={stage} className="w-72 shrink-0">
              <Card flush className="overflow-hidden">
                <div className={`relative h-1 bg-gradient-to-r ${STAGE_COLOR[stage] ?? STAGE_COLOR.new}`} />
                <div className="px-4 pt-3 pb-2 border-b border-slate-800/60 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium">{stage}</div>
                    <div className="text-lg font-bold text-slate-100 tabular-nums">{list.length}</div>
                  </div>
                  <Columns3 className="w-4 h-4 text-slate-600" />
                </div>
                <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
                  {loading && Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} height={60} className="block w-full" />
                  ))}
                  {!loading && list.length === 0 && (
                    <EmptyState icon={Columns3} title="Empty" description="No leads in this stage yet." />
                  )}
                  {list.slice(0, 50).map((c) => {
                    const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || formatPhone(c.phone) || 'Unknown'
                    return (
                      <button
                        key={c.id}
                        onClick={() => navigate(`/conversations/${c.id}`)}
                        className="w-full text-left rounded-xl border border-slate-800/60 bg-slate-950/50 hover:bg-slate-900/60 hover:border-slate-700/80 transition p-3 group"
                      >
                        <div className="flex items-start gap-2.5">
                          <Avatar firstName={c.first_name} lastName={c.last_name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-slate-100 font-medium truncate">{name}</div>
                            <div className="text-[11px] text-slate-500 truncate">{formatPhone(c.phone)}</div>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              {c.lead_score != null && <Badge tone="indigo" className="!text-[10px]">score {c.lead_score}</Badge>}
                              {c.last_inbound_at && <span className="text-[10px] text-slate-600">{timeAgo(c.last_inbound_at)}</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
