import { useQuery } from '@tanstack/react-query';
import { BusinessSettingsForm } from '@/components/business-settings/BusinessSettingsForm';
import { apiClient } from '@/lib/api-client';

export function SettingsPage() {
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

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Business Settings</h1>
      <BusinessSettingsForm initialData={settingsQuery.data} />
    </div>
  );
}
