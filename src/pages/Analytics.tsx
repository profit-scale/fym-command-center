import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDownLeft, ArrowUpRight, BarChart3, Cpu, DollarSign, Gauge, MessageSquare, Sparkles, Users, Zap } from 'lucide-react'
import StatCard from '../components/ui/StatCard'
import Card, { CardHeader } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import { api } from '../lib/api'
import { useWorkspace } from '../lib/workspace'
import { formatNumber, cn } from '../lib/format'
import { useToast } from '../lib/toast'

interface AnalyticsDashboard {
  overview: {
    totalContacts: number
    activeConvos: number
    messagesToday: number
    messagesYesterday: number
    inboundToday: number
    outboundToday: number
    totalInbound: number
    totalOutbound: number
    responseRate: number
  }
  hourlyVolume: Array<{ hour: number; inbound: number; outbound: number }>
  dailyVolume: Array<{ day: string; inbound: number; outbound: number }>
  sentiment: { avgToday: number; avgYesterday: number; daily: Array<{ day: string; avg: number }> }
  aiMetrics: { avgResponseTimeMs: number; avgTokensPerCall: number; totalAiCalls: number; aiCallsToday: number }
  tokenUsage: {
    model: string
    inputRate: number
    outputRate: number
    totalInput: number
    totalOutput: number
    inputToday: number
    outputToday: number
    tokensToday: number
    tokensYesterday: number
    costToday: number
    costYesterday: number
    costTotal: number
    avgCostPerCall: number
    dailyCosts: Array<{ day: string; cost: number; tokens: number }>
  }
  smsUsage: {
    costPerSegment: number
    totalSegments: number
    totalMessages: number
    segmentsToday: number
    messagesToday: number
    costToday: number
    costYesterday: number
    costTotal: number
  }
  system: {
    status: string
    uptime: number
    errors24h: number
    sync: { phase: string; messagesImported: number; contactsImported: number }
    counts: { messages: number; conversations: number; contacts: number }
  }
}

type Range = '24h' | '7d'

export default function Analytics() {
  const { current: workspace, syncStamp } = useWorkspace()
  const toast = useToast()
  const [data, setData] = useState<AnalyticsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('7d')

  async function load() {
    setLoading(true)
    try {
      try {
        await api('/api/workspaces/switch', { method: 'POST', body: { slug: workspace } })
      } catch { /* non-fatal */ }
      const res = await api<AnalyticsDashboard>('/api/analytics/dashboard')
      setData(res)
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (syncStamp > 0) load()
    const t = setInterval(() => syncStamp > 0 && load(), 30_000)
    return () => clearInterval(t)
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [workspace, syncStamp])

  // Build the volume series we'll chart based on the toggle
  const volumeSeries = useMemo(() => {
    if (!data) return [] as Array<{ label: string; inbound: number; outbound: number }>
    if (range === '24h') {
      return data.hourlyVolume.map((h) => ({
        label: `${String(h.hour).padStart(2, '0')}:00`,
        inbound: h.inbound,
        outbound: h.outbound,
      }))
    }
    // Default: last 7 days. dailyVolume can be empty during early populate; fall back to a flat 7-bucket array.
    const dv = data.dailyVolume ?? []
    if (dv.length > 0) {
      return dv.slice(-7).map((d) => ({
        label: new Date(d.day).toLocaleDateString('en-US', { weekday: 'short' }),
        inbound: d.inbound,
        outbound: d.outbound,
      }))
    }
    return []
  }, [data, range])

  // Combined daily cost series (Claude tokens + SMS) for cost chart.
  const costSeries = useMemo(() => {
    if (!data) return [] as Array<{ day: string; ai: number; sms: number; total: number }>
    const map = new Map<string, { ai: number; sms: number }>()
    for (const c of data.tokenUsage.dailyCosts ?? []) {
      const ex = map.get(c.day) ?? { ai: 0, sms: 0 }
      ex.ai = c.cost
      map.set(c.day, ex)
    }
    return [...map.entries()]
      .map(([day, v]) => ({ day, ai: v.ai, sms: v.sms, total: v.ai + v.sms }))
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-14)
  }, [data])

  const totalCostToday = (data?.tokenUsage.costToday ?? 0) + (data?.smsUsage.costToday ?? 0)
  const totalCostAll = (data?.tokenUsage.costTotal ?? 0) + (data?.smsUsage.costTotal ?? 0)

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Volume, response rate, token usage, and operational cost — refreshes every 30s.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-0.5">
          {(['24h', '7d'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-md transition',
                range === r ? 'bg-indigo-500/15 text-indigo-200' : 'text-slate-400 hover:text-slate-100',
              )}
            >
              {r === '24h' ? 'Last 24h' : 'Last 7d'}
            </button>
          ))}
        </div>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Response rate"
          value={`${data?.overview.responseRate ?? 0}%`}
          delta={`${formatNumber(data?.overview.totalInbound ?? 0)} in / ${formatNumber(data?.overview.totalOutbound ?? 0)} out`}
          icon={Gauge}
          accent="from-emerald-500/40 to-teal-500/40"
          loading={loading && !data}
        />
        <StatCard
          label="Active contacts"
          value={formatNumber(data?.overview.totalContacts ?? 0)}
          delta={`${formatNumber(data?.overview.activeConvos ?? 0)} active conversations`}
          icon={Users}
          accent="from-indigo-500/40 to-violet-500/40"
          loading={loading && !data}
        />
        <StatCard
          label="Tokens · today"
          value={formatNumber(data?.tokenUsage.tokensToday ?? 0)}
          delta={`avg ${formatNumber(data?.aiMetrics.avgTokensPerCall ?? 0)}/call · ${data?.tokenUsage.model.replace('claude-', '')}`}
          icon={Cpu}
          accent="from-cyan-500/40 to-sky-500/40"
          loading={loading && !data}
        />
        <StatCard
          label="Cost · today"
          value={`$${(totalCostToday).toFixed(2)}`}
          delta={`AI $${(data?.tokenUsage.costToday ?? 0).toFixed(2)} · SMS $${(data?.smsUsage.costToday ?? 0).toFixed(2)}`}
          icon={DollarSign}
          accent="from-amber-500/40 to-orange-500/40"
          loading={loading && !data}
        />
      </div>

      {/* Message volume chart */}
      <Card flush>
        <div className="px-5 py-4 border-b border-slate-800/60">
          <CardHeader
            title="Message volume"
            description={range === '24h' ? 'Per hour, last 24 hours' : 'Per day, last 7 days'}
            action={
              <div className="flex items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-400" />Inbound</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-indigo-400" />Outbound</span>
              </div>
            }
            className="!mb-0"
          />
        </div>
        <div className="p-5">
          <VolumeBars series={volumeSeries} loading={loading && !data} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cost chart */}
        <Card flush>
          <div className="px-5 py-4 border-b border-slate-800/60">
            <CardHeader
              title="Cost · last 14 days"
              description={`Claude ${data ? `$${data.tokenUsage.inputRate}/M in · $${data.tokenUsage.outputRate}/M out` : ''} · SMS $${data?.smsUsage.costPerSegment.toFixed(4) ?? '0.0083'}/segment`}
              action={<Badge tone="amber">$ {totalCostAll.toFixed(2)} all-time</Badge>}
              className="!mb-0"
            />
          </div>
          <div className="p-5">
            <CostLine series={costSeries} loading={loading && !data} />
            {costSeries.length === 0 && !loading && (
              <div className="text-center text-xs text-slate-600 py-8">No cost data yet</div>
            )}
          </div>
        </Card>

        {/* AI metrics */}
        <Card flush>
          <div className="px-5 py-4 border-b border-slate-800/60">
            <CardHeader
              title="AI engine"
              description="Anthropic Claude Haiku · per-reply metrics"
              action={<Sparkles className="w-4 h-4 text-violet-400" />}
              className="!mb-0"
            />
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <Stat label="AI replies · all-time" value={formatNumber(data?.aiMetrics.totalAiCalls ?? 0)} icon={MessageSquare} />
            <Stat label="AI replies · today" value={formatNumber(data?.aiMetrics.aiCallsToday ?? 0)} icon={Zap} />
            <Stat label="Avg response time" value={`${Math.round((data?.aiMetrics.avgResponseTimeMs ?? 0) / 100) / 10}s`} icon={Activity} />
            <Stat label="Avg cost per reply" value={`$${(data?.tokenUsage.avgCostPerCall ?? 0).toFixed(4)}`} icon={DollarSign} />
            <Stat label="Tokens in · today" value={formatNumber(data?.tokenUsage.inputToday ?? 0)} icon={ArrowDownLeft} />
            <Stat label="Tokens out · today" value={formatNumber(data?.tokenUsage.outputToday ?? 0)} icon={ArrowUpRight} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SMS usage */}
        <Card>
          <CardHeader title="SMS volume" description="Twilio segments via GHL" action={<BarChart3 className="w-4 h-4 text-cyan-400" />} />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Segments today" value={formatNumber(data?.smsUsage.segmentsToday ?? 0)} />
            <Stat label="Messages today" value={formatNumber(data?.smsUsage.messagesToday ?? 0)} />
            <Stat label="Total segments" value={formatNumber(data?.smsUsage.totalSegments ?? 0)} />
            <Stat label="Total cost" value={`$${(data?.smsUsage.costTotal ?? 0).toFixed(2)}`} />
          </div>
        </Card>

        {/* System status */}
        <Card>
          <CardHeader
            title="System health"
            description="Engine + sync"
            action={
              <Badge tone={data?.system.status === 'running' ? 'emerald' : 'amber'} dot>
                {data?.system.status ?? 'unknown'}
              </Badge>
            }
          />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Uptime" value={formatUptime(data?.system.uptime ?? 0)} />
            <Stat label="Errors · 24h" value={formatNumber(data?.system.errors24h ?? 0)} />
            <Stat label="Messages indexed" value={formatNumber(data?.system.counts.messages ?? 0)} />
            <Stat label="Sync phase" value={<span className="text-base font-medium capitalize">{data?.system.sync.phase ?? '—'}</span>} />
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ---------- inline charts (no external lib) ---------- */

function VolumeBars({ series, loading }: { series: Array<{ label: string; inbound: number; outbound: number }>; loading: boolean }) {
  if (loading) return <Skeleton height={220} className="block w-full" />
  if (series.length === 0) return <div className="h-56 flex items-center justify-center text-xs text-slate-600">No volume data yet</div>
  const max = Math.max(1, ...series.flatMap((s) => [s.inbound, s.outbound]))
  return (
    <div className="h-56 w-full flex items-end gap-1">
      {series.map((s, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0 group">
          <div className="text-[9px] text-slate-600 tabular-nums opacity-0 group-hover:opacity-100 transition">
            ↘{s.inbound} ↗{s.outbound}
          </div>
          <div className="w-full flex items-end justify-center gap-0.5 h-44">
            <div
              className="w-1/2 rounded-t-sm bg-gradient-to-t from-emerald-600 to-emerald-400/80 transition group-hover:from-emerald-500 group-hover:to-emerald-300"
              style={{ height: `${(s.inbound / max) * 100}%`, minHeight: s.inbound > 0 ? 2 : 0 }}
              title={`Inbound: ${s.inbound}`}
            />
            <div
              className="w-1/2 rounded-t-sm bg-gradient-to-t from-indigo-600 to-indigo-400/80 transition group-hover:from-indigo-500 group-hover:to-indigo-300"
              style={{ height: `${(s.outbound / max) * 100}%`, minHeight: s.outbound > 0 ? 2 : 0 }}
              title={`Outbound: ${s.outbound}`}
            />
          </div>
          <div className="text-[9px] text-slate-600 truncate w-full text-center">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

function CostLine({ series, loading }: { series: Array<{ day: string; ai: number; sms: number; total: number }>; loading: boolean }) {
  if (loading) return <Skeleton height={180} className="block w-full" />
  if (series.length === 0) return null
  const W = 600, H = 160, P = 10
  const max = Math.max(0.001, ...series.map((s) => s.total))
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, series.length - 1)
  const y = (v: number) => H - P - ((v / max) * (H - 2 * P))
  const path = series.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(s.total)}`).join(' ')
  const areaPath = `${path} L${x(series.length - 1)},${H - P} L${x(0)},${H - P} Z`
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44">
        <defs>
          <linearGradient id="cost-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(245, 158, 11)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="rgb(245, 158, 11)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#cost-grad)" />
        <path d={path} fill="none" stroke="rgb(245, 158, 11)" strokeWidth="2" />
        {series.map((s, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(s.total)} r="3" fill="rgb(245, 158, 11)" />
            <title>{`${s.day}: $${s.total.toFixed(4)} (AI $${s.ai.toFixed(4)})`}</title>
          </g>
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-600 mt-1">
        <span>{series[0]?.day}</span>
        <span>{series[series.length - 1]?.day}</span>
      </div>
    </div>
  )
}

function Stat({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && (
        <div className="w-7 h-7 rounded-lg bg-slate-800/60 border border-slate-700/40 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
          <Icon className="w-3.5 h-3.5" />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium mb-0.5">{label}</div>
        <div className="text-xl font-bold text-slate-100 tabular-nums">{value}</div>
      </div>
    </div>
  )
}

function formatUptime(ms: number) {
  if (!ms) return '—'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
