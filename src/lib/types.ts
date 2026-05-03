// Shared API types — mirror what the VPS engine returns.
// Kept loose where the backend schema is in flux; tighten as we lock pages down.

export type AgentStatus = 'running' | 'paused' | 'error' | 'unknown'

export interface Workspace {
  slug: string
  name?: string
  is_active?: number | boolean
  agent_status?: AgentStatus
  contacts_total?: number
  outbound_1h?: number
  outbound_24h?: number
  inbound_24h?: number
  last_outbound?: string | null
  elevenlabs_call_enabled?: '0' | '1' | string
  max_follow_ups_per_day?: string | number
}

export interface HealthResponse {
  ts: string
  workspaces: Record<string, Workspace>
}

export interface Contact {
  id: number
  ghl_contact_id: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  email?: string | null
  lead_stage?: string | null
  is_paused?: number
  follow_up_count?: number
  last_inbound_at?: string | null
  last_outbound_at?: string | null
  next_follow_up_after?: string | null
  tags?: string | null            // JSON-encoded array
  metadata?: string | null        // JSON-encoded object (custom fields)
  lead_score?: number | null
  created_at?: string
  updated_at?: string
}

export type MessageDirection = 'inbound' | 'outbound'
export type MessageType = 'SMS' | 'Email' | 'Voice' | string

export interface Message {
  id: number
  contact_id: number
  direction: MessageDirection
  body: string
  message_type: MessageType
  classified_as?: string | null
  created_at: string
  // Joined from contact when listing
  first_name?: string | null
  phone?: string | null
}

export interface ConversationSummary {
  contact_id: number
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  last_message?: string
  last_message_at?: string
  last_direction?: MessageDirection
  unread_count?: number
  tags?: string | null
}

export interface FeedbackRule {
  id: number
  trigger_condition: string
  action_instruction: string
  context_example?: string | null
  category?: string
  priority?: number
  is_active?: number
  source_contact_id?: number | null
  source_conversation_id?: number | null
  first_name?: string | null
  last_name?: string | null
  created_at?: string
  updated_at?: string
}

export interface DashboardOverview {
  outbound_today?: number
  outbound_24h?: number
  inbound_24h?: number
  contacts_total?: number
  ai_replies_24h?: number
  follow_ups_24h?: number
  // ...we render what's there, gracefully skip what's missing
  [k: string]: unknown
}

export interface SystemStatus {
  status: AgentStatus
  uptime?: number | string
  workspace?: string
  [k: string]: unknown
}

// Live SSE event payload — best-effort typing.
export interface SSEEvent {
  event?: 'message' | 'system' | 'sync'
  type?: 'inbound' | 'outbound' | 'status_change' | 'escalation' | 'error'
  conversationId?: number
  contactName?: string
  message?: string
  manual?: boolean
  classified?: string
  status?: AgentStatus
  newMessages?: number
  [k: string]: unknown
}
