import { useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BusinessInfoFields, type BusinessInfoValues } from './BusinessInfoFields';
import { BusinessHoursEditor } from './BusinessHoursEditor';
import { ServiceAreaFields, type ServiceAreaValues } from './ServiceAreaFields';
import { apiClient, type BusinessSettingsResponse, type BusinessHoursResponse } from '@/lib/api-client';
import { DEFAULT_BUSINESS_HOURS, DEFAULT_TIMEZONE, DEFAULT_DURATION_MINUTES } from '@/lib/defaults';

interface BusinessSettingsFormProps {
  initialData?: BusinessSettingsResponse | null;
  onSubmitSuccess?: () => void;
}

function toInfoValues(data?: BusinessSettingsResponse | null): BusinessInfoValues {
  return {
    phone: data?.phone ?? '',
    addressLine1: data?.addressLine1 ?? '',
    addressLine2: data?.addressLine2 ?? '',
    city: data?.city ?? '',
    state: data?.state ?? '',
    zip: data?.zip ?? '',
    timezone: data?.timezone ?? DEFAULT_TIMEZONE,
    description: data?.description ?? '',
  };
}

function toHoursValues(data?: BusinessSettingsResponse | null): BusinessHoursResponse {
  return data?.businessHours ?? DEFAULT_BUSINESS_HOURS;
}

function toServiceValues(data?: BusinessSettingsResponse | null): ServiceAreaValues {
  return {
    serviceArea: data?.serviceArea ?? '',
    defaultDurationMinutes: data?.defaultDurationMinutes ?? DEFAULT_DURATION_MINUTES,
  };
}

export function BusinessSettingsForm({ initialData, onSubmitSuccess }: BusinessSettingsFormProps) {
  const queryClient = useQueryClient();
  const [info, setInfo] = useState<BusinessInfoValues>(() => toInfoValues(initialData));
  const [hours, setHours] = useState<BusinessHoursResponse>(() => toHoursValues(initialData));
  const [service, setService] = useState<ServiceAreaValues>(() => toServiceValues(initialData));
  const [successMsg, setSuccessMsg] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.upsertBusinessSettings({
        phone: info.phone || null,
        addressLine1: info.addressLine1 || null,
        addressLine2: info.addressLine2 || null,
        city: info.city || null,
        state: info.state || null,
        zip: info.zip || null,
        timezone: info.timezone || null,
        businessHours: hours,
        serviceArea: service.serviceArea || null,
        defaultDurationMinutes: service.defaultDurationMinutes,
        description: info.description || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-settings'] });
      setSuccessMsg('Settings saved successfully.');
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
      onSubmitSuccess?.();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSuccessMsg('');
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="settings-form">
      {mutation.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {mutation.error instanceof Error ? mutation.error.message : 'Failed to save settings.'}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-lg border border-green-300 bg-green-50 p-4 shadow-md" role="status">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-green-700" />
          <span className="text-base font-semibold text-green-800">{successMsg}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
        </CardHeader>
        <CardContent>
          <BusinessInfoFields values={info} onChange={setInfo} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <BusinessHoursEditor hours={hours} onChange={setHours} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service Defaults</CardTitle>
        </CardHeader>
        <CardContent>
          <ServiceAreaFields values={service} onChange={setService} />
        </CardContent>
      </Card>

      <Button type="submit" className="w-full sm:w-auto" disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving...' : 'Save Settings'}
      </Button>
    </form>
  );
}
