import { Sheet, SheetContent } from '@/components/ui/sheet';
import { navItems } from './Sidebar';
import { cn } from '@/lib/utils';

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileDrawer({ open, onOpenChange }: MobileDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" onClose={() => onOpenChange(false)}>
        <div className="mb-6 mt-2">
          <span className="text-lg font-bold text-primary">Seedling</span>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.active ? item.href : undefined}
              onClick={() => item.active && onOpenChange(false)}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                item.active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground cursor-not-allowed opacity-50',
              )}
              aria-disabled={!item.active}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </a>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
