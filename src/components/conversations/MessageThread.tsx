import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, Phone, Mail, GraduationCap, Pause, Play, PhoneCall, MessageSquare, Inbox } from 'lucide-react'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import Skeleton from '../ui/Skeleton'
import EmptyState from '../ui/EmptyState'
import MessageBubble from './MessageBubble'
import { Textarea } from '../ui/Input'
import { cn, formatPhone } from '../../lib/format'
import type { Contact, Message } from '../../lib/types'

interface Props {
  contact: Contact | null
  messages: Message[]
  loading: boolean
  onSend: (text: string) => Promise<void>
  onTrainAI: () => void
  onTogglePause: () => void
  onVoiceCall: () => Promise<void> | void
  paused: boolean
  voiceEnabled?: boolean
}

type ChannelFilter = 'all' | 'sms' | 'email' | 'voice'

export default function MessageThread({ contact, messages, loading, onSend, onTrainAI, onTogglePause, onVoiceCall, paused, voiceEnabled }: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [calling, setCalling] = useState(false)
  const [channel, setChannel] = useState<ChannelFilter>('all')
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length])

  // Channel-aware buckets so the filter chips can show counts AND we never
  // walk the message array more than once per render. Voice events
  // (VOICE_CALL/CALL_ENDED) are bucketed together; emails are their own.
  const buckets = useMemo(() => {
    const out = { sms: 0, email: 0, voice: 0 }
    for (const m of messages) {
      const t = m.message_type
      if (t === 'Email') out.email++
      else if (t === 'VOICE_CALL' || t === 'CALL_ENDED') out.voice++
      else out.sms++
    }
    return out
  }, [messages])

  const filteredMessages = useMemo(() => {
    if (channel === 'all') return messages
    return messages.filter((m) => {
      const t = m.message_type
      if (channel === 'email') return t === 'Email'
      if (channel === 'voice') return t === 'VOICE_CALL' || t === 'CALL_ENDED'
      // 'sms' covers explicit SMS + legacy/null types — anything that isn't email or voice
      return t !== 'Email' && t !== 'VOICE_CALL' && t !== 'CALL_ENDED'
    })
  }, [channel, messages])

  // Reset filter when switching contacts to avoid empty views.
  useEffect(() => { setChannel('all') }, [contact?.id])

  async function handleSend() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await onSend(text)
      setDraft('')
    } finally {
      setSending(false)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void handleSend()
    }
  }

  if (!contact && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          icon={({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )}
          title="Pick a conversation"
          description="Select a thread on the left to read and reply."
        />
      </div>
    )
  }

  const name = contact ? ([contact.first_name, contact.last_name].filter(Boolean).join(' ') || formatPhone(contact.phone) || 'Unknown') : 'Loading…'

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-950/30">
      {/* Header */}
      <div className="h-14 px-5 border-b border-slate-800/60 bg-slate-950/40 backdrop-blur flex items-center gap-3 shrink-0">
        <Avatar firstName={contact?.first_name} lastName={contact?.last_name} size="md" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-100 truncate">{name}</div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            {contact?.phone && (
              <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{formatPhone(contact.phone)}</span>
            )}
            {contact?.email && (
              <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{contact.email}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {voiceEnabled && (
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<PhoneCall className="w-3.5 h-3.5" />}
              onClick={async () => {
                if (calling) return
                if (!confirm(`Fire a real ElevenLabs call to ${contact?.first_name ?? 'this contact'}? Their phone will ring.`)) return
                setCalling(true)
                try { await onVoiceCall() } finally { setCalling(false) }
              }}
              loading={calling}
              title="Initiate ElevenLabs voice call"
            >
              Call
            </Button>
          )}
          <Button size="sm" variant="ghost" iconLeft={<GraduationCap className="w-3.5 h-3.5" />} onClick={onTrainAI}>
            Train AI
          </Button>
          <Button
            size="sm"
            variant={paused ? 'secondary' : 'ghost'}
            iconLeft={paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            onClick={onTogglePause}
          >
            {paused ? 'Resume' : 'Pause'}
          </Button>
          {/* MoreVertical kebab removed — the button was visible but had no
              onClick handler, so users were clicking it expecting a menu and
              getting nothing. When we have a real menu (delete thread / mute
              forever / etc), wire it back in. */}
        </div>
      </div>

      {/* Channel filter chips — only show if the thread mixes types */}
      {(buckets.email > 0 || buckets.voice > 0) && (
        <div className="px-5 py-2 border-b border-slate-800/60 bg-slate-950/30 flex items-center gap-1.5 text-[11px] shrink-0 overflow-x-auto">
          <ChannelChip
            active={channel === 'all'}
            onClick={() => setChannel('all')}
            icon={Inbox}
            label="All"
            count={messages.length}
          />
          <ChannelChip
            active={channel === 'sms'}
            onClick={() => setChannel('sms')}
            icon={MessageSquare}
            label="SMS"
            count={buckets.sms}
            disabled={buckets.sms === 0}
          />
          {buckets.email > 0 && (
            <ChannelChip
              active={channel === 'email'}
              onClick={() => setChannel('email')}
              icon={Mail}
              label="Email"
              count={buckets.email}
            />
          )}
          {buckets.voice > 0 && (
            <ChannelChip
              active={channel === 'voice'}
              onClick={() => setChannel('voice')}
              icon={PhoneCall}
              label="Voice"
              count={buckets.voice}
            />
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
        {loading && messages.length === 0 && (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
                <Skeleton width={i % 2 === 0 ? 220 : 280} height={36} rounded="rounded-2xl" />
              </div>
            ))}
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center text-xs text-slate-600 mt-10">No messages yet. The first outreach will appear here.</div>
        )}
        {!loading && messages.length > 0 && filteredMessages.length === 0 && (
          <div className="text-center text-xs text-slate-600 mt-10">No {channel} messages in this thread.</div>
        )}
        {filteredMessages.map((m, idx) => (
          <MessageBubble key={m.id} message={m} isNew={idx === filteredMessages.length - 1} />
        ))}
      </div>

      {/* (composer follows) */}
      {/* Composer */}
      <div className="border-t border-slate-800/60 bg-slate-950/40 backdrop-blur p-3 shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={handleKey}
              rows={2}
              placeholder="Type your reply… ⌘+Enter to send"
              hint={`${draft.length} chars · ⌘+Enter to send · sounds like a real person, no system jargon`}
            />
          </div>
          <Button onClick={handleSend} loading={sending} disabled={!draft.trim()} variant="primary" size="lg" iconRight={<Send className="w-4 h-4" />}>
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}

function ChannelChip({ active, onClick, icon: Icon, label, count, disabled }: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  count: number
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border whitespace-nowrap transition shrink-0',
        active
          ? 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30'
          : disabled
            ? 'text-slate-600 border-transparent cursor-not-allowed'
            : 'text-slate-400 border-slate-800/60 hover:text-slate-100 hover:bg-slate-900/40',
      )}
    >
      <Icon className="w-3 h-3" />
      <span>{label}</span>
      <span className={cn('text-[10px] tabular-nums', active ? 'text-indigo-300' : 'text-slate-600')}>{count}</span>
    </button>
  )
}
