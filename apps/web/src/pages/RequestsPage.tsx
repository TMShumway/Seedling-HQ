import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, type RequestResponse } from '@/lib/api-client';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: 'bg-amber-100 text-amber-800',
    reviewed: 'bg-blue-100 text-blue-800',
    converted: 'bg-green-100 text-green-800',
    declined: 'bg-gray-100 text-gray-600',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function RequestCard({ req, onClick }: { req: RequestResponse; onClick: () => void }) {
  return (
    <div
      className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
      data-testid="request-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{req.clientName}</h3>
            <StatusBadge status={req.status} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{req.clientEmail}</p>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {req.description}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatRelativeTime(req.createdAt)}
        </span>
      </div>
    </div>
  );
}

export function RequestsPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const requestsQuery = useInfiniteQuery({
    queryKey: ['requests', { search: searchTerm }],
    queryFn: ({ pageParam }) =>
      apiClient.listRequests({
        limit: 20,
        cursor: pageParam ?? undefined,
        search: searchTerm || undefined,
      }),
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.cursor : undefined,
    initialPageParam: null as string | null,
  });

  const allRequests = requestsQuery.data?.pages.flatMap((p) => p.data) ?? [];

  if (requestsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="requests-page">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  }

  if (requestsQuery.error) {
    return (
      <div className="text-destructive" data-testid="requests-page">
        Failed to load requests. Please try again.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="requests-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Requests</h1>
        <p className="mt-1 text-muted-foreground">
          Service requests from your public form.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or description..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10"
          data-testid="request-search"
        />
      </div>

      {/* Request list */}
      {allRequests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center" data-testid="empty-state">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">
            {searchTerm ? 'No requests found' : 'No requests yet'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm
              ? 'Try adjusting your search terms.'
              : 'Requests will appear here when customers submit the public form.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allRequests.map((req) => (
            <RequestCard key={req.id} req={req} onClick={() => navigate(`/requests/${req.id}`)} />
          ))}
        </div>
      )}

      {/* Load More */}
      {requestsQuery.hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => requestsQuery.fetchNextPage()}
            disabled={requestsQuery.isFetchingNextPage}
          >
            {requestsQuery.isFetchingNextPage ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
