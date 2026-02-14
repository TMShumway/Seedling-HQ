import { useState, useEffect, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Plus, Users, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientCard } from '@/components/clients/ClientCard';
import { ClientForm } from '@/components/clients/ClientForm';
import { apiClient } from '@/lib/api-client';
import type { CreateClientRequest } from '@/lib/api-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function ClientsPage() {
  const queryClient = useQueryClient();
  const [addingClient, setAddingClient] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const clientsQuery = useInfiniteQuery({
    queryKey: ['clients', { search: searchTerm }],
    queryFn: ({ pageParam }) =>
      apiClient.listClients({
        limit: 20,
        cursor: pageParam ?? undefined,
        search: searchTerm || undefined,
      }),
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.cursor : undefined,
    initialPageParam: null as string | null,
  });

  const showSuccess = useCallback((msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  }, []);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  }, [queryClient]);

  const createClient = useMutation({
    mutationFn: (input: CreateClientRequest) => apiClient.createClient(input),
    onSuccess: () => {
      invalidate();
      setAddingClient(false);
      showSuccess('Client created');
    },
  });

  const allClients = clientsQuery.data?.pages.flatMap((p) => p.data) ?? [];

  if (clientsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="clients-page">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  }

  if (clientsQuery.error) {
    return (
      <div className="text-destructive" data-testid="clients-page">
        Failed to load clients. Please try again.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="clients-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your clients and their properties.
          </p>
        </div>
        <Button onClick={() => setAddingClient(true)} disabled={addingClient}>
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, phone, or company..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10"
          data-testid="client-search"
        />
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
          {successMessage}
        </div>
      )}

      {/* Add client form */}
      {addingClient && (
        <ClientForm
          onSave={(data) => createClient.mutate(data as CreateClientRequest)}
          onCancel={() => setAddingClient(false)}
          saving={createClient.isPending}
        />
      )}

      {/* Client list */}
      {allClients.length === 0 && !addingClient ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center" data-testid="empty-state">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">
            {searchTerm ? 'No clients found' : 'No clients yet'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm
              ? 'Try adjusting your search terms.'
              : 'Add your first client to get started.'}
          </p>
          {!searchTerm && (
            <Button className="mt-4" onClick={() => setAddingClient(true)}>
              <Plus className="h-4 w-4" />
              Add Client
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {allClients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}

      {/* Load More */}
      {clientsQuery.hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => clientsQuery.fetchNextPage()}
            disabled={clientsQuery.isFetchingNextPage}
          >
            {clientsQuery.isFetchingNextPage ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
