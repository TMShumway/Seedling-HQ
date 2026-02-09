import { useLocation } from 'react-router';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { navItems } from './Sidebar';
import { cn } from '@/lib/utils';

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileDrawer({ open, onOpenChange }: MobileDrawerProps) {
  const location = useLocation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" onClose={() => onOpenChange(false)} className="bg-sidebar-background border-sidebar-border text-sidebar-foreground">
        <div className="mb-6 mt-2">
          <span className="text-lg font-bold tracking-tight text-sidebar-primary">
            <span className="mr-1">🌱</span> Seedling HQ
          </span>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isCurrent = item.active && location.pathname.startsWith(item.href);
            return (
              <a
                key={item.label}
                href={item.active ? item.href : undefined}
                onClick={() => item.active && onOpenChange(false)}
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
      </SheetContent>
    </Sheet>
  );
}
