import { useState } from 'react'
import { ChevronDown, FileText, PhoneCall, PhoneOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn, timeAgo, classifyBody, bodyKindLabel, parseUtc } from '../../lib/format'
import type { Message } from '../../lib/types'

const CLASSIFICATION_LABEL: Record<string, string> = {
  follow_up: 'Follow-Up',
  first_outreach: 'First Outreach',
  conversation: 'AI Reply',
  reply: 'Reply',
  rsvp_yes: 'RSVP Yes',
  rsvp_confirmation: 'RSVP Confirmation',
  ai_response: 'AI Reply',
  ai_call_trigger: 'Voice Call',
}

// Voice events render as a centered system-event row, not a chat bubble.
// Helps the eye separate "stuff said in the conversation" from "system events
// the engine performed against the contact" — same pattern as iMessage's grey
// "FaceTime ended" line.
function isVoiceEvent(message: Message): boolean {
  return message.message_type === 'VOICE_CALL' || message.message_type === 'CALL_ENDED'
}

interface Props {
  message: Message
  isNew?: boolean
}

export default function MessageBubble({ message, isNew }: Props) {
  // Voice-call events render distinctly so they don't get visually confused
  // with messages the lead actually read. Centered system row, phone icon,
  // muted text, click-through to /calls if we have a call detail.
  if (isVoiceEvent(message)) {
    return <VoiceEventRow message={message} isNew={isNew} />
  }

  const isInbound = message.direction === 'inbound'
  // GHL email bodies often arrive with HTML stripped to text — long marketing
  // copy + multi-line unsubscribe links + cryptic URL params. classifyBody
  // can't always pattern-match those (no <html> tag left), so we ALSO collapse
  // any message whose channel is Email. Without this, an unrolled 4KB email
  // body blows out the bubble and pushes the layout sideways.
  const isEmail = message.message_type === 'Email'
  const bodyKind = classifyBody(message.body)
  const kind = bodyKind === 'normal' && isEmail ? 'html' : bodyKind
  const isJunk = kind !== 'normal'
  const [expanded, setExpanded] = useState(false)
  const cls = message.classified_as
  return (
    <div className={cn('flex w-full', isInbound ? 'justify-start' : 'justify-end', isNew && 'animate-slide-in')}>
      <div className={cn('max-w-[70%] min-w-0 flex flex-col', isInbound ? 'items-start' : 'items-end')}>
        <div
          className={cn(
            // break-all + break-words handles both regular long words and unbreakable URLs (GHL unsubscribe links etc).
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-w-full',
            isJunk
              ? 'bg-slate-900/60 text-slate-400 border border-slate-800/80 italic'
              : isInbound
                ? 'bg-slate-800/70 text-slate-100 border border-slate-700/60 rounded-bl-md'
                : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white border border-indigo-400/40 rounded-br-md',
          )}
        >
          {isJunk ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs not-italic group"
              title={expanded ? 'Collapse' : 'Show raw'}
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>{bodyKindLabel(kind)}</span>
              <ChevronDown className={cn('w-3 h-3 text-slate-600 transition group-hover:text-slate-300', expanded && 'rotate-180')} />
            </button>
          ) : (
            message.body
          )}
          {isJunk && expanded && (
            <pre className="mt-2 text-[11px] leading-relaxed text-slate-500 max-h-64 overflow-auto whitespace-pre-wrap break-all [overflow-wrap:anywhere] font-mono not-italic max-w-full">
              {message.body}
            </pre>
          )}
        </div>
        <div className={cn('mt-1 flex items-center gap-2 text-[10px] text-slate-500', isInbound ? 'pl-2' : 'pr-2')}>
          <span>{timeAgo(message.created_at)}</span>
          {message.message_type && message.message_type !== 'SMS' && (
            <span className="px-1.5 py-px rounded-full border border-slate-700/60 bg-slate-800/50 text-slate-400">{message.message_type}</span>
          )}
          {cls && (
            <span className="px-1.5 py-px rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
              {CLASSIFICATION_LABEL[cls] ?? cls}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function VoiceEventRow({ message, isNew }: { message: Message; isNew?: boolean }) {
  const isStart = message.message_type === 'VOICE_CALL'
  const Icon = isStart ? PhoneCall : PhoneOff
  // Engine writes bodies like "📞 Voice call initiated (2 unreplied)" and
  // "📵 Call ended after 47s — outcome: no_answer". Strip the leading emoji
  // so we can use a proper Lucide icon at consistent stroke weight.
  const body = (message.body || '').replace(/^[📞📵]\s*/, '')
  return (
    <div className={cn('flex justify-center my-2', isNew && 'animate-slide-in')}>
      <Link
        to="/calls"
        className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/5 hover:border-violet-500/50 hover:bg-violet-500/10 transition px-3 py-1.5 text-[11px] text-violet-200 group"
        title={parseUtc(message.created_at)?.toLocaleString() ?? ''}
      >
        <Icon className={cn('w-3 h-3', isStart ? 'text-violet-400' : 'text-slate-500')} />
        <span className="text-slate-300">{body || (isStart ? 'Voice call initiated' : 'Call ended')}</span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-500">{timeAgo(message.created_at)}</span>
        <span className="text-violet-400/60 group-hover:text-violet-300 transition">→</span>
      </Link>
    </div>
  )
}
