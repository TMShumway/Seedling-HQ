import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Calculator, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import type { QuoteResponse } from '@/lib/api-types';
import { formatPrice } from '@/lib/format';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Approved', value: 'approved' },
  { label: 'Declined', value: 'declined' },
  { label: 'Scheduled', value: 'scheduled' },
] as const;

function QuoteStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    declined: 'bg-red-100 text-red-800',
    expired: 'bg-amber-100 text-amber-800',
    scheduled: 'bg-indigo-100 text-indigo-800',
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

function QuoteCard({ quote, onClick }: { quote: QuoteResponse; onClick: () => void }) {
  return (
    <div
      className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
      data-testid="quote-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{quote.title}</h3>
            <QuoteStatusBadge status={quote.status} />
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">
            {formatPrice(quote.total)}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatRelativeTime(quote.createdAt)}
        </span>
      </div>
    </div>
  );
}

export function QuotesPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const quotesQuery = useInfiniteQuery({
    queryKey: ['quotes', { search: searchTerm, status: statusFilter }],
    queryFn: ({ pageParam }) =>
      apiClient.listQuotes({
        limit: 20,
        cursor: pageParam ?? undefined,
        search: searchTerm || undefined,
        status: statusFilter || undefined,
      }),
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.cursor : undefined,
    initialPageParam: null as string | null,
  });

  const allQuotes = quotesQuery.data?.pages.flatMap((p) => p.data) ?? [];

  if (quotesQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="quotes-page">
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

  if (quotesQuery.error) {
    return (
      <div className="text-destructive" data-testid="quotes-page">
        Failed to load quotes. Please try again.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="quotes-page">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quotes</h1>
          <p className="mt-1 text-muted-foreground">
            Manage quotes for your clients.
          </p>
        </div>
        <Button onClick={() => navigate('/quotes/new')} data-testid="new-quote-btn">
          <Plus className="mr-1 h-4 w-4" />
          New Quote
        </Button>
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
          data-testid="quote-search"
        />
      </div>

      {/* Quote list */}
      {allQuotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center" data-testid="empty-state">
          <Calculator className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">
            {searchTerm || statusFilter ? 'No quotes found' : 'No quotes yet'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm || statusFilter
              ? 'Try adjusting your search or filter.'
              : 'Create a new quote or convert a request to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allQuotes.map((quote) => (
            <QuoteCard key={quote.id} quote={quote} onClick={() => navigate(`/quotes/${quote.id}`)} />
          ))}
        </div>
      )}

      {/* Load More */}
      {quotesQuery.hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => quotesQuery.fetchNextPage()}
            disabled={quotesQuery.isFetchingNextPage}
          >
            {quotesQuery.isFetchingNextPage ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
