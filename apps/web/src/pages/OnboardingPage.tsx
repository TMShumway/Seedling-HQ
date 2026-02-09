import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BusinessSettingsForm } from '@/components/business-settings/BusinessSettingsForm';
import { OnboardingWizard } from '@/components/business-settings/OnboardingWizard';
import { apiClient } from '@/lib/api-client';

type SetupMode = 'choose' | 'quick' | 'guided';

export function OnboardingPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SetupMode>('choose');

  const settingsQuery = useQuery({
    queryKey: ['business-settings'],
    queryFn: () => apiClient.getBusinessSettings(),
  });

  if (settingsQuery.isLoading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (settingsQuery.error) {
    return (
      <div className="text-destructive">Failed to load settings. Please try again.</div>
    );
  }

  // Already configured
  if (settingsQuery.data) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center" data-testid="already-configured">
        <h1 className="text-2xl font-bold">Business profile already configured</h1>
        <p className="text-muted-foreground">
          You can update your settings from the Settings page.
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => navigate('/settings')}>
            Go to Settings
          </Button>
          <Button onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Quick setup mode
  if (mode === 'quick') {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Quick Setup</h1>
          <Button variant="ghost" onClick={() => setMode('choose')}>
            Back
          </Button>
        </div>
        <BusinessSettingsForm onSubmitSuccess={() => navigate('/dashboard')} />
      </div>
    );
  }

  // Guided setup mode
  if (mode === 'guided') {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Guided Setup</h1>
          <Button variant="ghost" onClick={() => setMode('choose')}>
            Back
          </Button>
        </div>
        <OnboardingWizard onComplete={() => navigate('/dashboard')} />
      </div>
    );
  }

  // Choose mode
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Set Up Your Business Profile</h1>
        <p className="mt-2 text-muted-foreground">
          Configure your business hours, service area, and contact information.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2" data-testid="setup-choice">
        <Card
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => setMode('quick')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setMode('quick')}
          data-testid="quick-setup-card"
        >
          <CardHeader>
            <CardTitle>Quick Setup</CardTitle>
            <CardDescription>Fill out everything on one page</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Best if you have all your info ready. Takes about 2 minutes.
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => setMode('guided')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setMode('guided')}
          data-testid="guided-setup-card"
        >
          <CardHeader>
            <CardTitle>Guided Setup</CardTitle>
            <CardDescription>Step-by-step wizard</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Walk through each section one at a time. Great for first-time setup.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
