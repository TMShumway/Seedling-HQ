import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <span className="text-lg font-bold tracking-tight text-primary lg:hidden">
        <span className="mr-1">🌱</span> Seedling
      </span>
      <div className="flex-1" />
    </header>
  );
}
