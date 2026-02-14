import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CreatePropertyRequest, UpdatePropertyRequest, PropertyResponse } from '@/lib/api-types';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

interface PropertyFormProps {
  property?: PropertyResponse;
  onSave: (data: CreatePropertyRequest | UpdatePropertyRequest) => void;
  onCancel: () => void;
  saving?: boolean;
}

export function PropertyForm({ property, onSave, onCancel, saving }: PropertyFormProps) {
  const [addressLine1, setAddressLine1] = useState(property?.addressLine1 ?? '');
  const [addressLine2, setAddressLine2] = useState(property?.addressLine2 ?? '');
  const [city, setCity] = useState(property?.city ?? '');
  const [state, setState] = useState(property?.state ?? '');
  const [zip, setZip] = useState(property?.zip ?? '');
  const [notes, setNotes] = useState(property?.notes ?? '');

  const handleSave = () => {
    onSave({
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || null,
      city: city.trim() || null,
      state: state || null,
      zip: zip.trim() || null,
      notes: notes.trim() || null,
    });
  };

  const isValid = addressLine1.trim().length > 0;

  return (
    <div className="space-y-4 rounded-md border border-border p-4" data-testid="property-form">
      <div className="space-y-2">
        <Label htmlFor="addressLine1">Address Line 1 *</Label>
        <Input
          id="addressLine1"
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          placeholder="123 Main Street"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine2">Address Line 2</Label>
        <Input
          id="addressLine2"
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
          placeholder="Apt, Suite, etc."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <select
            id="state"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Select state</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">ZIP</Label>
          <Input
            id="zip"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="12345"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="propertyNotes">Notes</Label>
        <Textarea
          id="propertyNotes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Property notes..."
          rows={2}
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={!isValid || saving} size="sm">
          {property ? 'Update' : 'Add Property'}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving} size="sm">
          Cancel
        </Button>
      </div>
    </div>
  );
}
