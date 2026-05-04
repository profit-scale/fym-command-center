import { useEffect, useRef, useState } from 'react'
import { Activity, MessageCircle, ArrowUpRight, ArrowDownLeft, Users, Sparkles, Clock, Zap, Target, Timer } from 'lucide-react'
import StatCard from '../components/ui/StatCard'
import Card, { CardHeader } from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import { api, subscribeSSE } from '../lib/api'
import { useWorkspace } from '../lib/workspace'
import { formatNumber, timeAgo, parseUtc, cn, classifyBody, bodyKindLabel, bodyPreview, formatDuration } from '../lib/format'
import type { Message, SSEEvent } from '../lib/types'

interface Counts {
  outbound_24h: number
  inbound_24h: number
  contacts_total: number
  outbound_1h: number
  contact_rate: number
  speed_to_lead_seconds: number | null
  speed_to_lead_median_seconds: number | null
  speed_to_lead_sample: number
}

export default function LiveFeed() {
  const { current: workspace, workspaces, syncStamp } = useWorkspace()
  const ws = workspaces[workspace]
  const [recent, setRecent] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [pulse, setPulse] = useState<number>(Date.now())

  const counts: Counts = {
    outbound_24h: Number(ws?.outbound_24h ?? 0),
    inbound_24h: Number(ws?.inbound_24h ?? 0),
    contacts_total: Number(ws?.contacts_total ?? 0),
    outbound_1h: Number(ws?.outbound_1h ?? 0),
    contact_rate: Number(ws?.contact_rate ?? 0),
    speed_to_lead_seconds: ws?.speed_to_lead_seconds ?? null,
    speed_to_lead_median_seconds: ws?.speed_to_lead_median_seconds ?? null,
    speed_to_lead_sample: Number(ws?.speed_to_lead_sample ?? 0),
  }

  async function loadRecent() {
    try {
      try {
        await api('/api/workspaces/switch', { method: 'POST', body: { slug: workspace } })
      } catch { /* non-fatal */ }
      type R = { messages: Message[] }
      // /api/messages/recent already returns the workspace's recent activity
      // with first_name + phone joined onto each row.
      const res = await api<R>('/api/messages/recent', { query: { limit: 30 } })
      setRecent(res.messages ?? [])
    } catch {
      // Silent — we still want the stat cards even if the feed call fails
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (syncStamp === 0) return
    setLoading(true)
    loadRecent()
    const t = setInterval(loadRecent, 8_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, syncStamp])

  // SSE handler keeps a *ref* to the latest loadRecent so workspace switches
  // don't get stuck calling the old workspace's loader (stale closure).
  // Also debounces burst events — the engine can push 30+ messages in a few
  // seconds, and without this each one triggered a workspace-switch + full
  // /api/messages/recent refetch. Now we collapse a burst into one reload.
  const loadRecentRef = useRef(loadRecent)
  useEffect(() => { loadRecentRef.current = loadRecent })
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null
    let pulseClear: ReturnType<typeof setTimeout> | null = null
    const off = subscribeSSE('/api/events', (raw) => {
      const data = raw as SSEEvent
      if (data.event === 'message') {
        setPulse(Date.now())
        // Schedule a re-render in 1.6s so the animate-ping class clears once
        // the live indicator should stop pinging. Without this, the dot
        // animates forever after the LAST event because no re-render fires.
        if (pulseClear) clearTimeout(pulseClear)
        pulseClear = setTimeout(() => setPulse((p) => p), 1600)
        if (pending) clearTimeout(pending)
        pending = setTimeout(() => loadRecentRef.current(), 800)
      }
    })
    return () => {
      if (pending) clearTimeout(pending)
      if (pulseClear) clearTimeout(pulseClear)
      off()
    }
  }, [])

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Hero */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Live Feed</h1>
          <p className="text-sm text-slate-500 mt-1">
            Every inbound and outbound across <strong className="text-slate-300">{ws?.name ?? workspace}</strong> — in real time.
          </p>
        </div>
        <div className="text-[11px] text-slate-500 flex items-center gap-2">
          <span className={cn('w-1.5 h-1.5 rounded-full bg-emerald-400 transition', Date.now() - pulse < 1500 && 'animate-ping')} />
          live · last event {timeAgo(new Date(pulse).toISOString())}
        </div>
      </div>

      {/* Stats — top row: throughput */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Sent · 24h"   value={formatNumber(counts.outbound_24h)} icon={ArrowUpRight} accent="from-indigo-500/40 to-violet-500/40" />
        <StatCard label="Received · 24h" value={formatNumber(counts.inbound_24h)} icon={ArrowDownLeft} accent="from-emerald-500/40 to-teal-500/40" />
        <StatCard label="Sent · last hour" value={formatNumber(counts.outbound_1h)} icon={Zap} accent="from-cyan-500/40 to-sky-500/40" delta={counts.outbound_1h > 0 ? 'engine active' : 'idle'} deltaTone={counts.outbound_1h > 0 ? 'positive' : 'neutral'} />
        <StatCard label="Total contacts" value={formatNumber(counts.contacts_total)} icon={Users} accent="from-amber-500/40 to-orange-500/40" />
      </div>

      {/* Stats — second row: lead-gen quality (contact rate + speed to lead) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          label="Contact rate"
          value={`${counts.contact_rate.toFixed(1)}%`}
          icon={Target}
          accent="from-violet-500/40 to-fuchsia-500/40"
          delta={`${formatNumber(Math.round(counts.contacts_total * counts.contact_rate / 100))} / ${formatNumber(counts.contacts_total)} contacts messaged`}
          deltaTone={counts.contact_rate >= 80 ? 'positive' : counts.contact_rate >= 50 ? 'neutral' : 'negative'}
        />
        <StatCard
          label="Speed to lead"
          // Headline is the MEDIAN — represents the typical lead's wait time,
          // which is what Adam wants to see "in most cases". The mean is
          // exposed in the delta line for context (it's pulled high by long-
          // tail backlog: e.g. one lead messaged 34h late drags the mean to
          // 25min while 49 of 99 contacts are still under 25s).
          value={formatDuration(counts.speed_to_lead_median_seconds)}
          icon={Timer}
          accent="from-emerald-500/40 to-lime-500/40"
          delta={counts.speed_to_lead_sample > 0
            ? `median · avg ${formatDuration(counts.speed_to_lead_seconds)} · n=${formatNumber(counts.speed_to_lead_sample)} (30d)`
            : 'no leads contacted in last 30 days'}
          deltaTone={counts.speed_to_lead_median_seconds == null ? 'neutral' : counts.speed_to_lead_median_seconds <= 60 ? 'positive' : counts.speed_to_lead_median_seconds <= 600 ? 'neutral' : 'negative'}
        />
      </div>

      {/* Live activity stream */}
      <Card flush>
        <div className="px-5 py-4 border-b border-slate-800/60">
          <CardHeader
            title="Recent activity"
            description="Newest events first. Inbounds are highlighted."
            action={<Badge tone="emerald" dot>SSE connected</Badge>}
            className="!mb-0"
          />
        </div>

        <div className="divide-y divide-slate-900/60">
          {loading && recent.length === 0 && (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <Skeleton width={32} height={32} rounded="rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton height={12} width="40%" />
                    <Skeleton height={14} width="80%" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && recent.length === 0 && (
            <EmptyState
              icon={Sparkles}
              title="No activity yet"
              description="Once leads come in, the feed will fill up here."
            />
          )}

          {recent.map((m, idx) => {
            const isInbound = m.direction === 'inbound'
            const Icon = isInbound ? ArrowDownLeft : ArrowUpRight
            const kind = classifyBody(m.body)
            const isJunk = kind !== 'normal'
            const preview = bodyPreview(m.body, 160)
            return (
              <div key={m.id} className={cn('flex gap-3 px-5 py-3 hover:bg-slate-900/40 transition', idx === 0 && 'animate-slide-in')}>
                <Avatar firstName={m.first_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={cn('inline-flex items-center gap-1', isInbound ? 'text-emerald-400' : 'text-indigo-300')}>
                      <Icon className="w-3 h-3" />
                      {isInbound ? 'Inbound' : 'Outbound'}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-200 font-medium truncate">{m.first_name ?? 'Unknown'}</span>
                    {m.message_type && m.message_type !== 'SMS' && (
                      <Badge tone="violet" className="!text-[10px] !py-0">{m.message_type}</Badge>
                    )}
                    {m.classified_as && (
                      <Badge tone="indigo" className="!text-[10px] !py-0">{m.classified_as}</Badge>
                    )}
                    {isJunk && (
                      <Badge tone="neutral" className="!text-[10px] !py-0">{bodyKindLabel(kind)}</Badge>
                    )}
                    <span className="text-slate-500 ml-auto inline-flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3" />
                      {timeAgo(m.created_at)}
                    </span>
                  </div>
                  <div className={cn('mt-1 text-sm', isJunk ? 'text-slate-600 italic text-xs' : isInbound ? 'text-slate-100' : 'text-slate-300')}>
                    {preview}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1">{parseUtc(m.created_at)?.toLocaleString()}</div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card hover>
          <CardHeader title="Conversations" description="Open the full inbox" action={<MessageCircle className="w-4 h-4 text-indigo-400" />} />
          <a href="/conversations" className="text-sm text-indigo-300 hover:text-indigo-200 transition">Open inbox →</a>
        </Card>
        <Card hover>
          <CardHeader title="Pipeline" description="See the funnel by stage" action={<Activity className="w-4 h-4 text-cyan-400" />} />
          <a href="/pipeline" className="text-sm text-indigo-300 hover:text-indigo-200 transition">View pipeline →</a>
        </Card>
        <Card hover>
          <CardHeader title="Train the AI" description="Add or edit feedback rules" action={<Sparkles className="w-4 h-4 text-violet-400" />} />
          <a href="/train-ai" className="text-sm text-indigo-300 hover:text-indigo-200 transition">Open trainer →</a>
        </Card>
      </div>
    </div>
  )
}
