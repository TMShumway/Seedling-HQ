import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { centsToDollars, dollarsToCents } from '@/lib/format';
import type { ServiceCategoryResponse } from '@/lib/api-client';

const UNIT_TYPE_OPTIONS = [
  { value: 'flat', label: 'Flat Fee' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'per_sqft', label: 'Per Sq Ft' },
  { value: 'per_unit', label: 'Per Unit' },
  { value: 'per_visit', label: 'Per Visit' },
];

interface ServiceItemFormProps {
  initialData?: {
    name: string;
    description: string | null;
    unitPrice: number;
    unitType: string;
    estimatedDurationMinutes: number | null;
  };
  categoryId?: string;
  categories?: ServiceCategoryResponse[];
  onSave: (data: {
    categoryId: string;
    name: string;
    description: string | null;
    unitPrice: number;
    unitType: string;
    estimatedDurationMinutes: number | null;
  }) => void;
  onCancel: () => void;
  saving?: boolean;
}

export function ServiceItemForm({
  initialData,
  categoryId: fixedCategoryId,
  categories,
  onSave,
  onCancel,
  saving,
}: ServiceItemFormProps) {
  const [categoryId, setCategoryId] = useState(fixedCategoryId ?? '');
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [priceDollars, setPriceDollars] = useState(
    initialData ? centsToDollars(initialData.unitPrice).toFixed(2) : '',
  );
  const [unitType, setUnitType] = useState(initialData?.unitType ?? 'flat');
  const [duration, setDuration] = useState(
    initialData?.estimatedDurationMinutes?.toString() ?? '',
  );

  const handleSave = () => {
    const targetCategoryId = fixedCategoryId ?? categoryId;
    if (!name.trim() || !targetCategoryId) return;
    const priceNum = parseFloat(priceDollars);
    if (isNaN(priceNum) || priceNum < 0) return;

    onSave({
      categoryId: targetCategoryId,
      name: name.trim(),
      description: description.trim() || null,
      unitPrice: dollarsToCents(priceNum),
      unitType,
      estimatedDurationMinutes: duration ? parseInt(duration, 10) : null,
    });
  };

  const isValid = name.trim() && (fixedCategoryId || categoryId) && priceDollars && parseFloat(priceDollars) >= 0;

  return (
    <div className="space-y-3 rounded-lg border border-border p-4" data-testid="service-item-form">
      {!fixedCategoryId && categories && (
        <div className="space-y-1">
          <Label htmlFor="service-category">Category</Label>
          <Select
            id="service-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Select a category...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="service-name">Service Name</Label>
        <Input
          id="service-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Weekly Mowing"
          maxLength={255}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="service-description">Description</Label>
        <Textarea
          id="service-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          maxLength={1000}
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="service-price">Price ($)</Label>
          <Input
            id="service-price"
            type="number"
            min="0"
            step="0.01"
            value={priceDollars}
            onChange={(e) => setPriceDollars(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="service-unit-type">Unit Type</Label>
          <Select
            id="service-unit-type"
            value={unitType}
            onChange={(e) => setUnitType(e.target.value)}
          >
            {UNIT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="service-duration">Est. Duration (minutes)</Label>
        <Input
          id="service-duration"
          type="number"
          min="1"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Optional"
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={!isValid || saving} size="sm">
          {saving ? 'Saving...' : initialData ? 'Update' : 'Add Service'}
        </Button>
        <Button onClick={onCancel} variant="outline" size="sm" disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
