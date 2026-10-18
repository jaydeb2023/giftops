import {
  LayoutDashboard, Users, Bot, LibraryBig, CreditCard, TrendingUp,
  Building2, Briefcase, Cpu, Mic, LineChart, Headphones, FileText,
  Bell, ShieldCheck, UserCog, ScrollText, Plug, Settings,
} from 'lucide-react'

export interface AdminNavItem {
  label: string
  href: string
  icon: any
  /** true = backed by real Supabase data today; false = placeholder page */
  live: boolean
}

export const ADMIN_NAV: AdminNavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, live: true },
  { label: 'Users', href: '/admin/users', icon: Users, live: true },
  { label: 'Agents', href: '/admin/agents', icon: Bot, live: true },
  { label: 'Agent Library', href: '/admin/agent-library', icon: LibraryBig, live: true },
  { label: 'Subscriptions', href: '/admin/subscriptions', icon: CreditCard, live: true },
  { label: 'Revenue', href: '/admin/revenue', icon: TrendingUp, live: true },
  { label: 'Organizations', href: '/admin/organizations', icon: Building2, live: false },
  { label: 'Enterprise', href: '/admin/enterprise', icon: Briefcase, live: false },
  { label: 'AI System', href: '/admin/ai-system', icon: Cpu, live: false },
  { label: 'Voice & AI Quality', href: '/admin/voice-quality', icon: Mic, live: false },
  { label: 'Analytics', href: '/admin/analytics', icon: LineChart, live: false },
  { label: 'Support Tickets', href: '/admin/support-tickets', icon: Headphones, live: false },
  { label: 'Content & Blog', href: '/admin/content', icon: FileText, live: false },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell, live: false },
  { label: 'Security', href: '/admin/security', icon: ShieldCheck, live: false },
  { label: 'Admin Users', href: '/admin/admin-users', icon: UserCog, live: true },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: ScrollText, live: true },
  { label: 'Integrations', href: '/admin/integrations', icon: Plug, live: false },
  { label: 'System Settings', href: '/admin/system-settings', icon: Settings, live: false },
]
