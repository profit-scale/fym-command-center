/**
 * API client. Reads VITE_API_BASE so the same build can talk to:
 *   - the Cloudflare tunnel during dev
 *   - api.fymfinancial.com (Caddy → VPS port 8080) in prod
 *
 * Admin endpoints require a bearer token (VITE_ADMIN_TOKEN), public endpoints
 * don't. We keep one client and only attach the bearer when the path starts
 * with /api/admin/.
 */

// In dev, Vite proxies /api/* to VITE_API_BASE so we avoid CORS noise — the
// browser sees same-origin. In prod the browser hits the absolute VITE_API_BASE
// directly (the backend must allow the deploy origin via CORS).
const IS_DEV = import.meta.env.DEV
const API_BASE = IS_DEV ? '' : (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '')
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN ?? ''

interface RequestOpts extends Omit<RequestInit, 'body'> {
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
}

export class ApiError extends Error {
  status: number
  body: string
  constructor(status: number, body: string, message: string) {
    super(message)
    this.status = status
    this.body = body
  }
}

function buildUrl(path: string, query?: RequestOpts['query']): string {
  const url = new URL((API_BASE || '') + path, API_BASE ? undefined : window.location.origin)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue
      url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

export async function api<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { body, query, headers, ...rest } = opts
  const isAdmin = path.startsWith('/api/admin')
  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(isAdmin && ADMIN_TOKEN ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {}),
    ...(headers as Record<string, string>),
  }
  const url = buildUrl(path, query)
  const res = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const ct = res.headers.get('content-type') ?? ''
  const text = await res.text()
  if (!res.ok) {
    throw new ApiError(res.status, text, `${res.status} ${res.statusText} — ${path}`)
  }
  if (ct.includes('application/json')) {
    return text ? (JSON.parse(text) as T) : (undefined as T)
  }
  return text as unknown as T
}

/** Fire-and-forget sub for live updates (Server-Sent Events). */
export function subscribeSSE(path: string, onEvent: (data: unknown) => void): () => void {
  const url = buildUrl(path)
  const src = new EventSource(url, { withCredentials: false })
  src.onmessage = (e) => {
    try { onEvent(JSON.parse(e.data)) } catch { /* ignore parse errors */ }
  }
  src.onerror = () => {
    // Browser will retry automatically; we just close on failure to free resources
    // and reconnect via React effect on remount.
    src.close()
  }
  return () => src.close()
}

export const apiBase = API_BASE
export const hasAdminToken = !!ADMIN_TOKEN
