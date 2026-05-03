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
import Workspaces from './pages/Workspaces'

export default function App() {
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
