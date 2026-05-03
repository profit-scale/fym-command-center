import { useState, type ReactNode } from 'react'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Shell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar — always visible at md+ */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative flex">
            <Sidebar />
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute -right-12 top-3 p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-slate-100"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden border-b border-slate-800/60 bg-slate-950/40 backdrop-blur px-4 h-12 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-2 rounded-lg text-slate-300 hover:text-slate-100 hover:bg-slate-800/60 transition"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-xs font-semibold tracking-tight bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
            FYM · COMMAND CENTER
          </span>
          <span className="w-9" /> {/* spacer to balance the menu button */}
        </div>
        <Topbar />
        <main className="flex-1 px-4 md:px-8 py-4 md:py-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
