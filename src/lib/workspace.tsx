import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import type { HealthResponse, Workspace } from './types'

interface WorkspaceContextValue {
  workspaces: Record<string, Workspace>
  loading: boolean
  /** Current workspace slug (UI selection). */
  current: string
  /**
   * Monotonic counter that ticks every time the backend has been told to
   * switch workspaces. Pages should include this in fetch effects so they
   * re-load AFTER the engine has aligned with the UI selection.
   */
  syncStamp: number
  setCurrent: (slug: string) => Promise<void>
  refresh: () => Promise<void>
  health: HealthResponse | null
}

const WorkspaceCtx = createContext<WorkspaceContextValue | null>(null)
const STORAGE_KEY = 'fym.cc.workspace'

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [current, setCurrentState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) ?? 'hhc-hi-lead-gen'
  })
  const [syncStamp, setSyncStamp] = useState(0)

  async function refresh() {
    try {
      const data = await api<HealthResponse>('/api/admin/health')
      setHealth(data)
    } catch {
      setHealth(null)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Tell the engine to switch workspaces. Returns when the backend confirms,
   * so callers can rely on subsequent /api/prompts /api/contacts /api/messages
   * calls hitting the right DB.
   */
  async function switchBackend(slug: string) {
    try {
      await api('/api/workspaces/switch', { method: 'POST', body: { slug } })
    } catch {
      // Non-fatal — UI still updates locally; per-page load() also re-asserts.
    }
  }

  // On boot: sync engine to the persisted slug, then refresh health, then
  // bump syncStamp so pages re-fetch with the correct workspace.
  useEffect(() => {
    (async () => {
      await switchBackend(current)
      await refresh()
      setSyncStamp((s) => s + 1)
    })()
    const t = setInterval(refresh, 30_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function setCurrent(slug: string) {
    setCurrentState(slug)
    localStorage.setItem(STORAGE_KEY, slug)
    await switchBackend(slug)
    await refresh()
    setSyncStamp((s) => s + 1)
  }

  const value = useMemo<WorkspaceContextValue>(() => ({
    workspaces: health?.workspaces ?? {},
    loading,
    current,
    syncStamp,
    setCurrent,
    refresh,
    health,
  }), [health, loading, current, syncStamp])

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const v = useContext(WorkspaceCtx)
  if (!v) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return v
}
