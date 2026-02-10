import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { LineItemData } from './LineItemRow';

interface ServiceItemPickerProps {
  onSelect: (item: LineItemData) => void;
}

export function ServiceItemPicker({ onSelect }: ServiceItemPickerProps) {
  const categoriesQuery = useQuery({
    queryKey: ['serviceCategories'],
    queryFn: () => apiClient.listServiceCategories(),
  });

  const itemsQuery = useQuery({
    queryKey: ['serviceItems'],
    queryFn: () => apiClient.listServiceItems(),
  });

  const categories = categoriesQuery.data ?? [];
  const items = itemsQuery.data ?? [];

  if (categories.length === 0 || items.length === 0) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const itemId = e.target.value;
    if (!itemId) return;

    const svc = items.find((i) => i.id === itemId);
    if (!svc) return;

    onSelect({
      serviceItemId: svc.id,
      description: svc.name,
      quantity: 1,
      unitPrice: svc.unitPrice,
    });

    e.target.value = '';
  };

  // Group items by category
  const grouped = categories
    .filter((c) => items.some((i) => i.categoryId === c.id))
    .map((c) => ({
      category: c,
      items: items.filter((i) => i.categoryId === c.id),
    }));

  return (
    <select
      onChange={handleChange}
      defaultValue=""
      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      data-testid="service-item-picker"
    >
      <option value="">Add from catalog...</option>
      {grouped.map(({ category, items: groupItems }) => (
        <optgroup key={category.id} label={category.name}>
          {groupItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} — ${(item.unitPrice / 100).toFixed(2)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
