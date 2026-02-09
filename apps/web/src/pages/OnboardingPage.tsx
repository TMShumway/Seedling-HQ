import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BusinessSettingsForm } from '@/components/business-settings/BusinessSettingsForm';
import { OnboardingWizard } from '@/components/business-settings/OnboardingWizard';
import { apiClient } from '@/lib/api-client';
import { Zap, BookOpen, CheckCircle2 } from 'lucide-react';

type SetupMode = 'choose' | 'quick' | 'guided';

export function OnboardingPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SetupMode>('choose');

  const settingsQuery = useQuery({
    queryKey: ['business-settings'],
    queryFn: () => apiClient.getBusinessSettings(),
  });

  if (settingsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-8 w-64" />
          <Skeleton className="mx-auto h-5 w-80" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      </div>
    );
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
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
        </div>
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
          <div>
            <h1 className="text-2xl font-bold">Quick Setup</h1>
            <p className="mt-1 text-muted-foreground">Fill in your details all at once.</p>
          </div>
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
          <div>
            <h1 className="text-2xl font-bold">Guided Setup</h1>
            <p className="mt-1 text-muted-foreground">We'll walk you through each section.</p>
          </div>
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
          className="cursor-pointer border-2 border-transparent transition-all hover:border-primary/30 hover:shadow-md"
          onClick={() => setMode('quick')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setMode('quick')}
          data-testid="quick-setup-card"
        >
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
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
          className="cursor-pointer border-2 border-transparent transition-all hover:border-primary/30 hover:shadow-md"
          onClick={() => setMode('guided')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setMode('guided')}
          data-testid="guided-setup-card"
        >
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
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
