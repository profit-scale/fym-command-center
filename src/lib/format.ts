// Tiny formatters — kept dependency-free to keep the bundle slim.

export function parseUtc(d?: string | null): Date | null {
  if (!d) return null
  let s = String(d)
  // SQLite datetime('now') returns "2026-05-03 14:11:54" with no timezone — assume UTC.
  if (!s.endsWith('Z') && !s.includes('+') && !s.includes('T')) s = s.replace(' ', 'T') + 'Z'
  else if (s.includes('T') && !s.endsWith('Z') && !s.includes('+')) s += 'Z'
  return new Date(s)
}

export function timeAgo(d?: string | null): string {
  const date = parseUtc(d)
  if (!date) return '—'
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 0) return 'just now'
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function formatNumber(n?: number | string | null): string {
  if (n === null || n === undefined || n === '') return '—'
  const num = typeof n === 'string' ? Number(n) : n
  if (!Number.isFinite(num)) return '—'
  return num.toLocaleString('en-US')
}

export function formatPhone(p?: string | null): string {
  if (!p) return ''
  const digits = String(p).replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return p
}

export function initials(first?: string | null, last?: string | null): string {
  const f = (first ?? '').trim()
  const l = (last ?? '').trim()
  if (f && l) return (f[0] + l[0]).toUpperCase()
  if (f) return f.slice(0, 2).toUpperCase()
  if (l) return l.slice(0, 2).toUpperCase()
  return '··'
}

export function parseTags(tags?: string | null): string[] {
  if (!tags) return []
  const trimmed = tags.trim()
  if (!trimmed) return []
  const out: string[] = []

  // GHL ends up storing tags in three ways:
  //   1. clean JSON array string  '["a","b"]'
  //   2. plain comma-separated    'a,b,c'
  //   3. mixed legacy garbage     '["a","b"],c,d,d'  ← seen on real records
  // We extract the JSON prefix if present, then comma-split anything left.
  let rest = trimmed
  if (rest.startsWith('[')) {
    // Find the matching closing bracket
    let depth = 0
    let end = -1
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '[') depth++
      else if (rest[i] === ']') {
        depth--
        if (depth === 0) { end = i; break }
      }
    }
    if (end > 0) {
      const head = rest.slice(0, end + 1)
      try {
        const parsed = JSON.parse(head)
        if (Array.isArray(parsed)) {
          for (const t of parsed) if (typeof t === 'string' && t.trim()) out.push(t.trim())
        }
      } catch { /* ignore */ }
      rest = rest.slice(end + 1).replace(/^[,\s]+/, '')
    }
  }
  if (rest) {
    for (const t of rest.split(',')) {
      const v = t.trim()
      if (v && !out.includes(v)) out.push(v)
    }
  }
  return out
}

export function parseMetadata(metadata?: string | null): Record<string, unknown> {
  if (!metadata) return {}
  try {
    const parsed = JSON.parse(metadata)
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
  } catch { /* ignore */ }
  return {}
}

/** Combine tailwind class strings, ignore falsy. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/**
 * Classify a message body so the UI can render junk (HTML email blobs, GHL
 * workflow notifications that leaked into SMS, "client name X / phone Y"
 * lead-router blasts) as a single labeled chip instead of dumping the noise
 * into the thread or preview.
 */
export type MessageBodyKind = 'html' | 'workflow_blast' | 'system' | 'normal'

export function classifyBody(body?: string | null): MessageBodyKind {
  if (!body) return 'normal'
  const s = String(body).trim()
  if (!s) return 'normal'

  // HTML email body
  if (/^<!DOCTYPE/i.test(s) || /^<html\b/i.test(s) || /<\/html>/i.test(s)) return 'html'
  if (/<table[\s>]/i.test(s) && s.length > 200) return 'html'

  // GHL workflow / lead-router notifications dumped to SMS
  // ("Chatbot is responding - check the response! / Client name: ... / Client phone: ...")
  if (/^Chatbot is responding/i.test(s)) return 'workflow_blast'
  if (/^New FB Lead\b/i.test(s)) return 'workflow_blast'
  if (/Client name:\s.+Client phone:/is.test(s)) return 'workflow_blast'
  if (/Lead Funnel Name:\s.+Phone:/is.test(s) && /Date:/i.test(s)) return 'workflow_blast'

  // Other system-y debug noise
  if (/^Link to client:\s*https?:\/\//i.test(s)) return 'system'

  return 'normal'
}

/** Short label for non-normal bodies. Empty string for normal. */
export function bodyKindLabel(kind: MessageBodyKind): string {
  switch (kind) {
    case 'html': return 'HTML email body'
    case 'workflow_blast': return 'Lead notification — internal'
    case 'system': return 'System notification'
    case 'normal': return ''
  }
}

/**
 * Return a one-line preview suitable for thread lists / feed rows. Replaces
 * junk classes with a short [bracketed] label, collapses whitespace, truncates.
 */
export function bodyPreview(body?: string | null, max = 140): string {
  const kind = classifyBody(body)
  if (kind !== 'normal') return `[${bodyKindLabel(kind)}]`
  const s = String(body ?? '').replace(/\s+/g, ' ').trim()
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
