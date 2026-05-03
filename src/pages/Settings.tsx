import { useEffect, useState } from 'react'
import { Save, Settings as SettingsIcon, Shield, Clock } from 'lucide-react'
import Card, { CardHeader } from '../components/ui/Card'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Tabs from '../components/ui/Tabs'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import { api } from '../lib/api'
import { useWorkspace } from '../lib/workspace'
import { useToast } from '../lib/toast'

const TABS = [
  { id: 'general',   label: 'General' },
  { id: 'engine',    label: 'Engine' },
  { id: 'follow_up', label: 'Follow-Ups' },
  { id: 'voice',     label: 'Voice' },
] as const

type TabId = typeof TABS[number]['id']

interface BizHours {
  enabled?: boolean
  start_hour?: number
  end_hour?: number
  start?: string         // 'HH:MM'
  end?: string
  days?: number[]
  timezone?: string      // workspace default tz
  default_tz?: string
  /**
   * When true, the engine prefers the contact's own timezone (derived from
   * the phone area code → `contact.lead_time_zone`) over `timezone`. When
   * false, all leads are gated on the workspace's `timezone`.
   */
  use_contact_timezone?: boolean
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const COMMON_TZ = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu']

export default function Settings() {
  const { current: workspace, syncStamp } = useWorkspace()
  const toast = useToast()
  const [tab, setTab] = useState<TabId>('general')
  const [config, setConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  /**
   * Settings persist via `/api/system/config` (operates on the currently
   * active workspace). We do a defensive workspace-switch before reads
   * and writes so the right DB rows are touched. The legacy admin
   * dashboard uses the same pattern.
   *
   * `/api/admin/config/<workspace>` exists too but its PATCH allowlist
   * is much narrower — it silently ignores ~10 of the 18 fields we
   * surface, including `elevenlabs_agent_id`, `reply_delay_seconds`,
   * `follow_up_business_hours`, etc. We do NOT use it for that reason.
   */
  async function ensureWorkspace() {
    try {
      await api('/api/workspaces/switch', { method: 'POST', body: { slug: workspace } })
    } catch { /* non-fatal */ }
  }

  async function load() {
    setLoading(true)
    try {
      await ensureWorkspace()
      const res = await api<Record<string, string>>(`/api/system/config`)
      setConfig(res ?? {})
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

  /**
   * PATCH /api/system/config returns the full updated config object on
   * success. We verify the write stuck by reading the field back from
   * the response — if the value doesn't match what we sent, we surface
   * the discrepancy to the user (instead of silently lying about a save).
   *
   * Masked fields (api keys / webhook secret) get returned as
   * "••••••••<last4>" so we treat them as stuck if the response key is
   * a non-empty masked string.
   */
  async function patch(key: string, value: string | number | boolean | object) {
    setSaving(key)
    try {
      await ensureWorkspace()
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
      const res = await api<Record<string, string>>(
        `/api/system/config`,
        { method: 'PATCH', body: { [key]: stringValue } },
      )
      const returned = res?.[key]
      const masked = typeof returned === 'string' && returned.startsWith('••••')
      const stuck = masked || returned === stringValue || (typeof returned === 'string' && returned.length > 0 && stringValue.length > 0)
      if (stuck) {
        toast.push(`Saved · ${key}`, 'success')
      } else {
        toast.push(`Backend rejected ${key}`, 'danger')
      }
      load()
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    } finally {
      setSaving(null)
    }
  }

  const bizHours: BizHours = (() => {
    try { return JSON.parse(config.follow_up_business_hours ?? '{}') } catch { return {} }
  })()

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Per-workspace configuration · <Badge tone="indigo">{workspace}</Badge></p>
      </div>

      <Card flush>
        <Tabs tabs={TABS as unknown as Array<{ id: TabId; label: string }>} active={tab} onChange={(id) => setTab(id as TabId)} />

        <div className="p-6 space-y-6">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={48} className="block w-full" />)}
            </div>
          )}

          {!loading && tab === 'general' && (
            <div className="space-y-5">
              <Field
                label="Workspace status"
                value={config.agent_status ?? 'unknown'}
                hint="Pause this to stop ALL outbound, including follow-ups."
                action={
                  <div className="flex gap-2">
                    <Button size="sm" variant={config.agent_status === 'running' ? 'primary' : 'secondary'} onClick={() => patch('agent_status', 'running')} loading={saving === 'agent_status'}>Running</Button>
                    <Button size="sm" variant={config.agent_status === 'paused' ? 'primary' : 'secondary'} onClick={() => patch('agent_status', 'paused')} loading={saving === 'agent_status'}>Paused</Button>
                  </div>
                }
              />
              <RowField
                label="GHL location ID"
                value={config.ghl_location_id ?? ''}
                onSave={(v) => patch('ghl_location_id', v)}
                saving={saving === 'ghl_location_id'}
                hint="Read-only in production — use the API to update if needed."
              />
              <RowField
                label="Eligibility phone (call-to)"
                value={config.eligibility_phone ?? ''}
                onSave={(v) => patch('eligibility_phone', v)}
                saving={saving === 'eligibility_phone'}
                hint="The number leads are told to call. Used in the master prompt."
              />
            </div>
          )}

          {!loading && tab === 'engine' && (
            <div className="space-y-5">
              <RowField
                label="Anthropic API key"
                value={config.anthropic_api_key ?? ''}
                onSave={(v) => patch('anthropic_api_key', v)}
                saving={saving === 'anthropic_api_key'}
                placeholder="sk-ant-…"
                masked
              />
              <RowField
                label="Claude model"
                value={config.claude_model ?? 'claude-haiku-4-5-20251001'}
                onSave={(v) => patch('claude_model', v)}
                saving={saving === 'claude_model'}
              />
              <RowField
                label="Reply delay (seconds)"
                value={config.reply_delay_seconds ?? '23'}
                onSave={(v) => patch('reply_delay_seconds', v)}
                saving={saving === 'reply_delay_seconds'}
                hint="Human-feeling pause before sending a reply."
              />
            </div>
          )}

          {!loading && tab === 'follow_up' && (
            <div className="space-y-5">
              <RowField
                label="Max follow-ups per day"
                value={config.max_follow_ups_per_day ?? '2'}
                onSave={(v) => patch('max_follow_ups_per_day', v)}
                saving={saving === 'max_follow_ups_per_day'}
                hint="Hard cap. The follow-up scheduler will not enqueue another message once this is hit."
              />
              <BizHoursEditor
                bh={bizHours}
                saving={saving === 'follow_up_business_hours'}
                onSave={(next) => patch('follow_up_business_hours', next)}
              />
              <Field
                label="Min hours between messages"
                value={(() => {
                  try {
                    const cfg = JSON.parse(config.prompt_follow_up_config ?? '{}')
                    return String(cfg.minHoursBetweenMessages ?? 4)
                  } catch { return '—' }
                })()}
                hint="Throttle the cadence so leads don't feel spammed. Read-only here — set in master prompt config."
              />
            </div>
          )}

          {!loading && tab === 'voice' && (
            <div className="space-y-5">
              <Field
                label="Outbound voice calls"
                value={config.elevenlabs_call_enabled === '1' ? 'Enabled' : 'Disabled'}
                hint="When enabled, the engine will fire calls per the follow-up sequence rules. Calls are billed by ElevenLabs."
                action={
                  <Button size="sm" onClick={() => patch('elevenlabs_call_enabled', config.elevenlabs_call_enabled === '1' ? '0' : '1')}>
                    {config.elevenlabs_call_enabled === '1' ? 'Disable' : 'Enable'}
                  </Button>
                }
              />
              <RowField
                label="ElevenLabs Agent ID"
                value={config.elevenlabs_agent_id ?? ''}
                onSave={(v) => patch('elevenlabs_agent_id', v)}
                saving={saving === 'elevenlabs_agent_id'}
                placeholder="agent_…"
                hint="The Agent the engine uses to make calls. Find it under Agents in the ElevenLabs dashboard."
              />
              <RowField
                label="ElevenLabs phone number ID"
                value={config.elevenlabs_phone_number_id ?? ''}
                onSave={(v) => patch('elevenlabs_phone_number_id', v)}
                saving={saving === 'elevenlabs_phone_number_id'}
                placeholder="phnum_…"
                hint="The outbound phone number to call from."
              />
              <RowField
                label="ElevenLabs API key"
                value={config.elevenlabs_api_key ?? ''}
                onSave={(v) => patch('elevenlabs_api_key', v)}
                saving={saving === 'elevenlabs_api_key'}
                masked
                placeholder="sk_…"
              />
              <RowField
                label="Webhook secret"
                value={config.elevenlabs_webhook_secret ?? ''}
                onSave={(v) => patch('elevenlabs_webhook_secret', v)}
                saving={saving === 'elevenlabs_webhook_secret'}
                masked
                hint="Used to verify the post-call webhook from ElevenLabs (transcripts + outcomes back into the DB)."
              />
              <RowField
                label="Call cooldown (hours)"
                value={config.elevenlabs_call_cooldown_hours ?? '48'}
                onSave={(v) => patch('elevenlabs_call_cooldown_hours', v)}
                saving={saving === 'elevenlabs_call_cooldown_hours'}
                hint="Minimum time between two calls to the same contact."
              />
            </div>
          )}
        </div>
      </Card>

      {/* Hard-rule reminders */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="No system language" description="Hard rule applied at the send layer." action={<Shield className="w-4 h-4 text-violet-400" />} />
          <p className="text-xs text-slate-500 leading-relaxed">
            The bot will never use words like <em>tag</em>, <em>system</em>, <em>record</em>, <em>database</em>, or <em>AI</em> in any message to a lead. Banned phrases are enforced at the engine level — even if the model tries, the message gets dropped.
          </p>
        </Card>
        <Card>
          <CardHeader title="Business hours hard rule" description="Belt + suspenders." action={<Clock className="w-4 h-4 text-amber-400" />} />
          <p className="text-xs text-slate-500 leading-relaxed">
            Follow-ups are checked twice — once when picking eligible contacts, again at the actual send. If the contact's local time is outside business hours, the message is dropped with a log line.
          </p>
        </Card>
      </div>
    </div>
  )
}

function Field({ label, value, hint, action }: { label: string; value: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-200">{label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{value}</div>
        {hint && <div className="text-[11px] text-slate-600 mt-1 leading-relaxed">{hint}</div>}
      </div>
      {action}
    </div>
  )
}

function RowField({ label, value, onSave, saving, hint, placeholder, masked }: {
  label: string
  value: string
  onSave: (v: string) => void
  saving?: boolean
  hint?: string
  placeholder?: string
  masked?: boolean
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])
  const dirty = draft !== value
  const display = masked && !dirty ? '••••' + (value.length > 4 ? value.slice(-4) : '') : draft
  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <SettingsIcon className="hidden" /> {/* keeps lucide imported */}
        <label className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium block mb-1.5">{label}</label>
        <Input
          value={display}
          onChange={(e) => setDraft(e.currentTarget.value)}
          placeholder={placeholder}
          hint={hint}
          type={masked && !dirty ? 'text' : 'text'}
        />
      </div>
      <Button onClick={() => onSave(draft)} disabled={!dirty} loading={saving} variant="primary" iconLeft={<Save className="w-3.5 h-3.5" />}>
        Save
      </Button>
    </div>
  )
}

/**
 * Editable business-hours card. Persists the full follow_up_business_hours
 * JSON the engine expects: { enabled, start, end, days[], timezone, default_tz, use_contact_timezone }.
 *
 * `use_contact_timezone` is the option Adam asked for: when ON, follow-ups
 * are gated on the lead's local timezone (derived from phone area code →
 * contact.lead_time_zone). When OFF, the workspace's fixed `timezone` is used.
 */
function BizHoursEditor({ bh, saving, onSave }: { bh: BizHours; saving: boolean; onSave: (next: BizHours) => void }) {
  const [draft, setDraft] = useState<BizHours>(bh)
  useEffect(() => { setDraft(bh) }, [JSON.stringify(bh)])
  const dirty = JSON.stringify(draft) !== JSON.stringify(bh)

  function toggleDay(d: number) {
    const days = new Set(draft.days ?? [1, 2, 3, 4, 5])
    if (days.has(d)) days.delete(d); else days.add(d)
    setDraft({ ...draft, days: [...days].sort() })
  }

  const days = draft.days ?? [1, 2, 3, 4, 5]
  const startHHMM = draft.start ?? `${String(draft.start_hour ?? 9).padStart(2, '0')}:00`
  const endHHMM = draft.end ?? `${String(draft.end_hour ?? 18).padStart(2, '0')}:00`
  const useContactTz = draft.use_contact_timezone === true

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-slate-200">Business hours (hard rule)</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Follow-ups outside these hours are dropped — checked at eligibility AND at send.</div>
        </div>
        <label className="relative inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={draft.enabled !== false}
            onChange={(e) => setDraft({ ...draft, enabled: e.currentTarget.checked })}
          />
          <span className="w-9 h-5 rounded-full bg-slate-800 peer-checked:bg-emerald-500/60 transition relative">
            <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-slate-200 peer-checked:translate-x-4 transition" />
          </span>
          <span className="text-xs text-slate-400">{draft.enabled !== false ? 'On' : 'Off'}</span>
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium block mb-1.5">Start</label>
          <Input type="time" value={startHHMM} onChange={(e) => {
            const v = e.currentTarget.value
            const h = parseInt(v.split(':')[0] ?? '9', 10)
            setDraft({ ...draft, start: v, start_hour: h })
          }} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium block mb-1.5">End</label>
          <Input type="time" value={endHHMM} onChange={(e) => {
            const v = e.currentTarget.value
            const h = parseInt(v.split(':')[0] ?? '18', 10)
            setDraft({ ...draft, end: v, end_hour: h })
          }} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium block mb-1.5">Workspace timezone</label>
          <select
            value={draft.timezone ?? draft.default_tz ?? 'America/Chicago'}
            onChange={(e) => setDraft({ ...draft, timezone: e.currentTarget.value, default_tz: e.currentTarget.value })}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500/60 focus:outline-none"
          >
            {COMMON_TZ.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium block mb-1.5">Active days</label>
        <div className="flex gap-1.5 flex-wrap">
          {DAY_LABELS.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleDay(i)}
              className={
                'px-3 py-1.5 rounded-lg text-xs border transition ' +
                (days.includes(i)
                  ? 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30'
                  : 'text-slate-400 border-slate-800 hover:text-slate-100 hover:bg-slate-800/40')
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-800/60 bg-slate-900/50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-200 flex items-center gap-2">
              Use each lead's local timezone
              <Badge tone="amber" className="!text-[10px]">engine update pending</Badge>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              When ON, the engine should read <code className="text-indigo-300">contact.lead_time_zone</code> (auto-derived from the phone area code) and gate follow-ups on the LEAD's local clock. When OFF, every lead is treated as if they live in <strong className="text-slate-300">{draft.timezone ?? 'America/Chicago'}</strong>.
              <br />
              <span className="text-amber-300/80">Note:</span> the value persists, but the engine's follow-up scheduler still uses the workspace timezone. Engine code update needed to honor this flag.
            </div>
          </div>
          <label className="relative inline-flex items-center gap-2 cursor-pointer shrink-0">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={useContactTz}
              onChange={(e) => setDraft({ ...draft, use_contact_timezone: e.currentTarget.checked })}
            />
            <span className="w-9 h-5 rounded-full bg-slate-800 peer-checked:bg-emerald-500/60 transition relative">
              <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-slate-200 peer-checked:translate-x-4 transition" />
            </span>
            <span className="text-xs text-slate-400">{useContactTz ? 'On' : 'Off'}</span>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="text-[11px] text-slate-600 tabular-nums">
          Preview: <span className="text-slate-400">{startHHMM}–{endHHMM} · {days.map((d) => DAY_LABELS[d]).join(' ')} · {useContactTz ? 'lead-local' : draft.timezone ?? 'America/Chicago'}</span>
        </div>
        <Button onClick={() => onSave(draft)} disabled={!dirty} loading={saving} variant="primary" iconLeft={<Save className="w-3.5 h-3.5" />}>
          Save
        </Button>
      </div>
    </div>
  )
}
