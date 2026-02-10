import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatPrice, centsToDollars, dollarsToCents } from '@/lib/format';

export interface LineItemData {
  serviceItemId: string | null;
  description: string;
  quantity: number;
  unitPrice: number; // cents
}

interface LineItemRowProps {
  item: LineItemData;
  index: number;
  onChange: (index: number, item: LineItemData) => void;
  onRemove: (index: number) => void;
  readOnly?: boolean;
}

export function LineItemRow({ item, index, onChange, onRemove, readOnly }: LineItemRowProps) {
  const total = item.quantity * item.unitPrice;

  return (
    <div className="grid grid-cols-[1fr_80px_100px_80px_40px] items-center gap-2" data-testid="line-item-row">
      <Input
        value={item.description}
        onChange={(e) => onChange(index, { ...item, description: e.target.value })}
        placeholder="Description"
        disabled={readOnly}
        data-testid="line-item-description"
      />
      <Input
        type="number"
        value={item.quantity}
        onChange={(e) => onChange(index, { ...item, quantity: Number(e.target.value) })}
        min={1}
        step={1}
        disabled={readOnly}
        data-testid="line-item-quantity"
      />
      <Input
        type="number"
        value={centsToDollars(item.unitPrice)}
        onChange={(e) => onChange(index, { ...item, unitPrice: dollarsToCents(Number(e.target.value)) })}
        min={0}
        step={0.01}
        disabled={readOnly}
        data-testid="line-item-unitprice"
      />
      <span className="text-right text-sm font-medium">{formatPrice(total)}</span>
      {!readOnly && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          data-testid="remove-line-item"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
