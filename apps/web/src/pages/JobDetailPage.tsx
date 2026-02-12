import { useParams, useNavigate, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, User, MapPin, Calculator, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth/auth-context';

function JobStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    scheduled: 'bg-indigo-100 text-indigo-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-600',
  };

  const labels: Record<string, string> = {
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  );
}

function VisitStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    scheduled: 'bg-indigo-100 text-indigo-800',
    en_route: 'bg-yellow-100 text-yellow-800',
    started: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-600',
  };

  const labels: Record<string, string> = {
    scheduled: 'Scheduled',
    en_route: 'En Route',
    started: 'Started',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAssign = user?.role === 'owner' || user?.role === 'admin';

  const jobQuery = useQuery({
    queryKey: ['job', id],
    queryFn: () => apiClient.getJob(id!),
    enabled: !!id,
  });

  // Fetch users for assignment name resolution
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.listUsers(),
    staleTime: 5 * 60 * 1000,
  });

  const job = jobQuery.data;

  // Client info
  const clientQuery = useQuery({
    queryKey: ['client', job?.clientId],
    queryFn: () => apiClient.getClient(job!.clientId),
    enabled: !!job?.clientId,
  });

  // Property info
  const propertyQuery = useQuery({
    queryKey: ['properties', job?.clientId],
    queryFn: () => apiClient.listProperties(job!.clientId),
    enabled: !!job?.clientId,
  });

  const property = job?.propertyId
    ? propertyQuery.data?.find((p) => p.id === job.propertyId)
    : null;

  if (jobQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="job-detail-page">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (jobQuery.error || !job) {
    return (
      <div className="mx-auto max-w-3xl" data-testid="job-detail-page">
        <Button variant="ghost" onClick={() => navigate('/jobs')} className="mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Jobs
        </Button>
        <div className="text-destructive">Job not found.</div>
      </div>
    );
  }

  const visits = job.visits ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="job-detail-page">
      {/* Back link */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/jobs')} size="sm">
          <ArrowLeft className="h-4 w-4" />
          Back to Jobs
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold">{job.title}</h1>
        <JobStatusBadge status={job.status} />
      </div>

      {/* Client info */}
      {clientQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link to={`/clients/${clientQuery.data.id}`} className="text-sm font-medium text-primary hover:underline">
              {clientQuery.data.firstName} {clientQuery.data.lastName}
            </Link>
            {clientQuery.data.email && (
              <p className="mt-0.5 text-sm text-muted-foreground">{clientQuery.data.email}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Property info */}
      {property && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              Property
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{property.addressLine1}</p>
            {property.addressLine2 && <p className="text-sm">{property.addressLine2}</p>}
            {(property.city || property.state || property.zip) && (
              <p className="text-sm text-muted-foreground">
                {[property.city, property.state, property.zip].filter(Boolean).join(', ')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quote link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4" />
            Source Quote
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Link to={`/quotes/${job.quoteId}`} className="text-sm text-primary hover:underline">
            View quote
          </Link>
        </CardContent>
      </Card>

      {/* Visits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Visits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {visits.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No visits yet.
            </p>
          ) : (
            visits.map((visit) => {
              const assignedUser = visit.assignedUserId
                ? usersQuery.data?.users.find((u) => u.id === visit.assignedUserId)
                : null;

              return (
                <div
                  key={visit.id}
                  className="rounded-lg border border-border p-3"
                  data-testid="visit-card"
                >
                  <div className="flex items-center justify-between gap-2">
                    <VisitStatusBadge status={visit.status} />
                    <span className="text-sm text-muted-foreground">
                      {visit.estimatedDurationMinutes} min
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground" data-testid="visit-assigned-to">
                    {assignedUser
                      ? `Assigned to: ${assignedUser.fullName}`
                      : 'Unassigned'}
                    {canAssign && (
                      <> — <Link to="/schedule" className="text-primary hover:underline text-xs">Assign</Link></>
                    )}
                  </p>
                  {visit.scheduledStart && (() => {
                    const d = new Date(visit.scheduledStart);
                    const monday = new Date(d);
                    const day = monday.getDay();
                    monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
                    const weekParam = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
                    return (
                      <p className="mt-1 text-sm">
                        <Link to={`/schedule?week=${weekParam}`} className="text-primary hover:underline">
                          {d.toLocaleString()}
                          {visit.scheduledEnd && (
                            <> — {new Date(visit.scheduledEnd).toLocaleString()}</>
                          )}
                        </Link>
                      </p>
                    );
                  })()}
                  {!visit.scheduledStart && (
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">Not yet scheduled</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/schedule')}
                        data-testid="schedule-visit-btn"
                      >
                        Schedule
                      </Button>
                    </div>
                  )}
                  {visit.notes && (
                    <p className="mt-1 text-sm text-muted-foreground">{visit.notes}</p>
                  )}
                  {visit.completedAt && (
                    <p className="mt-1 text-xs text-green-700">
                      Completed on {new Date(visit.completedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
