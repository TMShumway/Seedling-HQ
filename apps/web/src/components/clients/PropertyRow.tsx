import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Pencil, Trash2 } from 'lucide-react';
import { formatAddress } from '@/lib/format';
import type { PropertyResponse, UpdatePropertyRequest } from '@/lib/api-client';
import { PropertyForm } from './PropertyForm';

interface PropertyRowProps {
  property: PropertyResponse;
  onEdit: (data: UpdatePropertyRequest) => void;
  onDelete: () => void;
  saving?: boolean;
}

export function PropertyRow({ property, onEdit, onDelete, saving }: PropertyRowProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <PropertyForm
        property={property}
        onSave={(data) => {
          onEdit(data);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
        saving={saving}
      />
    );
  }

  return (
    <div
      className="flex items-start justify-between gap-4 rounded-md border border-border p-3"
      data-testid="property-row"
    >
      <div className="flex items-start gap-3 min-w-0">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{formatAddress(property)}</p>
          {property.notes && (
            <p className="mt-1 text-xs text-muted-foreground">{property.notes}</p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setEditing(true)}
          aria-label="Edit property"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          aria-label="Delete property"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
