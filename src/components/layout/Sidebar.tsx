'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Building2, UserPlus, Users, KanbanSquare,
  CheckSquare, Zap, Search, LogOut, ChevronUp, User, Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AppRole } from '@/types'

export type Page =
  | 'dashboard'
  | 'leads'
  | 'prospecting'
  | 'prospecting-history'
  | 'companies'
  | 'contacts'
  | 'pipeline'
  | 'tasks'

const NAV_ITEMS: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: UserPlus },
  { id: 'prospecting', label: 'Prospecting', icon: Send },
  { id: 'companies', label: 'Companies', icon: Building2 },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'pipeline', label: 'Pipeline', icon: KanbanSquare },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
]

interface SidebarProps {
  page: Page
  onNav: (page: Page) => void
  onSignOut: () => void
  role: AppRole
  userName: string
}

export function Sidebar({ page, onNav, onSignOut, role, userName }: SidebarProps) {
  const [showPopover, setShowPopover] = useState(false)

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col border-r bg-card/95 h-full shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <span className="block font-semibold text-sm tracking-tight">RidgeTheory</span>
          <span className="text-xs text-muted-foreground">Revenue workspace</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNav(id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              page === id || (id === 'prospecting' && page === 'prospecting-history')
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {/* User popover */}
      <div className="px-3 pb-4 relative">
        {showPopover && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-popover border rounded-xl shadow-lg p-1 z-50">
            <button
              onClick={() => { onSignOut(); setShowPopover(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
        <button
          onClick={() => setShowPopover((v) => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-muted/30 hover:bg-muted transition-colors"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-medium truncate">{userName}</p>
            <p className="text-[11px] capitalize text-muted-foreground">{role}</p>
          </div>
          <ChevronUp className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', !showPopover && 'rotate-180')} />
        </button>
      </div>
    </aside>
  )
}

// ── TopBar ─────────────────────────────────────────────────────
interface TopBarProps {
  title: string
  onSearch: () => void
}

export function TopBar({ title, onSearch }: TopBarProps) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b bg-card/80 backdrop-blur flex-shrink-0 h-16">
      <div>
        <span className="text-sm font-medium">{title}</span>
        <p className="text-xs text-muted-foreground">Manage your customer pipeline</p>
      </div>
      <Button
        onClick={onSearch}
        variant="outline"
        size="sm"
        className="w-56 justify-start text-muted-foreground"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search</span>
        <kbd className="ml-auto font-mono text-[10px] bg-muted border rounded px-1">Ctrl K</kbd>
      </Button>
    </header>
  )
}
