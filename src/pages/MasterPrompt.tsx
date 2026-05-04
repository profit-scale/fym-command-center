import { useEffect, useMemo, useRef, useState } from 'react'
import { Save, RotateCcw, Code2, Sparkles, History, Shield, AlertTriangle, Check, Play, Cpu, Zap, ArrowRight, Tag, Database, Eye, EyeOff, Search, Copy } from 'lucide-react'
import Card, { CardHeader } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Banner from '../components/ui/Banner'
import Skeleton from '../components/ui/Skeleton'
import Modal from '../components/ui/Modal'
import Input, { Textarea } from '../components/ui/Input'
import { api } from '../lib/api'
import { useWorkspace } from '../lib/workspace'
import { useToast } from '../lib/toast'
import { timeAgo, cn, formatNumber } from '../lib/format'
import type { PromptTemplate } from '../lib/types'

interface PromptContextResp {
  auto_context_sample: string | null
  sample_contact: { id: number; first_name: string | null; last_name: string | null; stage: string | null } | null
  top_tags: Array<{ tag: string; count: number }>
  top_custom_fields: Array<{ field_id: string; label: string; sample_values: string[]; mapped: boolean }>
  total_contacts: number
}

const HARD_RULES = [
  { title: 'No system language',     d: "Reply gets dropped if it contains words like \"tag\", \"system\", \"record\", \"database\", \"AI\", or \"sorry for the mix-up\"." },
  { title: 'Banned phrases',         d: "Drops messages with \"just checking in\", \"circling back\", \"did you review\", \"calling you now\", \"ma'am\", \"sir\", and similar." },
  { title: 'Business hours',         d: "Follow-ups only fire 9–6 Mon–Fri in the contact's local time. Belt-and-suspenders: checked at eligibility AND at send." },
  { title: 'Daily cap',              d: 'Max 2 follow-ups per contact per day, 4-hour minimum gap between any two messages.' },
  { title: 'Bot-internal leak rules', d: 'Hard blocklist on → arrow, "Per CUSTOM RULE", IF:..THEN:, "Format: casual/short", "Lead has been cold N+ days", reactivation jargon. Audit at /audit.' },
  { title: 'Suppression tags',       d: 'Booked / Sold / Lost / Disqualified / Replied | Call → no further messages.' },
]

function diffSummary(a: string, b: string) {
  if (a === b) return null
  return { added: Math.max(0, b.length - a.length), removed: Math.max(0, a.length - b.length) }
}

export default function MasterPrompt() {
  const { current: workspace, workspaces, syncStamp } = useWorkspace()
  const ws = workspaces[workspace]
  const toast = useToast()

  const [prompts, setPrompts] = useState<PromptTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState('')
  const [activeId, setActiveId] = useState<number | null>(null)
  const [viewingId, setViewingId] = useState<number | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const [ctx, setCtx] = useState<PromptContextResp | null>(null)
  const [showAutoContext, setShowAutoContext] = useState(true)
  const [tagSearch, setTagSearch] = useState('')

  // Simulator state
  const [simOpen, setSimOpen] = useState(false)
  const [simRunning, setSimRunning] = useState(false)
  const [simFirstName, setSimFirstName] = useState('')
  const [simMessage, setSimMessage] = useState('')
  const [simResult, setSimResult] = useState<SimResult | null>(null)

  async function load() {
    setLoading(true)
    try {
      // Defensive switch: another tab or 30s health-poll cycle could have
      // re-set the engine's active workspace. Re-assert ours immediately
      // before reading prompts.
      try {
        await api('/api/workspaces/switch', { method: 'POST', body: { slug: workspace } })
      } catch { /* non-fatal */ }
      type R = { prompts: PromptTemplate[] }
      const res = await api<R>('/api/prompts')
      const masters = (res.prompts ?? []).filter((p) => p.name === 'master_prompt' || /^master_prompt(_|$)/.test(p.name))
      setPrompts(masters)
      const active = masters.find((p) => p.is_active === 1) ?? masters[0]
      if (active) {
        setActiveId(active.id)
        setViewingId(active.id)
        setDraft(active.template_text ?? '')
      }
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    } finally {
      setLoading(false)
    }
  }

  // syncStamp ensures we re-fetch AFTER the engine has switched workspace —
  // otherwise we'd see the previous workspace's prompts during the switch race.
  useEffect(() => {
    if (syncStamp > 0) load()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [workspace, syncStamp])

  // Pull the live "what the AI sees" context: sample auto-context block + top
  // tags + top custom fields. This replaces the old hardcoded VARIABLES list
  // that no longer matches reality (the engine auto-injects everything; the
  // master prompt doesn't need {{contact_tags}} or {{contact_full_context}}).
  useEffect(() => {
    if (syncStamp === 0) return
    api<PromptContextResp>('/api/system/prompt-context')
      .then((r) => setCtx(r))
      .catch(() => setCtx(null))
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [workspace, syncStamp])

  // (focus-refresh useEffect lives further down — it references `dirty` which
  // is computed later in the component body)

  const viewing = useMemo(() => prompts.find((p) => p.id === viewingId) ?? null, [prompts, viewingId])
  const active = useMemo(() => prompts.find((p) => p.id === activeId) ?? null, [prompts, activeId])
  const dirty = !!viewing && draft !== (viewing.template_text ?? '')
  const diff = viewing ? diffSummary(viewing.template_text ?? '', draft) : null

  // Sync with the legacy command center at http://76.13.214.35:8080/dashboard.
  // Both UIs hit the same /api/prompts endpoints, so the data IS already in
  // sync — this just re-pulls when the user tabs back, so the version badge
  // doesn't stay stale after edits made in the legacy UI. Skipped if the
  // editor is dirty (don't clobber the user's in-progress changes).
  useEffect(() => {
    const onFocus = () => { if (syncStamp > 0 && !dirty) load() }
    const onVis = () => { if (document.visibilityState === 'visible') onFocus() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [syncStamp, dirty])

  function selectVersion(id: number) {
    setViewingId(id)
    const p = prompts.find((x) => x.id === id)
    setDraft(p?.template_text ?? '')
    requestAnimationFrame(() => taRef.current?.focus())
  }

  async function save() {
    if (!viewing || !dirty) return
    setSaving(true)
    try {
      await api(`/api/prompts/${viewing.id}`, {
        method: 'PUT',
        body: {
          name: viewing.name,
          description: viewing.description ?? '',
          template_text: draft,
        },
      })
      toast.push('Master prompt saved & deployed', 'success')
      load()
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    } finally {
      setSaving(false)
    }
  }

  async function activate(id: number) {
    if (!confirm('Make this version the active prompt? The current active version is preserved as history.')) return
    try {
      await api(`/api/prompts/${id}/activate`, { method: 'POST' })
      toast.push('Activated', 'success')
      load()
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    }
  }

  function discardChanges() {
    if (!viewing) return
    setDraft(viewing.template_text ?? '')
  }

  async function runSimulation() {
    if (!simMessage.trim()) return
    setSimRunning(true)
    setSimResult(null)
    try {
      // Defensive workspace switch — engine is single-active, simulator hits the live prompt
      try {
        await api('/api/workspaces/switch', { method: 'POST', body: { slug: workspace } })
      } catch { /* non-fatal */ }
      // Backend `/api/prompts/test` expects `{messages: [...], contact_name}`
      // (NOT `{message, first_name}` — that shape is silently ignored and the
      // backend falls back to a hardcoded default test message, which made the
      // simulator pretend to test the user's input while actually running
      // against "Tell me more about the opportunity"). Confirmed via direct
      // API probing 2026-05-04.
      const res = await api<SimResult>('/api/prompts/test', {
        method: 'POST',
        body: {
          messages: [{ role: 'user', content: simMessage.trim() }],
          contact_name: simFirstName.trim() || 'Test',
        },
      })
      setSimResult(res)
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    } finally {
      setSimRunning(false)
    }
  }

  // Note: insertAtCursor was used by the old VARIABLES panel. We kept the
  // helper out — the new "What the AI reads" sidebar shows the auto-context
  // preview but doesn't insert anything into the prompt, because users no
  // longer need to add variable placeholders (the engine auto-injects).

  return (
    <div className="space-y-5 max-w-[1500px]">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight flex items-center gap-2">
            <Code2 className="w-5 h-5 text-indigo-400" />
            Master Prompt
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            The system prompt every AI reply is built from. <strong className="text-slate-300">{ws?.name ?? workspace}</strong>
            {active && <> · <Badge tone="indigo">v{active.version}</Badge> active</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="lg"
            iconLeft={<Play className="w-3.5 h-3.5" />}
            onClick={() => setSimOpen(true)}
          >
            Test prompt
          </Button>
          {dirty && (
            <Button variant="ghost" iconLeft={<RotateCcw className="w-3.5 h-3.5" />} onClick={discardChanges}>
              Discard
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            iconLeft={<Save className="w-4 h-4" />}
            disabled={!dirty}
            loading={saving}
            onClick={save}
          >
            Save &amp; deploy
          </Button>
        </div>
      </div>

      <Banner tone="info" title="Write naturally — no variables needed">
        Tags, custom fields, recent inbounds, and contact identity are <strong className="text-slate-200">auto-injected on every Claude call</strong> (see "What the AI reads" sidebar). Just write rules like <em>"if the contact has tag <code className="text-violet-200">contact replied | call</code>, skip them"</em> — the engine already has the data. Saving deploys instantly to the live engine; previous versions are kept as history.
      </Banner>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Editor */}
        <Card flush>
          <div className="px-5 py-3 border-b border-slate-800/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              {viewing && (
                <>
                  <Badge tone={viewing.is_active ? 'emerald' : 'neutral'} dot={!!viewing.is_active}>
                    {viewing.is_active ? `v${viewing.version} active` : `v${viewing.version} archived`}
                  </Badge>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-500 truncate max-w-md">{viewing.name}</span>
                </>
              )}
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums flex items-center gap-3">
              <span>{draft.length.toLocaleString()} chars</span>
              {diff && (
                <span className={cn('flex items-center gap-1', dirty ? 'text-amber-400' : 'text-slate-500')}>
                  <span>+{diff.added}</span>
                  <span>−{diff.removed}</span>
                </span>
              )}
              {!dirty && viewing && <span className="inline-flex items-center gap-1 text-emerald-400"><Check className="w-3 h-3" /> saved</span>}
            </div>
          </div>
          {loading ? (
            <div className="p-5 space-y-2">
              {Array.from({ length: 18 }).map((_, i) => <Skeleton key={i} height={14} className="block w-full" />)}
            </div>
          ) : (
            <textarea
              ref={taRef}
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              spellCheck={false}
              className="block w-full h-[70vh] font-mono text-[12.5px] leading-[1.65] text-slate-200 bg-slate-950/60 px-5 py-4 resize-none focus:outline-none focus:ring-0 placeholder:text-slate-600"
              placeholder="The active master prompt for this workspace will appear here…"
            />
          )}
        </Card>

        {/* Right rail */}
        <div className="space-y-4">
          {/* Versions */}
          <Card flush>
            <div className="px-4 py-3 border-b border-slate-800/60 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" /> Version history
              </div>
              <Badge tone="neutral">{prompts.length}</Badge>
            </div>
            <div className="max-h-[40vh] overflow-y-auto divide-y divide-slate-900/60">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-3 space-y-1.5">
                  <Skeleton height={12} width="50%" />
                  <Skeleton height={11} width="80%" />
                </div>
              ))}
              {!loading && prompts.map((p) => {
                const isViewing = p.id === viewingId
                const isActive = p.id === activeId
                return (
                  <button
                    key={p.id}
                    onClick={() => selectVersion(p.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 transition flex items-start gap-2.5',
                      isViewing ? 'bg-indigo-500/10' : 'hover:bg-slate-900/50',
                    )}
                  >
                    <div className="mt-0.5">
                      {isActive ? (
                        <span className="block w-2 h-2 rounded-full bg-emerald-400 animate-pulse-soft" />
                      ) : (
                        <span className="block w-2 h-2 rounded-full bg-slate-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className={cn('font-medium', isActive ? 'text-emerald-200' : 'text-slate-300')}>
                          v{p.version}
                        </span>
                        {isActive && <Badge tone="emerald" className="!text-[10px] !py-0">active</Badge>}
                        {!isActive && p.name !== 'master_prompt' && <Badge tone="neutral" className="!text-[10px] !py-0">backup</Badge>}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {(p.template_text || '').replace(/\s+/g, ' ').slice(0, 60) || '—'}
                      </div>
                      <div className="text-[10px] text-slate-600 mt-1 flex items-center gap-2">
                        <span>{p.template_text?.length?.toLocaleString() ?? 0} chars</span>
                        <span>·</span>
                        <span>{timeAgo(p.updated_at ?? p.created_at)}</span>
                      </div>
                      {isViewing && !isActive && (
                        <Button
                          size="sm"
                          variant="primary"
                          className="mt-2"
                          onClick={(e) => { e.stopPropagation(); activate(p.id) }}
                        >
                          Make this version active
                        </Button>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Auto-injected context — what the AI actually reads on every call.
              This replaces the old VARIABLES panel because users were adding
              {{contact_tags}} / {{contact_full_context}} placeholders that
              the engine ignores (it auto-injects everything regardless). The
              live preview shows a real contact's context block from this
              workspace so the editor knows exactly what Claude sees. */}
          <Card flush>
            <div className="px-4 py-3 border-b border-slate-800/60 flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-violet-400" /> What the AI reads
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Auto-injected on every call · no variables needed
                </div>
              </div>
              <button
                onClick={() => setShowAutoContext((v) => !v)}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition shrink-0"
                title={showAutoContext ? 'Hide preview' : 'Show preview'}
              >
                {showAutoContext ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {showAutoContext && (
              <div className="p-3">
                {ctx?.auto_context_sample ? (
                  <>
                    <div className="text-[10px] text-slate-600 mb-2 leading-relaxed">
                      Live sample from <strong className="text-slate-400">{ctx.sample_contact?.first_name ?? 'a real contact'}</strong> in this workspace. The prompt-builder runs this on every Claude call.
                    </div>
                    <pre className="text-[11px] leading-relaxed bg-slate-950/60 border border-violet-500/20 rounded-lg p-3 overflow-auto max-h-[320px] text-violet-100/85 whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-mono">
                      {ctx.auto_context_sample}
                    </pre>
                    <div className="text-[10px] text-slate-600 mt-2 leading-relaxed">
                      Just write your prompt naturally — say <em className="text-slate-400">"if the contact has tag X, do not message them"</em> instead of <code className="text-slate-500">{'{{contact_tags}}'}</code>.
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-600 italic">No contacts yet — context preview will populate once leads sync in.</div>
                )}
              </div>
            )}
          </Card>

          {/* Workspace tags — actual tag distribution. Click to copy. */}
          <Card flush>
            <div className="px-4 py-3 border-b border-slate-800/60">
              <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-400" /> Workspace tags
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {ctx ? `${ctx.top_tags.length} unique across ${formatNumber(ctx.total_contacts)} contacts` : '—'} · click to copy
              </div>
            </div>
            <div className="p-2.5 border-b border-slate-800/40">
              <Input
                value={tagSearch}
                onChange={(e) => setTagSearch(e.currentTarget.value)}
                placeholder="Filter tags…"
                iconLeft={<Search className="w-3.5 h-3.5" />}
              />
            </div>
            <div className="p-2 space-y-0.5 max-h-[35vh] overflow-y-auto">
              {!ctx && Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-2.5 py-1.5"><Skeleton height={12} width="80%" /></div>
              ))}
              {ctx && ctx.top_tags
                .filter((t) => !tagSearch || t.tag.toLowerCase().includes(tagSearch.toLowerCase()))
                .map((t) => (
                  <button
                    key={t.tag}
                    onClick={() => { navigator.clipboard.writeText(t.tag); toast.push(`Copied: ${t.tag}`, 'info') }}
                    className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-slate-800/40 transition flex items-center gap-2 group"
                    title="Click to copy"
                  >
                    <Tag className="w-3 h-3 text-slate-600 group-hover:text-indigo-400 shrink-0" />
                    <span className="text-[11px] text-slate-300 truncate flex-1">{t.tag}</span>
                    <span className="text-[10px] text-slate-600 tabular-nums shrink-0">{t.count}</span>
                    <Copy className="w-3 h-3 text-slate-700 group-hover:text-slate-300 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                  </button>
                ))}
              {ctx && ctx.top_tags.length === 0 && (
                <div className="text-[11px] text-slate-600 italic px-2.5 py-2">No tags in this workspace yet.</div>
              )}
            </div>
          </Card>

          {/* Custom fields — what the engine resolves friendly labels for. */}
          {ctx && ctx.top_custom_fields.length > 0 && (
            <Card flush>
              <div className="px-4 py-3 border-b border-slate-800/60">
                <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" /> Custom fields
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {ctx.top_custom_fields.filter((f) => f.mapped).length} mapped · {ctx.top_custom_fields.filter((f) => !f.mapped).length} raw
                </div>
              </div>
              <div className="p-2 space-y-0.5 max-h-[30vh] overflow-y-auto">
                {ctx.top_custom_fields.map((f) => (
                  <button
                    key={f.field_id}
                    onClick={() => { navigator.clipboard.writeText(f.label); toast.push(`Copied: ${f.label}`, 'info') }}
                    className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-slate-800/40 transition group"
                    title="Click to copy field name"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-[11px] font-medium truncate flex-1', f.mapped ? 'text-slate-200' : 'text-slate-500 font-mono text-[10px]')}>
                        {f.label}
                      </span>
                      {!f.mapped && <Badge tone="neutral" className="!text-[9px]">raw id</Badge>}
                    </div>
                    {f.sample_values.length > 0 && (
                      <div className="text-[10px] text-slate-600 mt-0.5 truncate">
                        e.g. {f.sample_values.slice(0, 3).map((v) => `"${v}"`).join(', ')}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Rules detected in YOUR prompt — parses the active draft and
              surfaces IF/THEN clauses, tag references (cross-checked against
              real workspace tags), and stale {{variable}} placeholders that
              can be removed because the engine auto-injects everything. Pure
              client-side parsing; no extra API call. */}
          <RulesDetectedCard draft={draft} ctx={ctx} />

          {/* Hard rules */}
          <Card flush>
            <div className="px-4 py-3 border-b border-slate-800/60">
              <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" /> Hard rules (engine-enforced)
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">These run AFTER the prompt — even if the model violates them, the message is dropped.</div>
            </div>
            <div className="p-3 space-y-2.5">
              {HARD_RULES.map((row) => (
                <div key={row.title} className="text-xs">
                  <div className="text-slate-200 font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" /> {row.title}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed pl-[18px]">{row.d}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Tip" description="Style guidance" action={<Sparkles className="w-4 h-4 text-violet-400" />} />
            <p className="text-[12px] text-slate-400 leading-relaxed">
              The bot has to sound like a real person who walked up to text — never an interface. If you find yourself writing a system instruction in the prompt, move it to <a href="/train-ai" className="text-indigo-300 hover:text-indigo-200">/train-ai</a> instead. Rules there get injected at runtime and survive every prompt redeploy.
            </p>
          </Card>
        </div>
      </div>

      <Modal
        open={simOpen}
        onClose={() => setSimOpen(false)}
        size="xl"
        title={
          <span className="inline-flex items-center gap-2">
            <Play className="w-4 h-4 text-emerald-400" />
            Prompt simulator
            <Badge tone="emerald" className="!text-[10px]">live · uses the active prompt</Badge>
          </span>
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => { setSimResult(null); setSimMessage('') }}>Reset</Button>
            <Button variant="ghost" onClick={() => setSimOpen(false)}>Close</Button>
            <Button
              variant="primary"
              onClick={runSimulation}
              loading={simRunning}
              disabled={!simMessage.trim()}
              iconLeft={<Play className="w-3.5 h-3.5" />}
            >
              Run simulation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="text-[11px] text-slate-500 leading-relaxed border-l-2 border-emerald-500/30 pl-3">
            Simulates a real Claude call against the currently saved active prompt for <strong className="text-slate-300">{ws?.name ?? workspace}</strong>. No SMS is sent. Cost: ~$0.0001 per run (Haiku).
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium block mb-1.5">First name</label>
              <Input
                value={simFirstName}
                onChange={(e) => setSimFirstName(e.currentTarget.value)}
                placeholder="Test"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium block mb-1.5">Inbound message from lead</label>
              <Textarea
                value={simMessage}
                onChange={(e) => setSimMessage(e.currentTarget.value)}
                rows={3}
                placeholder={`e.g. "yeah it's for my mom, she needs help now"`}
              />
            </div>
          </div>

          {simResult && <SimResultView result={simResult} />}
          {simRunning && !simResult && (
            <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-5 flex items-center gap-3 text-sm text-slate-400">
              <span className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              Calling Claude…
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

interface SimResult {
  response: string
  rsvp?: string
  escalation?: boolean
  raw?: string
  model?: string
  promptTokens?: number
  completionTokens?: number
  tokens?: number
  processingTimeMs?: number
}

function SimResultView({ result }: { result: SimResult }) {
  // Anthropic Haiku: $1/M input, $5/M output (matches /api/analytics/dashboard tokenUsage)
  const inputCost = ((result.promptTokens ?? 0) * 1) / 1_000_000
  const outputCost = ((result.completionTokens ?? 0) * 5) / 1_000_000
  const totalCost = inputCost + outputCost
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-emerald-400 font-medium mb-2">
          <ArrowRight className="w-3 h-3" />
          AI reply (what the lead would receive)
        </div>
        <div className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">
          {result.response || <span className="italic text-slate-500">(empty)</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Latency" value={result.processingTimeMs ? `${(result.processingTimeMs / 1000).toFixed(2)}s` : '—'} icon={Zap} />
        <Metric label="Total tokens" value={formatNumber(result.tokens ?? 0)} icon={Cpu} />
        <Metric label="Cost" value={`$${totalCost.toFixed(5)}`} icon={Sparkles} />
        <Metric label="Model" value={<code className="text-[11px]">{result.model?.replace('claude-', '') ?? '—'}</code>} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium mb-1">Prompt tokens (in)</div>
          <div className="text-slate-100 tabular-nums">{formatNumber(result.promptTokens ?? 0)}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium mb-1">Completion tokens (out)</div>
          <div className="text-slate-100 tabular-nums">{formatNumber(result.completionTokens ?? 0)}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium mb-1">Engine flags</div>
          <div className="flex gap-1.5 flex-wrap">
            {result.rsvp && <Badge tone={result.rsvp === 'YES' ? 'emerald' : 'neutral'}>RSVP {result.rsvp}</Badge>}
            {result.escalation && <Badge tone="amber">escalation</Badge>}
            {!result.rsvp && !result.escalation && <span className="text-slate-600 text-[11px]">none</span>}
          </div>
        </div>
      </div>

      {result.raw && (
        <details className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-2.5">
          <summary className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium cursor-pointer">Raw model output</summary>
          <pre className="text-[11px] text-slate-400 mt-2 overflow-auto max-h-48 whitespace-pre-wrap">{result.raw}</pre>
        </details>
      )}
    </div>
  )
}

/* ========== Rules detection ==========
 * Parses the live prompt draft to surface what the user has written, in
 * structured form. Three sections: tag references (matched / unmatched),
 * IF/THEN clauses, and stale variable placeholders.
 */
interface DetectedRule {
  kind: 'if_then' | 'arrow' | 'when'
  text: string
  line?: number
}
interface DetectedTag {
  raw: string
  matchedTag?: { tag: string; count: number }
  suggestion?: string
}
interface StaleVar {
  v: string
  line: number
}

function detectTagReferences(draft: string, allTags: Array<{ tag: string; count: number }>): DetectedTag[] {
  const out: DetectedTag[] = []
  const seen = new Set<string>()
  // Three patterns: double-quoted, backtick-wrapped, word|word|word literals
  const patterns = [
    /"([a-z0-9][a-z0-9 _\-|]{2,80}[a-z0-9])"/gi,            // "tag name"
    /`([a-z0-9][a-z0-9 _\-|]{2,80}[a-z0-9])`/gi,            // `tag name`
    /\b([a-z][a-z0-9_]{1,30}\s*\|\s*[a-z][a-z0-9 _\-|]{0,80})\b/gi,  // word | word | …
  ]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(draft)) !== null) {
      const candidate = m[1].trim().toLowerCase()
      if (!candidate || seen.has(candidate)) continue
      // Skip obvious non-tag matches (English sentences in quotes)
      if (candidate.split(' ').length > 12) continue
      if (/^(yes|no|maybe|skip|stop|hi|hey|hello|thanks)\b/i.test(candidate)) continue
      seen.add(candidate)
      // Match against workspace tags case-insensitively
      const matched = allTags.find((t) => t.tag.toLowerCase() === candidate)
      if (matched) {
        out.push({ raw: m[1].trim(), matchedTag: matched })
        continue
      }
      // Fuzzy: find a close match (token-level overlap >= 70%)
      const candTokens = candidate.split(/\s*\|\s*|\s+/).filter(Boolean)
      let bestSuggestion: { tag: string; score: number } | null = null
      for (const t of allTags) {
        const tagTokens = t.tag.toLowerCase().split(/\s*\|\s*|\s+/).filter(Boolean)
        const overlap = candTokens.filter((c) => tagTokens.some((tt) => tt.includes(c) || c.includes(tt))).length
        const score = overlap / Math.max(candTokens.length, tagTokens.length)
        if (score >= 0.7 && (!bestSuggestion || score > bestSuggestion.score)) {
          bestSuggestion = { tag: t.tag, score }
        }
      }
      out.push({ raw: m[1].trim(), suggestion: bestSuggestion?.tag })
    }
  }
  return out
}

function detectIfThenRules(draft: string): DetectedRule[] {
  const out: DetectedRule[] = []
  const seen = new Set<string>()
  const lines = draft.split('\n')
  // Patterns:
  //  - "IF X THEN Y" / "IF: X THEN: Y" (any case)
  //  - "if X, then Y" (sentence form)
  //  - "X → Y" (arrow)
  //  - "when X, Y"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) continue

    const ifThen = trimmed.match(/(?:^|\b)IF[:\s]+(.+?)\s+THEN[:\s]+(.+?)$/i)
    if (ifThen) {
      const text = `IF ${ifThen[1].trim()} → ${ifThen[2].trim()}`
      if (!seen.has(text)) { seen.add(text); out.push({ kind: 'if_then', text, line: i + 1 }) }
      continue
    }

    const ifSentence = trimmed.match(/^if\s+(.+?),\s+(?:then\s+)?(.+?)\.?$/i)
    if (ifSentence && trimmed.length < 250) {
      const text = `if ${ifSentence[1].trim()} → ${ifSentence[2].trim()}`
      if (!seen.has(text)) { seen.add(text); out.push({ kind: 'if_then', text, line: i + 1 }) }
      continue
    }

    const whenForm = trimmed.match(/^when\s+(.+?),\s+(.+?)\.?$/i)
    if (whenForm && trimmed.length < 250) {
      const text = `when ${whenForm[1].trim()} → ${whenForm[2].trim()}`
      if (!seen.has(text)) { seen.add(text); out.push({ kind: 'when', text, line: i + 1 }) }
      continue
    }

    // Arrow notation — but only if it's clearly a rule (short, has subject+verb)
    const arrow = trimmed.match(/^(.{5,80})\s+→\s+(.{5,200})$/)
    if (arrow) {
      const text = `${arrow[1].trim()} → ${arrow[2].trim()}`
      if (!seen.has(text)) { seen.add(text); out.push({ kind: 'arrow', text, line: i + 1 }) }
    }
  }
  return out
}

function detectStaleVars(draft: string): StaleVar[] {
  const out: StaleVar[] = []
  const lines = draft.split('\n')
  const re = /\{\{[^}]+\}\}/g
  for (let i = 0; i < lines.length; i++) {
    let m: RegExpExecArray | null
    while ((m = re.exec(lines[i])) !== null) {
      out.push({ v: m[0], line: i + 1 })
    }
  }
  return out
}

function RulesDetectedCard({ draft, ctx }: { draft: string; ctx: PromptContextResp | null }) {
  const tags = useMemo(() => detectTagReferences(draft, ctx?.top_tags ?? []), [draft, ctx?.top_tags])
  const rules = useMemo(() => detectIfThenRules(draft), [draft])
  const stale = useMemo(() => detectStaleVars(draft), [draft])

  const matchedTags = tags.filter((t) => t.matchedTag)
  const unmatchedTags = tags.filter((t) => !t.matchedTag)
  const total = matchedTags.length + unmatchedTags.length + rules.length + stale.length

  if (total === 0) {
    return (
      <Card flush>
        <div className="px-4 py-3 border-b border-slate-800/60">
          <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" /> Rules in your prompt
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Auto-detects tag refs, IF/THEN clauses, stale variables</div>
        </div>
        <div className="p-4 text-[11px] text-slate-600 italic leading-relaxed">
          Nothing to surface yet. Try writing a rule like:<br />
          <code className="text-violet-200">if a contact has tag "contact replied | call", skip them.</code>
        </div>
      </Card>
    )
  }

  return (
    <Card flush>
      <div className="px-4 py-3 border-b border-slate-800/60 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" /> Rules in your prompt
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Live parse · updates as you type</div>
        </div>
        <Badge tone="violet">{total}</Badge>
      </div>

      <div className="p-3 space-y-3">
        {matchedTags.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-400/80 font-medium mb-1.5 flex items-center gap-1.5">
              <Check className="w-3 h-3" /> Tag refs · matched ({matchedTags.length})
            </div>
            <div className="space-y-1">
              {matchedTags.map((t, i) => (
                <div key={i} className="text-[11px] flex items-center gap-2 px-2 py-1 rounded border border-emerald-500/20 bg-emerald-500/5">
                  <Tag className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="text-emerald-100 truncate flex-1">{t.raw}</span>
                  <span className="text-[10px] text-slate-500 tabular-nums shrink-0">{t.matchedTag!.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {unmatchedTags.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-amber-400/80 font-medium mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" /> Tag refs · no contacts have this ({unmatchedTags.length})
            </div>
            <div className="space-y-1">
              {unmatchedTags.map((t, i) => (
                <div key={i} className="text-[11px] px-2 py-1 rounded border border-amber-500/20 bg-amber-500/5">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="text-amber-100 truncate flex-1">{t.raw}</span>
                  </div>
                  {t.suggestion && (
                    <div className="text-[10px] text-amber-200/70 mt-0.5 pl-5">
                      did you mean <code className="text-amber-100">{t.suggestion}</code>?
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {rules.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-indigo-400/80 font-medium mb-1.5 flex items-center gap-1.5">
              <ArrowRight className="w-3 h-3" /> Conditional rules ({rules.length})
            </div>
            <div className="space-y-1">
              {rules.map((r, i) => (
                <div key={i} className="text-[11px] px-2 py-1 rounded border border-indigo-500/20 bg-indigo-500/5 text-indigo-100/90">
                  <span className="text-slate-600 mr-1">L{r.line}</span>
                  {r.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {stale.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium mb-1.5 flex items-center gap-1.5">
              <RotateCcw className="w-3 h-3" /> Stale placeholders ({stale.length})
            </div>
            <div className="space-y-1">
              {stale.map((s, i) => (
                <div key={i} className="text-[11px] px-2 py-1 rounded border border-slate-800 bg-slate-950/40 text-slate-500 flex items-center gap-2">
                  <span className="text-slate-700 tabular-nums shrink-0">L{s.line}</span>
                  <code className="text-slate-400 truncate flex-1">{s.v}</code>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-slate-600 mt-1.5 leading-relaxed pl-1">
              These were the old-style variable placeholders. The engine now auto-injects all this — you can remove them without breaking anything.
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

function Metric({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium mb-1 flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}{label}
      </div>
      <div className="text-base font-semibold text-slate-100 tabular-nums">{value}</div>
    </div>
  )
}
