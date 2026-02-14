import { Pencil, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice, formatUnitType } from '@/lib/format';
import type { ServiceItemResponse } from '@/lib/api-types';

interface ServiceItemRowProps {
  item: ServiceItemResponse;
  onEdit: () => void;
  onDelete: () => void;
}

export function ServiceItemRow({ item, onEdit, onDelete }: ServiceItemRowProps) {
  return (
    <div
      className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-4 py-3"
      data-testid="service-item-row"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{item.name}</span>
          {!item.active && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              Inactive
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {formatPrice(item.unitPrice)} / {formatUnitType(item.unitType)}
          </span>
          {item.estimatedDurationMinutes && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {item.estimatedDurationMinutes} min
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
        )}
      </div>
      <div className="ml-2 flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit service">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete service">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
