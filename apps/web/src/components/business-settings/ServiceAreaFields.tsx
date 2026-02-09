import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface ServiceAreaValues {
  serviceArea: string;
  defaultDurationMinutes: number;
}

interface ServiceAreaFieldsProps {
  values: ServiceAreaValues;
  onChange: (values: ServiceAreaValues) => void;
}

export function ServiceAreaFields({ values, onChange }: ServiceAreaFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="serviceArea">Service Area</Label>
        <Textarea
          id="serviceArea"
          value={values.serviceArea}
          onChange={(e) => onChange({ ...values, serviceArea: e.target.value })}
          placeholder="e.g., Springfield and surrounding areas (30 mile radius)"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="defaultDuration">Default Appointment Duration (minutes)</Label>
        <Input
          id="defaultDuration"
          type="number"
          min={15}
          max={480}
          step={15}
          value={values.defaultDurationMinutes}
          onChange={(e) =>
            onChange({ ...values, defaultDurationMinutes: parseInt(e.target.value, 10) || 60 })
          }
        />
      </div>
    </div>
  );
}
