import { useEffect, useMemo, useState } from 'react'
import { Phone, PhoneCall, PhoneOff, Clock, Mic, X, Sparkles } from 'lucide-react'
import StatCard from '../components/ui/StatCard'
import Card, { CardHeader } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import Avatar from '../components/ui/Avatar'
import Modal from '../components/ui/Modal'
import { api } from '../lib/api'
import { useWorkspace } from '../lib/workspace'
import { useToast } from '../lib/toast'
import { formatNumber, formatPhone, timeAgo, parseUtc, cn } from '../lib/format'
import { Link } from 'react-router-dom'

interface CallSummary {
  id: number
  contactId: number
  conversationId: number | null
  contactName: string | null
  phone: string | null
  stage: string | null
  durationSeconds: number | null
  status: string
  outcome: string | null
  summary: string | null
  initiatedAt: string
  completedAt: string | null
  elConvId: string | null
}

interface CallStats {
  totalCalls: number
  callsToday: number
  avgDurationSeconds: number
  successRate: number
  bookedFromCalls: number
  outcomes: Record<string, number>
  recentCalls: CallSummary[]
}

interface CallDetail {
  id: number
  contact_id: number
  conversation_id: number | null
  elevenlabs_conversation_id: string | null
  status: string
  outcome: string | null
  summary: string | null
  duration_seconds: number | null
  transcript: string | null
  recording_url: string | null
  initiated_at: string
  completed_at: string | null
  analysis_result: string | null
}

const OUTCOME_TONE: Record<string, 'emerald' | 'amber' | 'red' | 'neutral' | 'indigo' | 'violet'> = {
  booked: 'emerald',
  interested: 'indigo',
  callback: 'violet',
  no_answer: 'neutral',
  not_interested: 'red',
  unknown: 'neutral',
}

export default function Calls() {
  const { current: workspace, syncStamp } = useWorkspace()
  const toast = useToast()
  const [stats, setStats] = useState<CallStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | string>('all')
  const [openCallId, setOpenCallId] = useState<number | null>(null)
  const [detail, setDetail] = useState<CallDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      try {
        await api('/api/workspaces/switch', { method: 'POST', body: { slug: workspace } })
      } catch { /* non-fatal */ }
      const res = await api<CallStats>('/api/calls/stats')
      setStats(res)
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

  async function loadDetail(id: number) {
    setOpenCallId(id)
    setDetail(null)
    setDetailLoading(true)
    try {
      const res = await api<CallDetail>(`/api/calls/${id}`)
      setDetail(res)
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    } finally {
      setDetailLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const list = stats?.recentCalls ?? []
    if (filter === 'all') return list
    return list.filter((c) => c.outcome === filter)
  }, [stats, filter])

  const outcomes = stats?.outcomes ?? {}

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Voice calls</h1>
          <p className="text-sm text-slate-500 mt-1">ElevenLabs-powered AI calls. Click any row for transcript + outcome.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total calls" value={formatNumber(stats?.totalCalls ?? 0)} icon={PhoneCall} accent="from-indigo-500/40 to-violet-500/40" loading={loading && !stats} />
        <StatCard label="Calls today" value={formatNumber(stats?.callsToday ?? 0)} icon={Phone} accent="from-cyan-500/40 to-sky-500/40" loading={loading && !stats} />
        <StatCard label="Avg duration" value={`${stats?.avgDurationSeconds ?? 0}s`} icon={Clock} accent="from-amber-500/40 to-orange-500/40" loading={loading && !stats} />
        <StatCard label="Booked from calls" value={formatNumber(stats?.bookedFromCalls ?? 0)} delta={`${stats?.successRate ?? 0}% success rate`} deltaTone="positive" icon={Sparkles} accent="from-emerald-500/40 to-teal-500/40" loading={loading && !stats} />
      </div>

      {/* Outcome filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs transition border',
            filter === 'all'
              ? 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border-transparent',
          )}
        >
          All ({stats?.recentCalls.length ?? 0})
        </button>
        {Object.entries(outcomes).map(([k, n]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs transition border',
              filter === k
                ? 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border-transparent',
            )}
          >
            {k.replace(/_/g, ' ')} ({n})
          </button>
        ))}
      </div>

      <Card flush>
        <div className="px-5 py-4 border-b border-slate-800/60">
          <CardHeader title="Recent calls" description="Most recent first" className="!mb-0" />
        </div>
        <div className="divide-y divide-slate-900/60">
          {loading && !stats && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-5"><Skeleton height={48} className="block w-full" /></div>
          ))}
          {!loading && filtered.length === 0 && (
            <EmptyState icon={PhoneOff} title="No calls" description="Once the voice engine fires, calls land here." />
          )}
          {filtered.map((c) => {
            const tone = OUTCOME_TONE[c.outcome ?? 'unknown'] ?? 'neutral'
            const dur = c.durationSeconds ? `${Math.floor(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s` : '—'
            const name = c.contactName?.trim() || formatPhone(c.phone) || 'Unknown'
            return (
              <button
                key={c.id}
                onClick={() => loadDetail(c.id)}
                className="w-full text-left grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-5 py-3 hover:bg-slate-900/40 transition items-center"
              >
                <Avatar firstName={c.contactName ?? undefined} size="sm" />
                <div className="min-w-0">
                  <div className="text-sm text-slate-100 font-medium truncate">{name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{formatPhone(c.phone)}</div>
                </div>
                {c.stage && <Badge tone="indigo" className="!text-[10px] justify-self-start">stage · {c.stage}</Badge>}
                {c.outcome ? <Badge tone={tone} className="!text-[10px]" dot>{c.outcome.replace(/_/g, ' ')}</Badge> : <Badge tone="neutral" className="!text-[10px]">{c.status}</Badge>}
                <div className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                  <Clock className="inline w-3 h-3 mr-1" />{dur}
                </div>
                <div className="text-[11px] text-slate-600 whitespace-nowrap">{timeAgo(c.initiatedAt)}</div>
              </button>
            )
          })}
        </div>
      </Card>

      <Modal
        open={openCallId !== null}
        onClose={() => { setOpenCallId(null); setDetail(null) }}
        size="xl"
        title={detail ? `Call #${detail.id} — ${detail.duration_seconds || 0}s` : 'Call detail'}
        footer={
          <Button variant="ghost" onClick={() => { setOpenCallId(null); setDetail(null) }} iconLeft={<X className="w-3.5 h-3.5" />}>
            Close
          </Button>
        }
      >
        {detailLoading && <Skeleton height={200} className="block w-full" />}
        {detail && <CallDetailView detail={detail} />}
      </Modal>
    </div>
  )
}

function CallDetailView({ detail }: { detail: CallDetail }) {
  const transcript = useMemo(() => parseTranscript(detail.transcript), [detail.transcript])
  const analysis = useMemo(() => {
    try { return detail.analysis_result ? JSON.parse(detail.analysis_result) : null } catch { return null }
  }, [detail.analysis_result])
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <Field label="Status" value={<Badge tone="indigo">{detail.status}</Badge>} />
        <Field label="Outcome" value={detail.outcome ? <Badge tone={OUTCOME_TONE[detail.outcome] ?? 'neutral'} dot>{detail.outcome.replace(/_/g, ' ')}</Badge> : <span className="text-slate-500">—</span>} />
        <Field label="Started" value={parseUtc(detail.initiated_at)?.toLocaleString() ?? '—'} />
        <Field label="Ended" value={detail.completed_at ? parseUtc(detail.completed_at)?.toLocaleString() : '—'} />
      </div>

      {detail.recording_url && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium mb-1.5">Recording</div>
          <audio src={detail.recording_url} controls className="w-full" />
        </div>
      )}

      {detail.summary && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium mb-1.5">Summary</div>
          <div className="text-sm text-slate-200 leading-relaxed bg-slate-950/60 border border-slate-800/60 rounded-lg p-3">{detail.summary}</div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <Mic className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium">Transcript</span>
        </div>
        {transcript.length === 0 ? (
          <div className="text-xs text-slate-600 italic">No transcript available — call may not have completed, or webhook hasn't synced yet.</div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-auto pr-2">
            {transcript.map((turn, i) => (
              <div key={i} className={cn('flex', turn.role === 'agent' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                  turn.role === 'agent'
                    ? 'bg-gradient-to-br from-indigo-500/80 to-violet-600/80 text-white'
                    : 'bg-slate-800/70 text-slate-100 border border-slate-700/60',
                )}>
                  <div className="text-[10px] opacity-70 mb-0.5 capitalize">{turn.role}</div>
                  {turn.message}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {analysis && Object.keys(analysis).length > 0 && (
        <details className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-3">
          <summary className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium cursor-pointer">Analysis JSON</summary>
          <pre className="text-[11px] text-slate-400 mt-2 overflow-auto max-h-64">{JSON.stringify(analysis, null, 2)}</pre>
        </details>
      )}

      {detail.contact_id && (
        <div className="pt-3 border-t border-slate-800/60">
          <Link
            to={`/conversations/${detail.contact_id}`}
            className="text-sm text-indigo-300 hover:text-indigo-200 transition inline-flex items-center gap-1"
          >
            Open conversation →
          </Link>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium mb-1">{label}</div>
      <div className="text-sm text-slate-100">{value}</div>
    </div>
  )
}

function parseTranscript(raw: string | null): Array<{ role: string; message: string }> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
        .map((t: { role?: string; message?: string; text?: string }) => ({
          role: t.role ?? 'user',
          message: t.message ?? t.text ?? '',
        }))
        .filter((t) => t.message)
    }
  } catch { /* fall through */ }
  // Plain-text transcript: one role per line "agent: hi" / "user: hello"
  return raw
    .split('\n')
    .map((line) => {
      const m = line.match(/^(agent|user|caller|callee):\s*(.+)$/i)
      if (m) return { role: m[1].toLowerCase(), message: m[2] }
      return null
    })
    .filter((t): t is { role: string; message: string } => t !== null)
}
