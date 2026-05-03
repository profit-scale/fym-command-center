import { useEffect, useState } from 'react'
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
 * Conversations: 3-pane inbox driven by /api/conversations + /api/contacts/:id +
 * POST /api/contacts/:id/message. Polls every 12s and listens to /api/events.
 */
export default function Conversations() {
  const { current: workspace, syncStamp } = useWorkspace()
  const { contactId: routeId } = useParams<{ contactId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [convs, setConvs] = useState<ConversationSummary[]>([])
  const [convsLoading, setConvsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | null>(routeId ? Number(routeId) : null)
  const [messages, setMessages] = useState<Message[]>([])
  const [contact, setContact] = useState<Contact | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)

  const [trainOpen, setTrainOpen] = useState(false)
  const [trainTrigger, setTrainTrigger] = useState('')
  const [trainAction, setTrainAction] = useState('')
  const [trainSaving, setTrainSaving] = useState(false)

  // Sync selection when the URL param changes (deep link / back-forward)
  useEffect(() => {
    setSelected(routeId ? Number(routeId) : null)
  }, [routeId])

  /** Defensive workspace switch before any workspace-scoped fetch. */
  async function ensureWorkspace() {
    try {
      await api('/api/workspaces/switch', { method: 'POST', body: { slug: workspace } })
    } catch { /* non-fatal */ }
  }

  /** Load conversation summaries (left rail). */
  async function loadConversations(silent = false) {
    if (!silent) setConvsLoading(true)
    try {
      await ensureWorkspace()
      type R = { conversations: Array<ConversationSummary & {
        contact_id: number
        first_name?: string | null
        last_name?: string | null
        phone?: string | null
        last_message?: string
        last_message_at?: string
        last_direction?: 'inbound' | 'outbound'
        is_paused?: number
      }> }
      const res = await api<R>('/api/conversations', { query: { limit: 200, search: query || undefined } })
      const all = res.conversations ?? []
      const filtered = query
        ? all.filter((c) => {
            const q = query.toLowerCase()
            return (c.first_name ?? '').toLowerCase().includes(q)
              || (c.last_name ?? '').toLowerCase().includes(q)
              || (c.phone ?? '').includes(q)
          })
        : all
      setConvs(filtered)
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
      await ensureWorkspace()
      const [contactRes, msgRes] = await Promise.all([
        api<Contact>(`/api/contacts/${contactId}`).catch(() => null),
        api<{ messages: Message[] }>(`/api/admin/messages/${encodeURIComponent(workspace)}`, {
          query: { contact_id: contactId, limit: 200 },
        }).catch(() => ({ messages: [] as Message[] })),
      ])
      setContact(contactRes)
      const sorted = [...(msgRes.messages ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
      setMessages(sorted)
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    } finally {
      setThreadLoading(false)
    }
  }

  // Initial + workspace change. Wait for syncStamp.
  useEffect(() => {
    if (syncStamp === 0) return
    loadConversations(false)
    const t = setInterval(() => loadConversations(true), 12_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, syncStamp])

  // Live updates via SSE
  useEffect(() => {
    const off = subscribeSSE('/api/events', (raw) => {
      const data = raw as SSEEvent
      if (data.event === 'message') {
        loadConversations(true)
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
    if (syncStamp === 0) return
    const t = setTimeout(() => loadConversations(true), 250)
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
      // Optimistic append
      const optimistic: Message = {
        id: Date.now(),
        contact_id: selected,
        direction: 'outbound',
        body: text,
        message_type: 'SMS',
        classified_as: 'reply',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimistic])
      await api(`/api/contacts/${selected}/message`, { method: 'POST', body: { message: text } })
      toast.push('Reply sent', 'success')
      // Re-fetch the actual messages so we get the real row
      setTimeout(() => loadThread(selected), 1200)
      loadConversations(true)
    } catch (err) {
      // Rollback the optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.body !== text || m.direction !== 'outbound'))
      toast.push((err as Error).message, 'danger')
    }
  }

  async function togglePause() {
    if (!contact) return
    const next = contact.is_paused ? 0 : 1
    try {
      await api(`/api/contacts/${contact.id}`, { method: 'PATCH', body: { is_paused: next } })
      setContact({ ...contact, is_paused: next })
      toast.push(next ? 'Paused' : 'Resumed', 'success')
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

  return (
    <div className="-mx-8 -my-6 h-[calc(100vh-3.5rem)] flex">
      <div className="w-80 shrink-0">
        <ThreadList
          loading={convsLoading}
          conversations={convs}
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
