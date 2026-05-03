import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WorkspaceProvider } from './lib/workspace'
import { ToastProvider } from './lib/toast'
import Shell from './components/layout/Shell'
import LiveFeed from './pages/LiveFeed'
import Conversations from './pages/Conversations'
import Contacts from './pages/Contacts'
import Pipeline from './pages/Pipeline'
import Settings from './pages/Settings'
import TrainAI from './pages/TrainAI'
import MasterPrompt from './pages/MasterPrompt'
import Workspaces from './pages/Workspaces'
import Analytics from './pages/Analytics'
import Calls from './pages/Calls'

/**
 * In a production deploy (Netlify), VITE_API_BASE must be set or every
 * fetch will hit the Netlify origin and 404. Show a clear setup screen
 * instead of leaving the user staring at an empty UI.
 */
function MissingApiBaseScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-lg w-full rounded-2xl border border-amber-500/30 bg-slate-900/70 backdrop-blur p-8 shadow-2xl">
        <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold mb-3">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Setup required
        </div>
        <h1 className="text-2xl font-bold mb-2 text-slate-100">Missing <code className="text-violet-300 text-base">VITE_API_BASE</code></h1>
        <p className="text-slate-400 mb-5 leading-relaxed text-sm">
          The frontend doesn't know which backend to talk to. Set the env var on Netlify and redeploy.
        </p>
        <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 mb-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">Add in Netlify → Site settings → Environment variables</div>
          <div className="space-y-2 font-mono text-[12px]">
            <div className="break-all"><span className="text-violet-300">VITE_API_BASE</span> <span className="text-slate-600">=</span> <span className="text-slate-200">&lt;your VPS / tunnel URL&gt;</span></div>
            <div><span className="text-violet-300">VITE_ADMIN_TOKEN</span> <span className="text-slate-600">=</span> <span className="text-slate-200">&lt;contents of /opt/fym-agent/.admin-token&gt;</span></div>
          </div>
          <div className="text-[10px] text-slate-500 mt-3 leading-relaxed">
            See <code className="text-slate-400">.env.local</code> in the repo for the current working values.
          </div>
        </div>
        <ol className="text-sm text-slate-300 space-y-1.5 list-decimal list-inside">
          <li>Add both vars above</li>
          <li>Deploys → Trigger deploy → <span className="font-medium">Clear cache and deploy site</span></li>
          <li>Wait ~30s, then hard-refresh this page</li>
        </ol>
      </div>
    </div>
  )
}

export default function App() {
  // Empty API base in prod = the build went out without VITE_API_BASE set.
  // (In dev, Vite proxies /api/* so empty base is fine — IS_DEV check.)
  const apiBase = import.meta.env.VITE_API_BASE ?? ''
  if (!import.meta.env.DEV && !apiBase) {
    return <MissingApiBaseScreen />
  }
  return (
    <WorkspaceProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/*"
              element={
                <Shell>
                  <Routes>
                    <Route path="/"               element={<LiveFeed />} />
                    <Route path="/conversations" element={<Conversations />} />
                    <Route path="/conversations/:contactId" element={<Conversations />} />
                    <Route path="/contacts"      element={<Contacts />} />
                    <Route path="/pipeline"      element={<Pipeline />} />
                    <Route path="/calls"         element={<Calls />} />
                    <Route path="/analytics"     element={<Analytics />} />
                    <Route path="/master-prompt" element={<MasterPrompt />} />
                    <Route path="/train-ai"      element={<TrainAI />} />
                    <Route path="/settings"      element={<Settings />} />
                    <Route path="/workspaces"    element={<Workspaces />} />
                    <Route path="*"              element={<Navigate to="/" replace />} />
                  </Routes>
                </Shell>
              }
            />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </WorkspaceProvider>
  )
}
