import { useEffect, useState } from 'react'
import { Plus, Sparkles, Trash2, Power, BookOpen } from 'lucide-react'
import Card, { CardHeader } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input, { Textarea } from '../components/ui/Input'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { api } from '../lib/api'
import { useWorkspace } from '../lib/workspace'
import { useToast } from '../lib/toast'
import { timeAgo } from '../lib/format'
import type { FeedbackRule } from '../lib/types'

const CATEGORIES = ['response_style', 'follow_up', 'objection', 'escalation', 'tagging', 'general'] as const

export default function TrainAI() {
  const { current: workspace, syncStamp } = useWorkspace()
  const toast = useToast()
  const [rules, setRules] = useState<FeedbackRule[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [trigger, setTrigger] = useState('')
  const [action, setAction] = useState('')
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('response_style')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      // Defensive workspace switch — feedback_rules lives per-workspace
      try {
        await api('/api/workspaces/switch', { method: 'POST', body: { slug: workspace } })
      } catch { /* non-fatal */ }
      type R = { rules: FeedbackRule[] }
      const res = await api<R>('/api/feedback-rules')
      setRules(res.rules ?? [])
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (syncStamp > 0) load()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [workspace, syncStamp])

  async function save() {
    if (!trigger.trim() || !action.trim()) return
    setSaving(true)
    try {
      await api('/api/feedback-rules', {
        method: 'POST',
        body: { trigger_condition: trigger.trim(), action_instruction: action.trim(), category },
      })
      toast.push('Rule added', 'success')
      setOpen(false)
      setTrigger('')
      setAction('')
      load()
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    } finally {
      setSaving(false)
    }
  }

  async function toggle(id: number) {
    try {
      await api(`/api/feedback-rules/${id}/toggle`, { method: 'POST' })
      load()
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this rule? This cannot be undone.')) return
    try {
      await api(`/api/feedback-rules/${id}`, { method: 'DELETE' })
      toast.push('Rule deleted', 'success')
      load()
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Train AI</h1>
          <p className="text-sm text-slate-500 mt-1">
            Rules added here are injected into every prompt as <code className="text-indigo-300 text-xs">LEARNED RULES</code>. They survive every prompt redeploy.
          </p>
        </div>
        <Button variant="primary" iconLeft={<Plus className="w-3.5 h-3.5" />} onClick={() => setOpen(true)}>
          New rule
        </Button>
      </div>

      <Card flush>
        <div className="px-5 py-4 border-b border-slate-800/60">
          <CardHeader
            title="Active rules"
            description="The model reads these on every reply. Disable instead of delete if you might want them back."
            action={<Badge tone="indigo">{rules.filter((r) => r.is_active).length} active · {rules.length} total</Badge>}
            className="!mb-0"
          />
        </div>
        <div className="divide-y divide-slate-900/60">
          {loading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-5 space-y-2">
              <Skeleton height={12} width="20%" />
              <Skeleton height={14} width="80%" />
              <Skeleton height={14} width="60%" />
            </div>
          ))}

          {!loading && rules.length === 0 && (
            <EmptyState icon={Sparkles} title="No rules yet" description="Add your first rule — e.g. 'When a lead asks who it's for, confirm using their tag instead of asking.'" />
          )}

          {rules.map((r) => (
            <div key={r.id} className={`p-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 ${r.is_active ? '' : 'opacity-50'}`}>
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2">
                  {r.category && <Badge tone="violet">{r.category}</Badge>}
                  {r.is_active ? <Badge tone="emerald" dot>active</Badge> : <Badge tone="neutral">disabled</Badge>}
                  <span className="text-[10px] text-slate-600">{timeAgo(r.created_at)}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-400 font-medium mt-0.5 shrink-0">If</span>
                    <p className="text-sm text-slate-200 leading-relaxed">{r.trigger_condition}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-indigo-400 font-medium mt-0.5 shrink-0">Then</span>
                    <p className="text-sm text-slate-200 leading-relaxed">{r.action_instruction}</p>
                  </div>
                  {r.context_example && (
                    <div className="text-[11px] text-slate-500 italic mt-1 pl-7 border-l border-slate-800 ml-1">
                      Example: {r.context_example}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex md:flex-col items-start gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => toggle(r.id)} iconLeft={<Power className="w-3.5 h-3.5" />}>
                  {r.is_active ? 'Disable' : 'Enable'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => remove(r.id)} iconLeft={<Trash2 className="w-3.5 h-3.5" />}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="How rules become prompt context" description="prompt-builder.js · runtime injection" action={<BookOpen className="w-4 h-4 text-slate-500" />} />
        <pre className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/60 border border-slate-800/60 rounded-lg p-3 overflow-auto">
{`LEARNED RULES (from team feedback):
  1. IF: <trigger>  →  THEN: <action>
  2. IF: <trigger>  →  THEN: <action>
  …`}
        </pre>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New training rule"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={!trigger.trim() || !action.trim()}>
              Save rule
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium block mb-1.5">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition border ${
                    category === c
                      ? 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border-transparent'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium block mb-1.5">When (trigger)</label>
            <Input value={trigger} onChange={(e) => setTrigger(e.currentTarget.value)} placeholder="e.g. Lead asks who the program is for and we have hhc | self tag" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium block mb-1.5">Then (action)</label>
            <Textarea value={action} onChange={(e) => setAction(e.currentTarget.value)} rows={4} placeholder="e.g. Confirm naturally that it's for them and ask them to call (330) 587-9558." />
          </div>
        </div>
      </Modal>
    </div>
  )
}
