import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import type { VisitWithContextResponse } from '@/lib/api-client';
import { useAuth } from '@/lib/auth/auth-context';
import { PhotoGallery } from '@/components/visits/PhotoGallery';
import { PhotoUpload } from '@/components/visits/PhotoUpload';

function formatTodayDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function getTodayRange(): { from: string; to: string; dateStr: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const dateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  return { from: start.toISOString(), to: end.toISOString(), dateStr };
}

function formatTimeRange(start: string | null, end: string | null, durationMin: number): string {
  if (!start) return `${durationMin} min`;
  const s = new Date(start);
  const e = end ? new Date(end) : new Date(s.getTime() + durationMin * 60000);
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${fmt(s)} – ${fmt(e)}`;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-indigo-100 text-indigo-800',
  en_route: 'bg-yellow-100 text-yellow-800',
  started: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  en_route: 'En Route',
  started: 'Started',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function VisitStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function VisitNotesSection({ visit }: { visit: VisitWithContextResponse }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(visit.notes ?? '');
  const isEditable = ['en_route', 'started'].includes(visit.status);

  const notesMutation = useMutation({
    mutationFn: (newNotes: string | null) => apiClient.updateVisitNotes(visit.id, newNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-visits'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
    },
  });

  if (!['en_route', 'started', 'completed'].includes(visit.status)) return null;

  if (visit.status === 'completed') {
    if (!visit.notes) return null;
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Notes</p>
        <p className="whitespace-pre-wrap text-sm" data-testid="visit-notes-display">{visit.notes}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Notes</p>
      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        rows={2}
        placeholder="Add visit notes..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={!isEditable || notesMutation.isPending}
        data-testid="visit-notes-input"
      />
      {isEditable && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => notesMutation.mutate(notes || null)}
          disabled={notesMutation.isPending}
          data-testid="visit-notes-save"
        >
          {notesMutation.isPending ? 'Saving...' : 'Save Notes'}
        </Button>
      )}
      {notesMutation.isError && (
        <p className="text-xs text-destructive">Failed to save notes</p>
      )}
    </div>
  );
}

function TodayVisitCard({ visit }: { visit: VisitWithContextResponse }) {
  const queryClient = useQueryClient();
  const showPhotos = ['en_route', 'started', 'completed'].includes(visit.status);
  const canEditPhotos = ['en_route', 'started'].includes(visit.status);

  const mutation = useMutation({
    mutationFn: (newStatus: string) => apiClient.transitionVisitStatus(visit.id, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-visits'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
    },
  });

  const photosQuery = useQuery({
    queryKey: ['visit-photos', visit.id],
    queryFn: () => apiClient.listVisitPhotos(visit.id),
    enabled: showPhotos,
  });

  const addressQuery = visit.propertyAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(visit.propertyAddress)}`
    : null;

  return (
    <Card data-testid="today-visit-card">
      <CardContent className="space-y-3 pt-4">
        {/* Header: title + badge */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-lg font-semibold" data-testid="today-visit-title">{visit.jobTitle}</p>
            <p className="text-sm text-muted-foreground">{visit.clientName}</p>
          </div>
          <VisitStatusBadge status={visit.status} />
        </div>

        {/* Time + duration */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatTimeRange(visit.scheduledStart, visit.scheduledEnd, visit.estimatedDurationMinutes)}
          </span>
          <span>{visit.estimatedDurationMinutes} min</span>
        </div>

        {/* Contact links */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {visit.propertyAddress && addressQuery && (
            <a
              href={addressQuery}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
              data-testid="today-visit-address"
            >
              <MapPin className="h-3.5 w-3.5" />
              {visit.propertyAddress}
            </a>
          )}
          {visit.clientPhone && (
            <a
              href={`tel:${visit.clientPhone}`}
              className="flex items-center gap-1 text-primary hover:underline"
              data-testid="today-visit-phone"
            >
              <Phone className="h-3.5 w-3.5" />
              {visit.clientPhone}
            </a>
          )}
          {visit.clientEmail && (
            <a
              href={`mailto:${visit.clientEmail}`}
              className="flex items-center gap-1 text-primary hover:underline"
              data-testid="today-visit-email"
            >
              <Mail className="h-3.5 w-3.5" />
              {visit.clientEmail}
            </a>
          )}
        </div>

        {/* Notes */}
        <VisitNotesSection visit={visit} />

        {/* Photos */}
        {showPhotos && (
          <div className="space-y-2">
            {photosQuery.data && (
              <PhotoGallery
                visitId={visit.id}
                photos={photosQuery.data.data}
                canDelete={canEditPhotos}
              />
            )}
            {canEditPhotos && <PhotoUpload visitId={visit.id} />}
          </div>
        )}

        {/* Status action buttons */}
        <div className="flex items-center gap-2">
          {visit.status === 'scheduled' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => mutation.mutate('en_route')}
                disabled={mutation.isPending}
                data-testid="action-en-route"
              >
                En Route
              </Button>
              <Button
                size="sm"
                onClick={() => mutation.mutate('started')}
                disabled={mutation.isPending}
                data-testid="action-start"
              >
                Start
              </Button>
            </>
          )}
          {visit.status === 'en_route' && (
            <Button
              size="sm"
              onClick={() => mutation.mutate('started')}
              disabled={mutation.isPending}
              data-testid="action-start"
            >
              Start
            </Button>
          )}
          {visit.status === 'started' && (
            <Button
              size="sm"
              onClick={() => mutation.mutate('completed')}
              disabled={mutation.isPending}
              data-testid="action-complete"
            >
              Complete
            </Button>
          )}
          {visit.status === 'completed' && visit.completedAt && (
            <span className="text-sm text-green-700" data-testid="completed-time">
              Completed at {new Date(visit.completedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          {visit.status === 'cancelled' && (
            <span className="text-sm text-muted-foreground">Cancelled</span>
          )}
        </div>

        {/* Mutation error */}
        {mutation.isError && (
          <p className="text-sm text-destructive" data-testid="today-visit-error">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to update status'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function TodayPage() {
  const { user } = useAuth();
  const { from, to, dateStr } = useMemo(() => getTodayRange(), []);

  const visitsQuery = useQuery({
    queryKey: ['today-visits', user?.userId, dateStr],
    queryFn: () =>
      apiClient.listVisits({
        from,
        to,
        assignedUserId: user?.userId,
      }),
    enabled: !!user?.userId,
  });

  const visits = useMemo(() => {
    const data = visitsQuery.data?.data ?? [];
    return [...data].sort((a, b) => {
      if (!a.scheduledStart && !b.scheduledStart) return 0;
      if (!a.scheduledStart) return 1;
      if (!b.scheduledStart) return -1;
      return new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime();
    });
  }, [visitsQuery.data]);

  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="today-page">
      <h1 className="text-xl font-semibold">Today</h1>
      <p className="text-sm text-muted-foreground">{formatTodayDate()}</p>

      {visitsQuery.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      )}

      {!visitsQuery.isLoading && visits.length === 0 && (
        <div
          className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
          data-testid="today-empty"
        >
          No visits assigned to you today
        </div>
      )}

      {visits.map((visit) => (
        <TodayVisitCard key={visit.id} visit={visit} />
      ))}
    </div>
  );
}
