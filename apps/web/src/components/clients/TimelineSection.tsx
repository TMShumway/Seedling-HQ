import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  UserPlus,
  Pencil,
  UserX,
  MapPin,
  Trash2,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, type TimelineEvent } from '@/lib/api-client';

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'client.created': UserPlus,
  'client.updated': Pencil,
  'client.deactivated': UserX,
  'property.created': MapPin,
  'property.updated': Pencil,
  'property.deactivated': Trash2,
};

function getEventIcon(eventName: string) {
  return EVENT_ICONS[eventName] ?? Activity;
}

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface TimelineSectionProps {
  clientId: string;
}

export function TimelineSection({ clientId }: TimelineSectionProps) {
  const [hideDeactivated, setHideDeactivated] = useState(false);

  const timelineQuery = useInfiniteQuery({
    queryKey: ['timeline', clientId, hideDeactivated],
    queryFn: ({ pageParam }) =>
      apiClient.getClientTimeline(clientId, {
        limit: 20,
        cursor: pageParam ?? undefined,
        exclude: hideDeactivated ? 'deactivated' : undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
  });

  const allEvents = timelineQuery.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Activity</CardTitle>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hideDeactivated}
            onChange={(e) => setHideDeactivated(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring"
          />
          <span className="text-muted-foreground">Hide removals</span>
        </label>
      </CardHeader>
      <CardContent>
        {timelineQuery.isLoading && (
          <div className="space-y-4" data-testid="timeline-loading">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!timelineQuery.isLoading && allEvents.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No activity yet.
          </p>
        )}

        {allEvents.length > 0 && (
          <div className="relative" data-testid="timeline-list">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 h-full w-px bg-border" />

            <div className="space-y-4">
              {allEvents.map((event: TimelineEvent) => {
                const Icon = getEventIcon(event.eventName);
                return (
                  <div key={event.id} className="relative flex items-start gap-3 pl-1">
                    <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card border border-border">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm font-medium">{event.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(event.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {timelineQuery.hasNextPage && (
          <div className="mt-4 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => timelineQuery.fetchNextPage()}
              disabled={timelineQuery.isFetchingNextPage}
            >
              {timelineQuery.isFetchingNextPage ? 'Loading...' : 'Load More'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
