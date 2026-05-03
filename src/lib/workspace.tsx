import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import type { HealthResponse, Workspace } from './types'

interface WorkspaceContextValue {
  workspaces: Record<string, Workspace>
  loading: boolean
  current: string
  setCurrent: (slug: string) => void
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

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 30_000)
    return () => clearInterval(t)
  }, [])

  function setCurrent(slug: string) {
    setCurrentState(slug)
    localStorage.setItem(STORAGE_KEY, slug)
  }

  const value = useMemo<WorkspaceContextValue>(() => ({
    workspaces: health?.workspaces ?? {},
    loading,
    current,
    setCurrent,
    refresh,
    health,
  }), [health, loading, current])

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const v = useContext(WorkspaceCtx)
  if (!v) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return v
}
