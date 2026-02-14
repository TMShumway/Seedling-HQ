import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { US_TIMEZONES } from '@/lib/defaults';

export interface BusinessInfoValues {
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  timezone: string;
  description: string;
}

interface BusinessInfoFieldsProps {
  values: BusinessInfoValues;
  onChange: (values: BusinessInfoValues) => void;
}

export function BusinessInfoFields({ values, onChange }: BusinessInfoFieldsProps) {
  function update(field: keyof BusinessInfoValues, value: string) {
    onChange({ ...values, [field]: value });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          value={values.phone}
          onChange={(e) => update('phone', e.target.value)}
          placeholder="(555) 123-4567"
        />
        <p className="text-xs text-muted-foreground">
          This number will be used for SMS notifications sent to you
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="addressLine1">Address</Label>
        <Input
          id="addressLine1"
          value={values.addressLine1}
          onChange={(e) => update('addressLine1', e.target.value)}
          placeholder="123 Main St"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="addressLine2">Address Line 2</Label>
        <Input
          id="addressLine2"
          value={values.addressLine2}
          onChange={(e) => update('addressLine2', e.target.value)}
          placeholder="Suite 100"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={values.city}
            onChange={(e) => update('city', e.target.value)}
            placeholder="Springfield"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            value={values.state}
            onChange={(e) => update('state', e.target.value)}
            placeholder="IL"
            maxLength={2}
          />
        </div>
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label htmlFor="zip">ZIP</Label>
          <Input
            id="zip"
            value={values.zip}
            onChange={(e) => update('zip', e.target.value)}
            placeholder="62701"
            maxLength={10}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="timezone">Time Zone</Label>
        <Select
          id="timezone"
          value={values.timezone}
          onChange={(e) => update('timezone', e.target.value)}
        >
          <option value="">Select a time zone</option>
          {US_TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Business Description</Label>
        <Textarea
          id="description"
          value={values.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Briefly describe your business..."
          rows={3}
        />
      </div>
    </div>
  );
}
