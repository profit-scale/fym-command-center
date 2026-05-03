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
  days?: number[]
}

export default function Settings() {
  const { current: workspace, syncStamp } = useWorkspace()
  const toast = useToast()
  const [tab, setTab] = useState<TabId>('general')
  const [config, setConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await api<Record<string, string>>(`/api/admin/config/${encodeURIComponent(workspace)}`)
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

  async function patch(key: string, value: string | number | boolean | object) {
    setSaving(key)
    try {
      await api(`/api/admin/config/${encodeURIComponent(workspace)}`, {
        method: 'PATCH',
        body: { key, value: typeof value === 'string' ? value : JSON.stringify(value) },
      })
      toast.push(`Saved · ${key}`, 'success')
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
              />
              <Field
                label="Business hours (hard rule)"
                value={`${bizHours.start_hour ?? 9}:00 – ${bizHours.end_hour ?? 18}:00 · days ${(bizHours.days ?? [1,2,3,4,5]).join(',')} · ${bizHours.enabled === false ? 'OFF' : 'ON'}`}
                hint="Follow-ups never go out outside these hours in the contact's local timezone."
                action={
                  <Button
                    size="sm"
                    onClick={() => patch('follow_up_business_hours', { enabled: !(bizHours.enabled === false), start_hour: bizHours.start_hour ?? 9, end_hour: bizHours.end_hour ?? 18, days: bizHours.days ?? [1,2,3,4,5] })}
                  >
                    {bizHours.enabled === false ? 'Enable' : 'Disable'}
                  </Button>
                }
              />
              <Field
                label="Min hours between messages"
                value={(() => {
                  try {
                    const cfg = JSON.parse(config.prompt_follow_up_config ?? '{}')
                    return String(cfg.minHoursBetweenMessages ?? 4)
                  } catch { return '—' }
                })()}
                hint="Throttle the cadence so leads don't feel spammed."
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
