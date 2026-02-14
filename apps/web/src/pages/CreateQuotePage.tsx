import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import type { ClientResponse, PropertyResponse } from '@/lib/api-types';

export function CreateQuotePage() {
  const navigate = useNavigate();

  // Client search
  const [clientSearchInput, setClientSearchInput] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientResponse | null>(null);

  // Property selection
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  // Quote fields
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Debounce client search
  useEffect(() => {
    const timer = setTimeout(() => setClientSearchTerm(clientSearchInput), 300);
    return () => clearTimeout(timer);
  }, [clientSearchInput]);

  // Client search query
  const clientsQuery = useQuery({
    queryKey: ['clients', 'search', clientSearchTerm],
    queryFn: () => apiClient.listClients({ search: clientSearchTerm, limit: 5 }),
    enabled: clientSearchTerm.length >= 2,
  });

  const searchResults = clientsQuery.data?.data ?? [];

  // Properties query for selected client
  const propertiesQuery = useQuery({
    queryKey: ['properties', selectedClient?.id],
    queryFn: () => apiClient.listProperties(selectedClient!.id),
    enabled: !!selectedClient,
  });

  const properties: PropertyResponse[] = propertiesQuery.data ?? [];

  // Auto-suggest title on client selection
  const handleSelectClient = (client: ClientResponse) => {
    setSelectedClient(client);
    setSelectedPropertyId('');
    if (!title) {
      setTitle(`Quote for ${client.firstName} ${client.lastName}`);
    }
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setSelectedPropertyId('');
    setClientSearchInput('');
    setClientSearchTerm('');
  };

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.createQuote({
        clientId: selectedClient!.id,
        propertyId: selectedPropertyId || null,
        title: title.trim(),
      }),
    onSuccess: (result) => {
      navigate(`/quotes/${result.id}`);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = () => {
    setError(null);
    if (!selectedClient) {
      setError('Please select a client');
      return;
    }
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="create-quote-page">
      {/* Back link */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/quotes')} size="sm">
          <ArrowLeft className="h-4 w-4" />
          Back to Quotes
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">New Quote</h1>
        <p className="mt-1 text-muted-foreground">
          Create a draft quote for an existing client.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Client selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedClient ? (
            <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div>
                <div className="font-medium">
                  {selectedClient.firstName} {selectedClient.lastName}
                </div>
                <div className="text-sm text-muted-foreground">
                  {[selectedClient.email, selectedClient.phone].filter(Boolean).join(' · ')}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearClient}>
                Change
              </Button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Search clients by name, email, or phone..."
                value={clientSearchInput}
                onChange={(e) => setClientSearchInput(e.target.value)}
                data-testid="client-search-input"
              />
              {clientSearchTerm.length >= 2 && searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((client) => (
                    <label
                      key={client.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
                      data-testid={`client-option-${client.id}`}
                    >
                      <input
                        type="radio"
                        name="selectedClient"
                        value={client.id}
                        checked={false}
                        onChange={() => handleSelectClient(client)}
                        className="h-4 w-4"
                      />
                      <div>
                        <div className="text-sm font-medium">
                          {client.firstName} {client.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[client.email, client.phone, client.company].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {clientSearchTerm.length >= 2 && searchResults.length === 0 && !clientsQuery.isLoading && (
                <p className="text-sm text-muted-foreground">No clients found matching "{clientSearchTerm}"</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Property selection */}
      {selectedClient && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Property (optional)</CardTitle>
          </CardHeader>
          <CardContent>
            {propertiesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading properties...</p>
            ) : properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">No properties on file for this client.</p>
            ) : (
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                data-testid="property-select"
              >
                <option value="">None</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.addressLine1}{p.city ? `, ${p.city}` : ''}{p.state ? `, ${p.state}` : ''}
                  </option>
                ))}
              </select>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quote title */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quote Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <label htmlFor="quoteTitle" className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </label>
            <Input
              id="quoteTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lawn Service for John Smith"
              data-testid="quote-title-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => navigate('/quotes')}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={createMutation.isPending || !selectedClient}
          data-testid="create-quote-submit"
        >
          {createMutation.isPending ? 'Creating...' : 'Create Quote'}
        </Button>
      </div>
    </div>
  );
}
