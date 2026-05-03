import { cn, timeAgo } from '../../lib/format'
import type { Message } from '../../lib/types'

const CLASSIFICATION_LABEL: Record<string, string> = {
  follow_up: 'Follow-Up',
  first_outreach: 'First Outreach',
  conversation: 'AI Reply',
  reply: 'Reply',
  rsvp_yes: 'RSVP Yes',
  rsvp_confirmation: 'RSVP Confirmation',
}

interface Props {
  message: Message
  isNew?: boolean
}

export default function MessageBubble({ message, isNew }: Props) {
  const isInbound = message.direction === 'inbound'
  const isHtmlBlob = /^<!DOCTYPE|^<html|^<body/i.test(message.body ?? '')
  const cls = message.classified_as
  return (
    <div className={cn('flex w-full', isInbound ? 'justify-start' : 'justify-end', isNew && 'animate-slide-in')}>
      <div className={cn('max-w-[70%] flex flex-col', isInbound ? 'items-start' : 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm whitespace-pre-wrap break-words',
            isInbound
              ? 'bg-slate-800/70 text-slate-100 border border-slate-700/60 rounded-bl-md'
              : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white border border-indigo-400/40 rounded-br-md',
          )}
        >
          {isHtmlBlob ? (
            <span className="italic text-current/70 text-xs">[HTML email body — open contact to view]</span>
          ) : (
            message.body
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
