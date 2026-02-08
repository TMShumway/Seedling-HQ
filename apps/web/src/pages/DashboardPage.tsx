import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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

  if (tenantQuery.isLoading || userQuery.isLoading) {
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

      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Complete onboarding to get started
        </CardContent>
      </Card>
    </div>
  );
}
