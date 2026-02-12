import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Briefcase, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, type JobResponse } from '@/lib/api-client';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
] as const;

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
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
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

function JobCard({ job, onClick }: { job: JobResponse; onClick: () => void }) {
  return (
    <div
      className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
      data-testid="job-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{job.title}</h3>
            <JobStatusBadge status={job.status} />
          </div>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatRelativeTime(job.createdAt)}
        </span>
      </div>
    </div>
  );
}

export function JobsPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const jobsQuery = useInfiniteQuery({
    queryKey: ['jobs', { search: searchTerm, status: statusFilter }],
    queryFn: ({ pageParam }) =>
      apiClient.listJobs({
        limit: 20,
        cursor: pageParam ?? undefined,
        search: searchTerm || undefined,
        status: statusFilter || undefined,
      }),
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.cursor : undefined,
    initialPageParam: null as string | null,
  });

  const allJobs = jobsQuery.data?.pages.flatMap((p) => p.data) ?? [];

  if (jobsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="jobs-page">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  }

  if (jobsQuery.error) {
    return (
      <div className="text-destructive" data-testid="jobs-page">
        Failed to load jobs. Please try again.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="jobs-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Jobs</h1>
        <p className="mt-1 text-muted-foreground">
          Manage scheduled and in-progress jobs.
        </p>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by title..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10"
          data-testid="job-search"
        />
      </div>

      {/* Job list */}
      {allJobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center" data-testid="empty-state">
          <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">
            {searchTerm || statusFilter ? 'No jobs found' : 'No jobs yet'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm || statusFilter
              ? 'Try adjusting your search or filter.'
              : 'Create a job from an approved quote to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allJobs.map((job) => (
            <JobCard key={job.id} job={job} onClick={() => navigate(`/jobs/${job.id}`)} />
          ))}
        </div>
      )}

      {/* Load More */}
      {jobsQuery.hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => jobsQuery.fetchNextPage()}
            disabled={jobsQuery.isFetchingNextPage}
          >
            {jobsQuery.isFetchingNextPage ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
