import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react'

export type ToastTone = 'info' | 'success' | 'warning' | 'danger'

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
  ttl: number
}

interface ToastCtx {
  push: (message: string, tone?: ToastTone) => void
}

const Ctx = createContext<ToastCtx | null>(null)

let nextId = 1

const TONE_MAP: Record<ToastTone, { icon: typeof Info; ring: string; text: string }> = {
  info:    { icon: Info,           ring: 'border-sky-500/30 bg-sky-500/10',     text: 'text-sky-100' },
  success: { icon: CheckCircle2,   ring: 'border-emerald-500/30 bg-emerald-500/10', text: 'text-emerald-100' },
  warning: { icon: AlertTriangle,  ring: 'border-amber-500/30 bg-amber-500/10', text: 'text-amber-100' },
  danger:  { icon: XCircle,        ring: 'border-red-500/30 bg-red-500/10',     text: 'text-red-100' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId++
    setItems((prev) => {
      const next = [...prev, { id, tone, message, ttl: 5000 }]
      // Cap visible toasts so the corner doesn't get spammed during SSE bursts.
      return next.slice(-3)
    })
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-none">
        {items.map((t) => {
          const cfg = TONE_MAP[t.tone]
          const Icon = cfg.icon
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 max-w-sm rounded-xl border ${cfg.ring} backdrop-blur px-4 py-3 shadow-2xl shadow-black/40 animate-slide-in`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.text}`} />
              <div className={`text-xs leading-relaxed flex-1 ${cfg.text}`}>{t.message}</div>
              <button
                onClick={() => setItems((prev) => prev.filter((i) => i.id !== t.id))}
                className="text-slate-400 hover:text-slate-200 transition shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast must be used inside <ToastProvider>')
  return v
}
