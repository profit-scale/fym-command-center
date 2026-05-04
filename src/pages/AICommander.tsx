import { useEffect, useMemo, useRef, useState } from 'react'
import { Brain, Send, Sparkles, Cpu, Clock, Wrench, AlertTriangle, Check, X, Plus } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Textarea } from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'
import { api } from '../lib/api'
import { useWorkspace } from '../lib/workspace'
import { useToast } from '../lib/toast'
import { cn, formatNumber, timeAgo } from '../lib/format'

interface PendingAction {
  actionId: string
  tool: string
  input: Record<string, unknown>
  description?: string
}

interface ExecutedTool {
  tool: string
  input: Record<string, unknown>
}

interface CommanderResponse {
  reply: string
  actions?: PendingAction[]
  executedTools?: ExecutedTool[]
  tokens?: { input: number; output: number; time: number }
  iterations?: number
  error?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  ts: number
  executedTools?: ExecutedTool[]
  actions?: PendingAction[]
  tokens?: { input: number; output: number; time: number }
  iterations?: number
}

// Keep chat per-workspace so switching doesn't bleed contexts.
const STORAGE_KEY_PREFIX = 'fym.cc.commander.history.'

const SUGGESTED_QUESTIONS = [
  "What are the top 3 objections leads gave this week?",
  "Which contacts haven't replied in 24h+ but had positive engagement before?",
  "Show me the conversion path of leads who booked — what did they say first?",
  "Are there patterns in the time-of-day when leads respond?",
  "Which tags correlate most with booked vs lost leads?",
  "What's the average time between first message and first reply?",
  "Are any leads asking the same question repeatedly that the bot isn't answering well?",
]

export default function AICommander() {
  const { current: workspace, syncStamp, workspaces } = useWorkspace()
  const ws = workspaces[workspace]
  const toast = useToast()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const sessionId = useRef<string>(`fym-${Date.now()}`)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  const storageKey = STORAGE_KEY_PREFIX + workspace

  // Load persisted chat for this workspace on mount / workspace switch
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as { sessionId: string; messages: ChatMessage[] }
        if (parsed?.sessionId) sessionId.current = parsed.sessionId
        if (Array.isArray(parsed?.messages)) setMessages(parsed.messages)
        else setMessages([])
      } else {
        setMessages([])
      }
    } catch {
      setMessages([])
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [workspace])

  // Persist on every change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ sessionId: sessionId.current, messages }))
    } catch { /* quota — non-fatal */ }
  }, [messages, storageKey])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length, thinking])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || thinking) return
    if (syncStamp === 0) {
      toast.push('Workspace not ready yet — try again in a sec', 'warning')
      return
    }
    const userMsg: ChatMessage = { role: 'user', content: trimmed, ts: Date.now() }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setThinking(true)
    try {
      // Re-assert workspace before every commander call — engine is single-active
      try {
        await api('/api/workspaces/switch', { method: 'POST', body: { slug: workspace } })
      } catch { /* non-fatal */ }
      const res = await api<CommanderResponse>('/api/commander/chat', {
        method: 'POST',
        body: { message: trimmed, sessionId: sessionId.current },
      })
      const replyMsg: ChatMessage = {
        role: 'assistant',
        content: res.reply || '(no reply)',
        ts: Date.now(),
        executedTools: res.executedTools,
        actions: res.actions,
        tokens: res.tokens,
        iterations: res.iterations,
      }
      setMessages((m) => [...m, replyMsg])
    } catch (err) {
      toast.push((err as Error).message, 'danger')
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ Error: ${(err as Error).message}`, ts: Date.now() }])
    } finally {
      setThinking(false)
      requestAnimationFrame(() => taRef.current?.focus())
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void send(input)
    }
  }

  async function approve(actionId: string) {
    try {
      await api(`/api/commander/approve/${actionId}`, { method: 'POST' })
      toast.push('Action approved', 'success')
      // Rough refresh: append a system note so the user sees it landed
      setMessages((m) => [...m, { role: 'assistant', content: `✅ Approved action ${actionId}.`, ts: Date.now() }])
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    }
  }

  async function reject(actionId: string) {
    try {
      await api(`/api/commander/reject/${actionId}`, { method: 'POST' })
      toast.push('Action rejected', 'info')
      setMessages((m) => [...m, { role: 'assistant', content: `❌ Rejected action ${actionId}.`, ts: Date.now() }])
    } catch (err) {
      toast.push((err as Error).message, 'danger')
    }
  }

  function newChat() {
    sessionId.current = `fym-${Date.now()}`
    setMessages([])
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
    requestAnimationFrame(() => taRef.current?.focus())
  }

  const totalTokens = useMemo(
    () => messages.reduce((s, m) => s + ((m.tokens?.input ?? 0) + (m.tokens?.output ?? 0)), 0),
    [messages],
  )

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -mx-8 -my-6 px-8 py-6 max-w-[1400px]">
      <div className="flex items-end justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-400" />
            AI Commander
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ask anything about <strong className="text-slate-300">{ws?.name ?? workspace}</strong> — patterns, objections, lead behavior, system config. Claude has read-access to every conversation, contact, tag, and config field.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          {totalTokens > 0 && (
            <Badge tone="neutral" className="!text-[10px]">
              <Cpu className="w-3 h-3 inline mr-1" />
              {formatNumber(totalTokens)} tokens this session
            </Badge>
          )}
          <Button size="sm" variant="ghost" iconLeft={<Plus className="w-3.5 h-3.5" />} onClick={newChat}>
            New chat
          </Button>
        </div>
      </div>

      {/* Chat surface */}
      <Card flush className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {messages.length === 0 && !thinking && (
            <div className="space-y-5">
              <EmptyState
                icon={Sparkles}
                title="Ask anything about this workspace"
                description="The Commander reads conversations, contacts, tags, custom fields, and system metrics in real time. Try one of these to start:"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-3xl mx-auto">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-left text-xs text-slate-300 px-3 py-2.5 rounded-lg border border-slate-800/60 bg-slate-900/40 hover:border-violet-500/40 hover:bg-violet-500/5 hover:text-violet-100 transition leading-relaxed"
                  >
                    <Sparkles className="w-3 h-3 inline mr-1.5 text-violet-400" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, idx) => (
            <ChatBubble
              key={`${m.ts}-${idx}`}
              message={m}
              onApprove={approve}
              onReject={reject}
              isLast={idx === messages.length - 1}
            />
          ))}

          {thinking && (
            <div className="flex items-start gap-3 max-w-[80%]">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                <Brain className="w-3.5 h-3.5 text-violet-300" />
              </div>
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-4 py-2.5 text-sm text-slate-400 italic flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                Thinking
                <span className="text-slate-600 text-[11px]">· querying live workspace data, may take 5–20s</span>
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-slate-800/60 bg-slate-950/40 backdrop-blur p-3 shrink-0">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <div className="flex-1">
              <Textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
                onKeyDown={handleKey}
                rows={2}
                placeholder="Ask anything about this workspace… ⌘+Enter to send"
                hint={`${input.length} chars · ⌘+Enter to send`}
                disabled={thinking}
              />
            </div>
            <Button
              onClick={() => send(input)}
              loading={thinking}
              disabled={!input.trim() || thinking}
              variant="primary"
              size="lg"
              iconRight={<Send className="w-4 h-4" />}
            >
              Send
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

/* ---------- chat bubble ---------- */

function ChatBubble({ message, onApprove, onReject, isLast }: {
  message: ChatMessage
  onApprove: (id: string) => void
  onReject: (id: string) => void
  isLast: boolean
}) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex gap-3 max-w-[88%]', isUser ? 'ml-auto flex-row-reverse' : '', isLast && 'animate-slide-in')}>
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        isUser
          ? 'bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/40'
          : 'bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30',
      )}>
        {isUser ? <span className="text-[10px] font-semibold text-indigo-200">YOU</span> : <Brain className="w-3.5 h-3.5 text-violet-300" />}
      </div>

      <div className={cn('min-w-0 flex-1', isUser ? 'items-end' : 'items-start')}>
        <div className={cn(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
          isUser
            ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white border border-indigo-400/40'
            : 'bg-slate-900/60 text-slate-100 border border-slate-800/60',
        )}>
          {isUser ? (
            <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</div>
          ) : (
            <Markdown text={message.content} />
          )}
        </div>

        {/* Tool usage */}
        {!isUser && (message.executedTools?.length || message.actions?.length) ? (
          <div className="mt-2 space-y-1.5">
            {(message.executedTools ?? []).map((t, i) => (
              <div key={`et-${i}`} className="text-[11px] text-slate-500 inline-flex items-center gap-1.5 mr-2">
                <Wrench className="w-3 h-3 text-emerald-400" />
                <code className="text-emerald-300">{t.tool}</code>
                <span className="text-slate-600 truncate max-w-[400px]">{summarizeInput(t.input)}</span>
              </div>
            ))}
            {(message.actions ?? []).map((a) => (
              <div key={a.actionId} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-start gap-2 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-amber-100 font-medium">Pending action: <code className="text-amber-200">{a.tool}</code></div>
                    {a.description && <div className="text-amber-200/70 mt-0.5">{a.description}</div>}
                    <div className="text-[10px] text-amber-300/60 mt-1 font-mono truncate">{summarizeInput(a.input)}</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="primary" iconLeft={<Check className="w-3 h-3" />} onClick={() => onApprove(a.actionId)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" iconLeft={<X className="w-3 h-3" />} onClick={() => onReject(a.actionId)}>
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Footer metadata */}
        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-600">
          <Clock className="w-3 h-3" />
          <span>{timeAgo(new Date(message.ts).toISOString())}</span>
          {message.tokens && (
            <>
              <span>·</span>
              <span>
                {formatNumber(message.tokens.input + message.tokens.output)} tokens · {(message.tokens.time / 1000).toFixed(1)}s
                {message.iterations && message.iterations > 1 ? ` · ${message.iterations} steps` : ''}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- mini markdown renderer ----------
   Claude responses use markdown. We render the basics inline without pulling in
   a 50KB markdown lib. Code fences become <pre>, **bold** becomes <strong>,
   bullets stay as text with •, headers become bigger weight. Anything more
   exotic falls back to whitespace-pre-wrap raw text — readable, just plainer. */
function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => parseBlocks(text), [text])
  return (
    <div className="space-y-2.5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-slate-800/60 [&_code]:text-violet-200 [&_code]:text-[12px] [&_strong]:text-white">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'h':
            return <div key={i} className={cn('font-semibold tracking-tight', b.level === 1 ? 'text-lg' : b.level === 2 ? 'text-base' : 'text-sm')}>{renderInline(b.text)}</div>
          case 'code':
            return <pre key={i} className="text-[12px] bg-slate-950/60 border border-slate-800/60 rounded-lg p-3 overflow-auto whitespace-pre"><code>{b.text}</code></pre>
          case 'list':
            return (
              <ul key={i} className="list-none space-y-1 ml-1">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-2"><span className="text-violet-400 shrink-0">•</span><span className="min-w-0">{renderInline(item)}</span></li>
                ))}
              </ul>
            )
          case 'numlist':
            return (
              <ol key={i} className="list-none space-y-1 ml-1 counter-reset-num">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-2"><span className="text-violet-400 shrink-0 tabular-nums">{j + 1}.</span><span className="min-w-0">{renderInline(item)}</span></li>
                ))}
              </ol>
            )
          case 'p':
          default:
            return <div key={i} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{renderInline(b.text)}</div>
        }
      })}
    </div>
  )
}

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h'; text: string; level: number }
  | { kind: 'code'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'numlist'; items: string[] }

function parseBlocks(src: string): Block[] {
  const blocks: Block[] = []
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  let i = 0
  while (i < lines.length) {
    const ln = lines[i]
    // Code fence
    if (/^```/.test(ln)) {
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++ }
      i++ // consume closing fence
      blocks.push({ kind: 'code', text: buf.join('\n') })
      continue
    }
    // Header
    const hMatch = ln.match(/^(#{1,6})\s+(.+)$/)
    if (hMatch) {
      blocks.push({ kind: 'h', level: Math.min(3, hMatch[1].length), text: hMatch[2] })
      i++
      continue
    }
    // Bullet list
    if (/^[\s]*[-•*]\s+/.test(ln)) {
      const items: string[] = []
      while (i < lines.length && /^[\s]*[-•*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*[-•*]\s+/, ''))
        i++
      }
      blocks.push({ kind: 'list', items })
      continue
    }
    // Numbered list
    if (/^[\s]*\d+\.\s+/.test(ln)) {
      const items: string[] = []
      while (i < lines.length && /^[\s]*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*\d+\.\s+/, ''))
        i++
      }
      blocks.push({ kind: 'numlist', items })
      continue
    }
    // Blank line
    if (!ln.trim()) {
      i++
      continue
    }
    // Paragraph (collect contiguous non-blank lines)
    const buf: string[] = [ln]
    i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|[\s]*[-•*]\s|[\s]*\d+\.\s)/.test(lines[i])) {
      buf.push(lines[i])
      i++
    }
    blocks.push({ kind: 'p', text: buf.join('\n') })
  }
  return blocks
}

/** Render inline markdown: **bold**, *italic*, `code`. Keeps it surgical. */
function renderInline(text: string): React.ReactNode {
  // Tokenize for the three inline forms; everything else stays as text.
  const out: React.ReactNode[] = []
  const re = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] !== undefined) out.push(<strong key={key++}>{m[1]}</strong>)
    else if (m[2] !== undefined) out.push(<em key={key++}>{m[2]}</em>)
    else if (m[3] !== undefined) out.push(<code key={key++}>{m[3]}</code>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function summarizeInput(input: Record<string, unknown>): string {
  try {
    const s = JSON.stringify(input)
    return s.length > 120 ? s.slice(0, 117) + '…' : s
  } catch {
    return '[unprintable]'
  }
}
