import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { BusinessHoursResponse, DaySchedule } from '@/lib/api-client';

const DAYS: { key: keyof BusinessHoursResponse; label: string }[] = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

interface BusinessHoursEditorProps {
  hours: BusinessHoursResponse;
  onChange: (hours: BusinessHoursResponse) => void;
}

export function BusinessHoursEditor({ hours, onChange }: BusinessHoursEditorProps) {
  function updateDay(day: keyof BusinessHoursResponse, patch: Partial<DaySchedule>) {
    onChange({
      ...hours,
      [day]: { ...hours[day], ...patch },
    });
  }

  return (
    <div className="space-y-3">
      <div className="hidden sm:grid sm:grid-cols-[80px_1fr_1fr_80px] sm:gap-2 text-xs font-medium text-muted-foreground">
        <span>Day</span>
        <span>Open</span>
        <span>Close</span>
        <span>Closed</span>
      </div>
      {DAYS.map(({ key, label }) => {
        const day = hours[key];
        return (
          <div
            key={key}
            className="grid grid-cols-[80px_1fr_1fr_80px] items-center gap-2"
          >
            <Label className="text-sm font-medium" htmlFor={`${key}-open`}>
              {label}
            </Label>
            <Input
              id={`${key}-open`}
              type="time"
              value={day.open ?? ''}
              onChange={(e) => updateDay(key, { open: e.target.value || null })}
              disabled={day.closed}
              aria-label={`${label} open time`}
            />
            <Input
              id={`${key}-close`}
              type="time"
              value={day.close ?? ''}
              onChange={(e) => updateDay(key, { close: e.target.value || null })}
              disabled={day.closed}
              aria-label={`${label} close time`}
            />
            <div className="flex items-center justify-center gap-1.5">
              <Checkbox
                id={`${key}-closed`}
                checked={day.closed}
                onChange={(e) =>
                  updateDay(key, {
                    closed: e.target.checked,
                    ...(e.target.checked ? { open: null, close: null } : {}),
                  })
                }
                aria-label={`${label} closed`}
              />
              <Label htmlFor={`${key}-closed`} className="text-xs sm:hidden">
                Off
              </Label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
