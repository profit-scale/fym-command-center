import { useEffect, useRef, useState } from 'react'
import { Send, MoreVertical, Phone, Mail, GraduationCap, Pause, Play } from 'lucide-react'
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
  paused: boolean
}

export default function MessageThread({ contact, messages, loading, onSend, onTrainAI, onTogglePause, paused }: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length])

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
          <button className="p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

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
        {messages.map((m, idx) => (
          <MessageBubble key={m.id} message={m} isNew={idx === messages.length - 1} />
        ))}
      </div>

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
