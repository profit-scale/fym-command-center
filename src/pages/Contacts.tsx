import { useEffect, useMemo, useState } from 'react'
import { Search, Users, Pause, Phone, Mail } from 'lucide-react'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Badge from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { api } from '../lib/api'
import { useWorkspace } from '../lib/workspace'
import { formatPhone, parseTags, timeAgo, cn } from '../lib/format'
import type { Contact } from '../lib/types'
import { useNavigate } from 'react-router-dom'

export default function Contacts() {
  const { current: workspace, syncStamp } = useWorkspace()
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState<string>('all')
  const [items, setItems] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    try {
      // Defensive workspace switch — backend is single-active so we re-assert
      try {
        await api('/api/workspaces/switch', { method: 'POST', body: { slug: workspace } })
      } catch { /* non-fatal */ }
      type R = { contacts: Contact[] }
      const res = await api<R>('/api/contacts', {
        query: {
          limit: 500,
          search: query || undefined,
          stage: stage !== 'all' ? stage : undefined,
        },
      })
      setItems(res.contacts ?? [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (syncStamp > 0) load()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [workspace, stage, syncStamp])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [query])

  const stages = useMemo(() => {
    const set = new Set<string>()
    items.forEach((c) => c.lead_stage && set.add(c.lead_stage))
    return ['all', ...Array.from(set).sort()]
  }, [items])

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Contacts</h1>
        <p className="text-sm text-slate-500 mt-1">All leads in this workspace.</p>
      </div>

      {/* Filters */}
      <Card flush className="!p-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 max-w-md">
            <Input
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="Search name, phone, or email…"
              iconLeft={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {stages.map((s) => (
              <button
                key={s}
                onClick={() => setStage(s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition border',
                  stage === s
                    ? 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border-transparent',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card flush>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-slate-500 border-b border-slate-800/60">
                <th className="px-5 py-3 font-medium">Lead</th>
                <th className="px-5 py-3 font-medium">Phone / Email</th>
                <th className="px-5 py-3 font-medium">Stage</th>
                <th className="px-5 py-3 font-medium">Tags</th>
                <th className="px-5 py-3 font-medium">Last reply</th>
                <th className="px-5 py-3 font-medium text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-900/60">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-5 py-3"><Skeleton height={14} width={j === 0 ? 200 : 120} /></td>
                  ))}
                </tr>
              ))}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon={Users} title="No contacts found" description="Try changing the filter or search." />
                  </td>
                </tr>
              )}

              {items.map((c) => {
                const tags = parseTags(c.tags).slice(0, 3)
                const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || formatPhone(c.phone) || 'Unknown'
                return (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/conversations/${c.id}`)}
                    className="border-b border-slate-900/60 hover:bg-slate-900/40 transition cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar firstName={c.first_name} lastName={c.last_name} size="sm" />
                        <div className="min-w-0">
                          <div className="text-slate-100 font-medium truncate">{name}</div>
                          {c.is_paused ? <span className="text-[10px] text-amber-400 inline-flex items-center gap-1"><Pause className="w-3 h-3" />paused</span> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-400">
                      {c.phone && <div className="inline-flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-600" /> {formatPhone(c.phone)}</div>}
                      {c.email && <div className="inline-flex items-center gap-1.5 text-xs"><Mail className="w-3 h-3 text-slate-600" /> {c.email}</div>}
                    </td>
                    <td className="px-5 py-3">{c.lead_stage ? <Badge tone="indigo">{c.lead_stage}</Badge> : <span className="text-slate-600">—</span>}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {tags.length === 0 ? <span className="text-slate-600">—</span> : tags.map((t, i) => <Badge key={i} tone="neutral" className="!text-[10px]">{t}</Badge>)}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{timeAgo(c.last_inbound_at)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-200">{c.lead_score ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
