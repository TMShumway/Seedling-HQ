import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface CategoryFormProps {
  initialData?: { name: string; description: string | null };
  onSave: (data: { name: string; description: string | null }) => void;
  onCancel: () => void;
  saving?: boolean;
}

export function CategoryForm({ initialData, onSave, onCancel, saving }: CategoryFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim() || null });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-4" data-testid="category-form">
      <div className="space-y-1">
        <Label htmlFor="category-name">Category Name</Label>
        <Input
          id="category-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Lawn Care"
          maxLength={255}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="category-description">Description</Label>
        <Textarea
          id="category-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          maxLength={1000}
          rows={2}
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={!name.trim() || saving} size="sm">
          {saving ? 'Saving...' : initialData ? 'Update' : 'Add Category'}
        </Button>
        <Button onClick={onCancel} variant="outline" size="sm" disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
