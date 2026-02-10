import { useLocation } from 'react-router';
import {
  LayoutDashboard,
  Wrench,
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
  { label: 'Services', icon: Wrench, href: '/services', active: true },
  { label: 'Requests', icon: FileText, href: '/requests', active: true },
  { label: 'Clients', icon: Users, href: '/clients', active: true },
  { label: 'Quotes', icon: Calculator, href: '/quotes', active: true },
  { label: 'Schedule', icon: Calendar, href: '#', active: false },
  { label: 'Jobs', icon: Briefcase, href: '#', active: false },
  { label: 'Invoices', icon: Receipt, href: '#', active: false },
  { label: 'Settings', icon: Settings, href: '/settings', active: true },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-sidebar-border bg-sidebar-background">
      <div className="flex h-14 items-center border-b border-sidebar-border px-6">
        <span className="text-lg font-bold tracking-tight text-sidebar-primary">
          <span className="mr-1">🌱</span> Seedling HQ
        </span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isCurrent = item.active && location.pathname.startsWith(item.href);
          return (
            <a
              key={item.label}
              href={item.active ? item.href : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                !item.active && 'text-sidebar-foreground/30 cursor-not-allowed',
                item.active && isCurrent && 'border-l-[3px] border-l-sidebar-primary bg-sidebar-accent text-white font-semibold',
                item.active && !isCurrent && 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
              aria-disabled={!item.active}
              aria-current={isCurrent ? 'page' : undefined}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

export { navItems };
