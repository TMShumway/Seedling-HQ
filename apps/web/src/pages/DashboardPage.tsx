import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

export function DashboardPage() {
  const tenantQuery = useQuery({
    queryKey: ['tenant', 'me'],
    queryFn: () => apiClient.getTenantMe(),
  });

  const userQuery = useQuery({
    queryKey: ['user', 'me'],
    queryFn: () => apiClient.getUserMe(),
  });

  const navigate = useNavigate();

  const settingsQuery = useQuery({
    queryKey: ['business-settings'],
    queryFn: () => apiClient.getBusinessSettings(),
  });

  if (tenantQuery.isLoading || userQuery.isLoading || settingsQuery.isLoading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (tenantQuery.error || userQuery.error) {
    return (
      <div className="text-destructive">
        Failed to load dashboard data. Please try again.
      </div>
    );
  }

  const tenant = tenantQuery.data;
  const user = userQuery.data;
  const settings = settingsQuery.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-sm text-muted-foreground">Name</span>
              <p className="font-medium" data-testid="tenant-name">{tenant?.name}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Slug</span>
              <p className="font-medium">{tenant?.slug}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-sm text-muted-foreground">Name</span>
              <p className="font-medium" data-testid="user-name">{user?.fullName}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Email</span>
              <p className="font-medium" data-testid="user-email">{user?.email}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Role</span>
              <p className="font-medium">{user?.role}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!settings ? (
        <Card data-testid="onboarding-cta">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-muted-foreground">
              Complete your business profile to get started with Seedling.
            </p>
            <Button onClick={() => navigate('/onboarding')}>
              Complete Business Profile
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card data-testid="settings-summary">
          <CardHeader>
            <CardTitle>Business Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            {settings.phone && (
              <div>
                <span className="text-muted-foreground">Phone:</span> {settings.phone}
              </div>
            )}
            {settings.city && settings.state && (
              <div>
                <span className="text-muted-foreground">Location:</span> {settings.city}, {settings.state}
              </div>
            )}
            {settings.timezone && (
              <div>
                <span className="text-muted-foreground">Time Zone:</span> {settings.timezone}
              </div>
            )}
            {settings.defaultDurationMinutes && (
              <div>
                <span className="text-muted-foreground">Default Duration:</span>{' '}
                {settings.defaultDurationMinutes} min
              </div>
            )}
            <div className="sm:col-span-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                Edit Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
