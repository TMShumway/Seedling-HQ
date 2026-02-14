import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BusinessInfoFields, type BusinessInfoValues } from './BusinessInfoFields';
import { BusinessHoursEditor } from './BusinessHoursEditor';
import { ServiceAreaFields, type ServiceAreaValues } from './ServiceAreaFields';
import { apiClient } from '@/lib/api-client';
import type { BusinessSettingsResponse, BusinessHoursResponse } from '@/lib/api-types';
import { DEFAULT_BUSINESS_HOURS, DEFAULT_TIMEZONE, DEFAULT_DURATION_MINUTES } from '@/lib/defaults';

const STEPS = [
  { title: 'Business Info', description: 'Contact details and address' },
  { title: 'Hours', description: 'Set your business hours' },
  { title: 'Service Defaults', description: 'Service area and appointment duration' },
  { title: 'Review & Submit', description: 'Confirm your settings' },
];

interface OnboardingWizardProps {
  initialData?: BusinessSettingsResponse | null;
  onComplete: () => void;
}

export function OnboardingWizard({ initialData, onComplete }: OnboardingWizardProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [info, setInfo] = useState<BusinessInfoValues>({
    phone: initialData?.phone ?? '',
    addressLine1: initialData?.addressLine1 ?? '',
    addressLine2: initialData?.addressLine2 ?? '',
    city: initialData?.city ?? '',
    state: initialData?.state ?? '',
    zip: initialData?.zip ?? '',
    timezone: initialData?.timezone ?? DEFAULT_TIMEZONE,
    description: initialData?.description ?? '',
  });
  const [hours, setHours] = useState<BusinessHoursResponse>(
    initialData?.businessHours ?? DEFAULT_BUSINESS_HOURS,
  );
  const [service, setService] = useState<ServiceAreaValues>({
    serviceArea: initialData?.serviceArea ?? '',
    defaultDurationMinutes: initialData?.defaultDurationMinutes ?? DEFAULT_DURATION_MINUTES,
  });

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
      onComplete();
    },
  });

  function handleComplete() {
    mutation.mutate();
  }

  return (
    <div className="space-y-6" data-testid="onboarding-wizard">
      {/* Step indicator */}
      <nav aria-label="Onboarding steps" className="flex justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                i === step
                  ? 'bg-primary text-primary-foreground'
                  : i < step
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}
              aria-current={i === step ? 'step' : undefined}
            >
              {i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`hidden h-0.5 w-6 sm:block ${i < step ? 'bg-primary/40' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </nav>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[step].title}</CardTitle>
            <CardDescription>{STEPS[step].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {mutation.error && (
              <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {mutation.error instanceof Error ? mutation.error.message : 'Failed to save.'}
              </div>
            )}

            {step === 0 && <BusinessInfoFields values={info} onChange={setInfo} />}
            {step === 1 && <BusinessHoursEditor hours={hours} onChange={setHours} />}
            {step === 2 && <ServiceAreaFields values={service} onChange={setService} />}
            {step === 3 && (
              <div className="space-y-4 text-sm" data-testid="review-summary">
                <div>
                  <span className="font-medium text-muted-foreground">Phone:</span>{' '}
                  {info.phone || 'Not set'}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Address:</span>{' '}
                  {[info.addressLine1, info.city, info.state, info.zip].filter(Boolean).join(', ') ||
                    'Not set'}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Time Zone:</span>{' '}
                  {info.timezone || 'Not set'}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Default Duration:</span>{' '}
                  {service.defaultDurationMinutes} minutes
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Service Area:</span>{' '}
                  {service.serviceArea || 'Not set'}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Description:</span>{' '}
                  {info.description || 'Not set'}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
            >
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            ) : (
              <Button type="button" onClick={handleComplete} disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Complete Setup'}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
