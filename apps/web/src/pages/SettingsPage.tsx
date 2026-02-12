import { useQuery } from '@tanstack/react-query';
import { BusinessSettingsForm } from '@/components/business-settings/BusinessSettingsForm';
import { ChangePasswordForm } from '@/components/settings/ChangePasswordForm';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';

export function SettingsPage() {
  const settingsQuery = useQuery({
    queryKey: ['business-settings'],
    queryFn: () => apiClient.getBusinessSettings(),
  });

  if (settingsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (settingsQuery.error) {
    return (
      <div className="text-destructive">Failed to load settings. Please try again.</div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Business Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your contact info, business hours, and service defaults.
        </p>
      </div>
      <BusinessSettingsForm initialData={settingsQuery.data} />
      <ChangePasswordForm />
    </div>
  );
}
