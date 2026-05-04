import { useEffect, useMemo, useState } from 'react'
import { Shield, AlertTriangle, CheckCircle2, Clock, Zap, RefreshCw } from 'lucide-react'
import StatCard from '../components/ui/StatCard'
import Card, { CardHeader } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { api } from '../lib/api'
import { useWorkspace } from '../lib/workspace'
import { useToast } from '../lib/toast'
import { cn, formatNumber, parseUtc, timeAgo } from '../lib/format'

interface AuditRow {
  id: number
  contact_id: number | null
  contact_name: string | null
  channel: string | null
  classification: string | null
  candidate_body: string | null
  candidate_length: number | null
  verdict: 'allow' | 'block'
  layer: string | null
  reason: string | null
  latency_ms: number | null
  created_at: string
}

interface AuditStats {
  blocked_24h: number | null
  allowed_24h: number | null
  blocked_today: number | null
  allowed_today: number | null
  total_lifetime: number | null
}

type Filter = 'all' | 'block' | 'allow'

const LAYER_LABEL: Record<string, string> = {
  L0_empty: 'Empty',
  L1_blocklist: 'Hard blocklist',
  L2_meta: 'Meta-response',
  L3_length: 'Length',
  L4_unresolved: 'Template var',
  L5_ai: 'AI guardrail',
  all_passed: 'Passed all checks',
}

const LAYER_TONE: Record<string, 'red' | 'amber' | 'violet' | 'emerald' | 'neutral'> = {
  L0_empty: 'neutral',
  L1_blocklist: 'red',
  L2_meta: 'amber',
  L3_length: 'amber',
  L4_unresolved: 'amber',
  L5_ai: 'violet',
  all_passed: 'emerald',
}

export default function Audit() {
  const { current: workspace, syncStamp } = useWorkspace()
  const toast = useToast()
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('block')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    try {
      const s = await api<AuditStats>('/api/audit/stats')
      setStats(s)
      const verdict = filter === 'all' ? '' : `&verdict=${filter}`
      const r = await api<{ rows: AuditRow[]; count: number }>(`/api/audit/recent?limit=200${verdict}`)
      setRows(r.rows ?? [])
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (syncStamp > 0) load()
    const t = setInterval(() => syncStamp > 0 && load(), 15_000)
    return () => clearInterval(t)
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [workspace, syncStamp, filter])

  const blockRate = useMemo(() => {
    const b = stats?.blocked_24h ?? 0
    const a = stats?.allowed_24h ?? 0
    if (b + a === 0) return 0
    return Math.round((1000 * b) / (b + a)) / 10
  }, [stats])

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            Message Audit
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Every outbound SMS is verified by the message gate before it ships. Every decision — allow OR block — is recorded here so you can see exactly what the bot tried to send and what was stopped.
          </p>
        </div>
        <Button size="sm" variant="ghost" iconLeft={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Blocked · today"
          value={formatNumber(stats?.blocked_today ?? 0)}
          icon={AlertTriangle}
          accent="from-red-500/40 to-rose-500/40"
          delta={`${formatNumber(stats?.blocked_24h ?? 0)} in last 24h`}
          deltaTone={(stats?.blocked_today ?? 0) > 0 ? 'positive' : 'neutral'}
          loading={loading && !stats}
        />
        <StatCard
          label="Allowed · today"
          value={formatNumber(stats?.allowed_today ?? 0)}
          icon={CheckCircle2}
          accent="from-emerald-500/40 to-teal-500/40"
          delta={`${formatNumber(stats?.allowed_24h ?? 0)} in last 24h`}
          loading={loading && !stats}
        />
        <StatCard
          label="Block rate · 24h"
          value={`${blockRate.toFixed(1)}%`}
          icon={Shield}
          accent="from-amber-500/40 to-orange-500/40"
          delta={(stats?.blocked_24h ?? 0) > 0 ? 'gate caught real issues' : 'all clean'}
          deltaTone={(stats?.blocked_24h ?? 0) > 0 ? 'positive' : 'neutral'}
          loading={loading && !stats}
        />
        <StatCard
          label="Total decisions"
          value={formatNumber(stats?.total_lifetime ?? 0)}
          icon={Zap}
          accent="from-violet-500/40 to-fuchsia-500/40"
          delta="lifetime — every send checked"
          loading={loading && !stats}
        />
      </div>

      <div className="flex items-center gap-2">
        <FilterChip active={filter === 'block'} onClick={() => setFilter('block')} label="Blocked" tone="red" />
        <FilterChip active={filter === 'allow'} onClick={() => setFilter('allow')} label="Allowed" tone="emerald" />
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="All" tone="neutral" />
        <span className="text-[11px] text-slate-500 ml-2">Showing latest {rows.length} · refreshes every 15s</span>
      </div>

      <Card flush>
        <div className="px-5 py-4 border-b border-slate-800/60">
          <CardHeader
            title={filter === 'block' ? 'Blocked messages' : filter === 'allow' ? 'Approved messages' : 'All decisions'}
            description="Click any row to see the full candidate text the gate evaluated."
            action={<Badge tone={filter === 'block' ? 'red' : filter === 'allow' ? 'emerald' : 'neutral'}>{rows.length}</Badge>}
            className="!mb-0"
          />
        </div>
        <div className="divide-y divide-slate-900/60">
          {loading && rows.length === 0 && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4"><Skeleton height={24} className="block w-full" /></div>
          ))}
          {!loading && rows.length === 0 && (
            <EmptyState
              icon={Shield}
              title="No decisions yet"
              description={filter === 'block' ? 'Nothing has been blocked. Either nothing has been sent yet, or every message has passed all checks.' : 'No decisions match this filter yet.'}
            />
          )}
          {rows.map((r) => {
            const isOpen = expandedId === r.id
            const isBlock = r.verdict === 'block'
            const layerLabel = LAYER_LABEL[r.layer ?? ''] ?? r.layer ?? '—'
            const layerTone = LAYER_TONE[r.layer ?? ''] ?? 'neutral'
            return (
              <button
                key={r.id}
                onClick={() => setExpandedId(isOpen ? null : r.id)}
                className="w-full text-left px-5 py-3.5 hover:bg-slate-900/40 transition flex flex-col gap-1.5"
              >
                <div className="flex items-center gap-2.5 text-xs flex-wrap">
                  <Badge tone={isBlock ? 'red' : 'emerald'} dot>
                    {isBlock ? 'BLOCKED' : 'allowed'}
                  </Badge>
                  <Badge tone={layerTone}>{layerLabel}</Badge>
                  {r.classification && <Badge tone="indigo" className="!text-[10px]">{r.classification}</Badge>}
                  {r.contact_name && <span className="text-slate-300 font-medium">{r.contact_name}</span>}
                  <span className="text-slate-600 ml-auto inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(r.created_at)}
                    {r.latency_ms != null && <span className="text-slate-700">· {r.latency_ms}ms</span>}
                  </span>
                </div>
                <div className={cn('text-xs leading-relaxed', isBlock ? 'text-red-200/90' : 'text-slate-400')}>
                  <span className="text-slate-500 mr-1">Reason:</span>
                  {r.reason || '—'}
                </div>
                <div className={cn(
                  'text-xs font-mono break-words [overflow-wrap:anywhere] rounded px-2.5 py-1.5 border',
                  isBlock ? 'border-red-500/20 bg-red-500/5 text-red-100/90' : 'border-slate-800/60 bg-slate-900/40 text-slate-300',
                  !isOpen && 'line-clamp-2',
                )}>
                  {r.candidate_body || '(empty)'}
                </div>
                {isOpen && r.candidate_length != null && (
                  <div className="text-[10px] text-slate-600 tabular-nums">
                    {formatNumber(r.candidate_length)} chars · {parseUtc(r.created_at)?.toLocaleString()}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="How the gate works" description="5 layers, first fail wins" action={<Shield className="w-4 h-4 text-emerald-400" />} />
        <ol className="space-y-2 text-xs text-slate-400">
          <li><Badge tone="red" className="!text-[10px] mr-2">L1</Badge>Hard blocklist — deterministic regex (e.g. <code className="text-violet-200">→</code> arrow, <code className="text-violet-200">Per CUSTOM RULE #N</code>, <code className="text-violet-200">IF: ... THEN:</code>). No Claude call needed.</li>
          <li><Badge tone="amber" className="!text-[10px] mr-2">L2</Badge>Meta-response detection — "as an AI", "I need to see your message", "could you provide", etc.</li>
          <li><Badge tone="amber" className="!text-[10px] mr-2">L3</Badge>Length sanity — under 5 chars or over 1000 chars rejected.</li>
          <li><Badge tone="amber" className="!text-[10px] mr-2">L4</Badge>Unresolved <code className="text-violet-200">{'{{template}}'}</code> variables (defense against prompt-engineering bugs).</li>
          <li><Badge tone="violet" className="!text-[10px] mr-2">L5</Badge>AI guardrail — final Claude Haiku safety review. Fails CLOSED on any error.</li>
        </ol>
      </Card>
    </div>
  )
}

function FilterChip({ active, onClick, label, tone }: { active: boolean; onClick: () => void; label: string; tone: 'red' | 'emerald' | 'neutral' }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-lg text-xs transition border',
        active
          ? tone === 'red'
            ? 'bg-red-500/15 text-red-200 border-red-500/30'
            : tone === 'emerald'
              ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
              : 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30'
          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border-transparent',
      )}
    >
      {label}
    </button>
  )
}
