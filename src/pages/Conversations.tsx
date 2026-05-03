import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, subscribeSSE } from '../lib/api'
import { useWorkspace } from '../lib/workspace'
import { useToast } from '../lib/toast'
import ThreadList from '../components/conversations/ThreadList'
import MessageThread from '../components/conversations/MessageThread'
import ContactPanel from '../components/conversations/ContactPanel'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Input, { Textarea } from '../components/ui/Input'
import type { Contact, ConversationSummary, Message, SSEEvent } from '../lib/types'

/**
 * Conversations is the gem of the app: a 3-pane view (thread list / messages /
 * contact). Polls every 8s and listens to /api/events SSE for instant push.
 */
export default function Conversations() {
  const { current: workspace } = useWorkspace()
  const { contactId: routeId } = useParams<{ contactId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [convs, setConvs] = useState<ConversationSummary[]>([])
  const [convsLoading, setConvsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | null>(routeId ? Number(routeId) : null)

  // Sync selection when the URL param changes (e.g., deep link or back/forward)
  useEffect(() => {
    const id = routeId ? Number(routeId) : null
    setSelected(id)
  }, [routeId])
  const [messages, setMessages] = useState<Message[]>([])
  const [contact, setContact] = useState<Contact | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)

  const [trainOpen, setTrainOpen] = useState(false)
  const [trainTrigger, setTrainTrigger] = useState('')
  const [trainAction, setTrainAction] = useState('')
  const [trainSaving, setTrainSaving] = useState(false)

  /** Load conversation summaries (left rail). */
  async function loadConversations(q: string = query, silent = false) {
    if (!silent) setConvsLoading(true)
    try {
      // Pull recent messages and group by contact_id client-side. The backend
      // doesn't have a single `/conversations` endpoint that returns clean
      // summaries — we synthesize one from /api/admin/messages/<workspace>.
      const limit = 200
      const path = `/api/admin/messages/${encodeURIComponent(workspace)}`
      type R = { messages: Message[] }
      const res = await api<R>(path, { query: { limit, search: q || undefined } })
      const grouped = new Map<number, Message[]>()
      for (const m of res.messages ?? []) {
        const arr = grouped.get(m.contact_id) ?? []
        arr.push(m)
        grouped.set(m.contact_id, arr)
      }
      const summaries: ConversationSummary[] = []
      for (const [cid, arr] of grouped) {
        arr.sort((a, b) => a.created_at.localeCompare(b.created_at))
        const last = arr[arr.length - 1]
        summaries.push({
          contact_id: cid,
          first_name: last.first_name,
          phone: last.phone,
          last_message: last.body?.slice(0, 90),
          last_message_at: last.created_at,
          last_direction: last.direction,
        })
      }
      summaries.sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''))
      setConvs(summaries)
    } catch (err) {
      if (!silent) toast.push((err as Error).message, 'danger')
    } finally {
      if (!silent) setConvsLoading(false)
    }
  }

  /** Load thread + contact for the selected conversation. */
  async function loadThread(contactId: number) {
    setThreadLoading(true)
    try {
      const path = `/api/admin/messages/${encodeURIComponent(workspace)}`
      type R = { messages: Message[] }
      const res = await api<R>(path, { query: { contact_id: contactId, limit: 200 } })
      const sorted = [...(res.messages ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
      setMessages(sorted)

      // Try to fetch the full contact row. If the endpoint isn't there yet, derive from message metadata.
      try {
        const c = await api<Contact>(`/api/admin/contacts/${encodeURIComponent(workspace)}/${contactId}`)
        setContact(c)
      } catch {
        const last = sorted[sorted.length - 1]
        setContact({
          id: contactId,
          ghl_contact_id: '',
          first_name: last?.first_name ?? null,
          phone: last?.phone ?? null,
        } as Contact)
      }
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    } finally {
      setThreadLoading(false)
    }
  }

  // Initial + workspace change
  useEffect(() => {
    loadConversations('', false)
    // Slow poll fallback (in case SSE is dead)
    const t = setInterval(() => loadConversations(query, true), 12_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace])

  // Live updates via SSE
  useEffect(() => {
    const off = subscribeSSE('/api/events', (raw) => {
      const data = raw as SSEEvent
      if (data.event === 'message') {
        loadConversations(query, true)
        if (selected && data.conversationId === selected) {
          loadThread(selected)
        }
      }
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, workspace])

  // Refresh on selection change
  useEffect(() => {
    if (selected) loadThread(selected)
    else { setMessages([]); setContact(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, workspace])

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => loadConversations(query, true), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function selectContact(id: number) {
    setSelected(id)
    navigate(`/conversations/${id}`)
  }

  async function sendReply(text: string) {
    if (!selected) return
    try {
      await api(`/api/admin/messages/${encodeURIComponent(workspace)}/send`, {
        method: 'POST',
        body: { contact_id: selected, message: text, manual: true },
      })
      toast.push('Reply sent', 'success')
      // Optimistic: append immediately
      setMessages((prev) => [...prev, {
        id: Date.now(),
        contact_id: selected,
        direction: 'outbound',
        body: text,
        message_type: 'SMS',
        classified_as: 'reply',
        created_at: new Date().toISOString(),
      }])
      loadConversations(query, true)
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    }
  }

  async function togglePause() {
    if (!contact) return
    try {
      await api(`/api/admin/contacts/${encodeURIComponent(workspace)}/${contact.id}/pause`, {
        method: 'POST',
        body: { paused: !contact.is_paused },
      })
      setContact({ ...contact, is_paused: contact.is_paused ? 0 : 1 })
      toast.push(contact.is_paused ? 'Resumed' : 'Paused', 'success')
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    }
  }

  async function saveTrainingRule() {
    if (!trainTrigger.trim() || !trainAction.trim()) return
    setTrainSaving(true)
    try {
      await api('/api/feedback-rules', {
        method: 'POST',
        body: {
          trigger_condition: trainTrigger.trim(),
          action_instruction: trainAction.trim(),
          source_contact_id: contact?.id,
          source_conversation_id: selected,
          category: 'response_style',
        },
      })
      toast.push('Training rule saved', 'success')
      setTrainOpen(false)
      setTrainTrigger('')
      setTrainAction('')
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    } finally {
      setTrainSaving(false)
    }
  }

  const filteredConvs = useMemo(() => convs, [convs])

  return (
    <div className="-mx-8 -my-6 h-[calc(100vh-3.5rem)] flex">
      <div className="w-80 shrink-0">
        <ThreadList
          loading={convsLoading}
          conversations={filteredConvs}
          selectedId={selected}
          onSelect={selectContact}
          query={query}
          onQueryChange={setQuery}
        />
      </div>
      <MessageThread
        contact={contact}
        messages={messages}
        loading={threadLoading}
        onSend={sendReply}
        onTrainAI={() => setTrainOpen(true)}
        onTogglePause={togglePause}
        paused={!!contact?.is_paused}
      />
      <ContactPanel contact={contact} loading={threadLoading} />

      <Modal
        open={trainOpen}
        onClose={() => setTrainOpen(false)}
        title="Train the AI on this conversation"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTrainOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveTrainingRule} loading={trainSaving} disabled={!trainTrigger.trim() || !trainAction.trim()}>
              Save rule
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium block mb-1.5">When (trigger)</label>
            <Input
              value={trainTrigger}
              onChange={(e) => setTrainTrigger(e.currentTarget.value)}
              placeholder="e.g. Lead asks who the program is for and we have hhc | self tag"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium block mb-1.5">Then (action)</label>
            <Textarea
              value={trainAction}
              onChange={(e) => setTrainAction(e.currentTarget.value)}
              rows={3}
              placeholder="e.g. Confirm naturally that it's for them and ask them to call (330) 587-9558."
            />
          </div>
          <div className="text-[11px] text-slate-500 leading-relaxed border-l-2 border-indigo-500/30 pl-3">
            These rules are persisted per workspace and injected into every prompt as <code className="text-indigo-300">LEARNED RULES</code>. They survive every prompt redeploy.
          </div>
        </div>
      </Modal>
    </div>
  )
}
