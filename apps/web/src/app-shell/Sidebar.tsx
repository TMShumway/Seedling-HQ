import {
  LayoutDashboard,
  FileText,
  Users,
  Calculator,
  Calendar,
  Briefcase,
  Receipt,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', active: true },
  { label: 'Requests', icon: FileText, href: '#', active: false },
  { label: 'Clients', icon: Users, href: '#', active: false },
  { label: 'Quotes', icon: Calculator, href: '#', active: false },
  { label: 'Schedule', icon: Calendar, href: '#', active: false },
  { label: 'Jobs', icon: Briefcase, href: '#', active: false },
  { label: 'Invoices', icon: Receipt, href: '#', active: false },
  { label: 'Settings', icon: Settings, href: '#', active: false },
];

export function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-sidebar-border bg-sidebar-background">
      <div className="flex h-14 items-center border-b border-sidebar-border px-6">
        <span className="text-lg font-bold text-sidebar-primary">Seedling</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.active ? item.href : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              item.active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground cursor-not-allowed opacity-50',
            )}
            aria-disabled={!item.active}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}

export { navItems };
