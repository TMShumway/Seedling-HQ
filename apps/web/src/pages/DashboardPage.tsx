import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Building2, UserCircle, ClipboardList, Clock, Users } from 'lucide-react';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const ORDERED_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

function getTodayName() {
  return DAY_NAMES[new Date().getDay()];
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 p-6">
        <Skeleton className="h-8 w-64 bg-primary/10" />
        <Skeleton className="mt-2 h-5 w-48 bg-primary/10" />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

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

  const clientCountQuery = useQuery({
    queryKey: ['clients', 'count'],
    queryFn: () => apiClient.countClients(),
  });

  if (tenantQuery.isLoading || userQuery.isLoading || settingsQuery.isLoading || clientCountQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (tenantQuery.error || userQuery.error || settingsQuery.error || clientCountQuery.error) {
    return (
      <div className="text-destructive">
        Failed to load dashboard data. Please try again.
      </div>
    );
  }

  const tenant = tenantQuery.data;
  const user = userQuery.data;
  const settings = settingsQuery.data;
  const today = getTodayName();

  return (
    <div className="space-y-8">
      {/* Welcome header with gradient background */}
      <div className="rounded-xl bg-gradient-to-r from-primary/5 via-primary/8 to-transparent p-6">
        <h1 className="text-2xl font-bold">
          Welcome back, {user?.fullName?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here's an overview of {tenant?.name ?? 'your business'}.
        </p>
      </div>

      {/* Business & Owner Info */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="border-l-4 border-l-primary transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">Business Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</span>
              <p className="font-medium" data-testid="tenant-name">{tenant?.name}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Seedling Business ID</span>
              <p className="font-mono text-sm text-muted-foreground">{tenant?.slug}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-400 transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
              <UserCircle className="h-4 w-4 text-indigo-500" />
            </div>
            <CardTitle className="text-base">Owner Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</span>
              <p className="font-medium" data-testid="user-name">{user?.fullName}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</span>
              <p className="font-medium" data-testid="user-email">{user?.email}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</span>
              <p className="font-medium capitalize">{user?.role}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client count card */}
      <Card
        className="cursor-pointer border-l-4 border-l-violet-400 transition-shadow hover:shadow-md"
        onClick={() => navigate('/clients')}
      >
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50">
            <Users className="h-4 w-4 text-violet-500" />
          </div>
          <CardTitle className="text-base">Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold" data-testid="client-count">
            {clientCountQuery.data?.count ?? 0}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Active clients</p>
        </CardContent>
      </Card>

      {/* Settings / Onboarding */}
      {!settings ? (
        <Card data-testid="onboarding-cta" className="overflow-hidden border-dashed">
          <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
            <CardContent className="flex flex-col items-center gap-5 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 ring-4 ring-primary/5">
                <ClipboardList className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold">Complete your business profile</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                  Set up your hours, service area, and contact info to get started with Seedling.
                </p>
              </div>
              <Button size="lg" onClick={() => navigate('/onboarding')}>
                Get Started
              </Button>
            </CardContent>
          </div>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <Card data-testid="settings-summary" className="border-l-4 border-l-emerald-400 transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                </div>
                <CardTitle className="text-base">Business Profile</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                Edit
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {settings.phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">{settings.phone}</span>
                </div>
              )}
              {(settings.addressLine1 || settings.city) && (
                <div className="flex justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">Address</span>
                  <span className="text-right font-medium">
                    {[settings.addressLine1, settings.addressLine2, settings.city, settings.state, settings.zip]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              )}
              {settings.timezone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time Zone</span>
                  <span className="font-medium">{settings.timezone}</span>
                </div>
              )}
              {settings.defaultDurationMinutes && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Default Duration</span>
                  <span className="font-medium">{settings.defaultDurationMinutes} min</span>
                </div>
              )}
              {settings.serviceArea && (
                <div className="flex justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">Service Area</span>
                  <span className="text-right font-medium">{settings.serviceArea}</span>
                </div>
              )}
              {settings.description && (
                <>
                  <hr className="border-border/50" />
                  <div>
                    <span className="text-muted-foreground">Description</span>
                    <p className="mt-1 font-medium">{settings.description}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {settings.businessHours && (
            <Card className="border-l-4 border-l-amber-400 transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <CardTitle className="text-base">Business Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0.5 text-sm">
                  {ORDERED_DAYS.map((day) => {
                    const schedule = settings.businessHours![day];
                    const isToday = day === today;
                    return (
                      <div
                        key={day}
                        className={cn(
                          'flex justify-between rounded-md px-3 py-2 transition-colors',
                          isToday && 'bg-amber-50 font-semibold text-amber-900',
                          !isToday && schedule.closed && 'text-muted-foreground',
                        )}
                      >
                        <span className="capitalize">
                          {day}
                          {isToday && <span className="ml-2 text-xs font-normal text-amber-600">(Today)</span>}
                        </span>
                        <span>
                          {schedule.closed ? 'Closed' : `${schedule.open} – ${schedule.close}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
