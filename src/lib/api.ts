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
const WORKSPACE_STORAGE_KEY = 'fym.cc.workspace'

/**
 * Read the current workspace slug from localStorage. The single source of
 * truth is set by WorkspaceProvider, but reading directly avoids a circular
 * dep between api.ts and workspace.tsx. We send it as `X-Workspace` on every
 * API request so the engine pins the workspace per request and we don't bleed
 * one tab's data into another's. Engine-side middleware (added 2026-05-04)
 * calls db.switchTo() based on this header before every handler runs.
 */
function currentWorkspace(): string {
  try {
    return localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? 'hhc-hi-lead-gen'
  } catch {
    return 'hhc-hi-lead-gen'
  }
}

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
    // Pin every request to the user's selected workspace so back-to-back calls
    // can't race through the engine's global db.switchTo() singleton state.
    'X-Workspace': currentWorkspace(),
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

/** Fire-and-forget sub for live updates (Server-Sent Events).
 *  EventSource can't set custom headers, so workspace pinning falls back to
 *  the ?workspace= query param the middleware also honors. */
export function subscribeSSE(path: string, onEvent: (data: unknown) => void): () => void {
  const sep = path.includes('?') ? '&' : '?'
  const url = buildUrl(path + sep + 'workspace=' + encodeURIComponent(currentWorkspace()))
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
