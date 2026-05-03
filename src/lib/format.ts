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
  // GHL stores tags two ways: JSON array string '["a","b"]' OR comma-separated 'a,b'.
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.filter((t: unknown): t is string => typeof t === 'string')
    } catch { /* fall through */ }
  }
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean)
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
