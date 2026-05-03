import { NavLink } from 'react-router-dom'
import {
  Activity,
  MessageSquare,
  Users,
  Columns3,
  Settings,
  GraduationCap,
  Building2,
  Code2,
  BarChart3,
  PhoneCall,
  type LucideIcon,
} from 'lucide-react'

interface Item { to: string; label: string; icon: LucideIcon; end?: boolean }
interface Section { label?: string; items: Item[] }

const NAV: Section[] = [
  {
    items: [
      { to: '/',              label: 'Live Feed',      icon: Activity, end: true },
      { to: '/conversations', label: 'Conversations',  icon: MessageSquare },
      { to: '/contacts',      label: 'Contacts',       icon: Users },
      { to: '/pipeline',      label: 'Pipeline',       icon: Columns3 },
      { to: '/calls',         label: 'Voice calls',    icon: PhoneCall },
      { to: '/analytics',     label: 'Analytics',      icon: BarChart3 },
    ],
  },
  {
    label: 'AI brain',
    items: [
      { to: '/master-prompt', label: 'Master Prompt',  icon: Code2 },
      { to: '/train-ai',      label: 'Train AI',       icon: GraduationCap },
    ],
  },
  {
    label: 'Configure',
    items: [
      { to: '/settings',   label: 'Settings',  icon: Settings },
      { to: '/workspaces', label: 'Workspaces', icon: Building2 },
    ],
  },
]

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-slate-800/60 bg-slate-950/40 backdrop-blur flex flex-col">
      {/* Logo */}
      <div className="px-6 pt-6 pb-7">
        <div className="flex flex-col">
          <span className="text-xl font-semibold tracking-tight bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
            FYM
          </span>
          <span className="mt-0.5 text-[10px] tracking-[0.3em] text-indigo-400/80 font-medium">
            COMMAND CENTER
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-4 overflow-y-auto">
        {NAV.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {section.label && (
              <div className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-[0.18em] text-slate-600 font-medium">
                {section.label}
              </div>
            )}
            {section.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition',
                    isActive
                      ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent',
                  ].join(' ')
                }
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-slate-800/60">
        <p className="text-[10px] text-slate-600 leading-relaxed">
          FYM Command Center · v0.4<br />
          fym-cs.netlify.app
        </p>
      </div>
    </aside>
  )
}
