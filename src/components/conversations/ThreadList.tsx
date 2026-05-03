import { Search, Inbox } from 'lucide-react'
import Avatar from '../ui/Avatar'
import Input from '../ui/Input'
import EmptyState from '../ui/EmptyState'
import Skeleton from '../ui/Skeleton'
import { cn, timeAgo, formatPhone } from '../../lib/format'
import type { ConversationSummary } from '../../lib/types'

interface Props {
  loading: boolean
  conversations: ConversationSummary[]
  selectedId: number | null
  onSelect: (id: number) => void
  query: string
  onQueryChange: (q: string) => void
}

export default function ThreadList({ loading, conversations, selectedId, onSelect, query, onQueryChange }: Props) {
  return (
    <div className="flex flex-col h-full border-r border-slate-800/60">
      <div className="p-3 border-b border-slate-800/60">
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
          placeholder="Search by name or phone…"
          iconLeft={<Search className="w-4 h-4" />}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 && (
          <div className="p-3 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <Skeleton width={36} height={36} rounded="rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton height={10} width="65%" />
                  <Skeleton height={9} width="85%" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <EmptyState
            icon={Inbox}
            title="No conversations yet"
            description="Inbound replies and outreach will land here in real time."
          />
        )}

        {conversations.map((c) => {
          const isActive = c.contact_id === selectedId
          const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || formatPhone(c.phone) || 'Unknown'
          const arrow = c.last_direction === 'inbound' ? '↘' : '↗'
          return (
            <button
              key={c.contact_id}
              onClick={() => onSelect(c.contact_id)}
              className={cn(
                'w-full text-left px-3 py-3 border-b border-slate-900/60 flex items-start gap-3 transition',
                isActive
                  ? 'bg-indigo-500/10 border-l-2 border-l-indigo-400'
                  : 'hover:bg-slate-900/50 border-l-2 border-l-transparent',
              )}
            >
              <Avatar firstName={c.first_name} lastName={c.last_name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-100 truncate">{name}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">{timeAgo(c.last_message_at)}</span>
                </div>
                <div className="text-xs text-slate-400 truncate mt-0.5">
                  <span className="text-slate-600">{arrow}</span> {c.last_message ?? '—'}
                </div>
              </div>
              {(c.unread_count ?? 0) > 0 && (
                <span className="shrink-0 mt-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold text-white bg-gradient-to-br from-indigo-500 to-violet-500">
                  {c.unread_count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
