import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Phone, Mail, Building2, Tag, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientForm } from '@/components/clients/ClientForm';
import { PropertyForm } from '@/components/clients/PropertyForm';
import { PropertyRow } from '@/components/clients/PropertyRow';
import { apiClient, type UpdateClientRequest, type CreatePropertyRequest, type UpdatePropertyRequest } from '@/lib/api-client';
import { formatClientName } from '@/lib/format';

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [addingProperty, setAddingProperty] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clientQuery = useQuery({
    queryKey: ['client', id],
    queryFn: () => apiClient.getClient(id!),
    enabled: !!id,
  });

  const propertiesQuery = useQuery({
    queryKey: ['properties', id],
    queryFn: () => apiClient.listProperties(id!),
    enabled: !!id,
  });

  const showSuccess = useCallback((msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  }, []);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['client', id] });
    queryClient.invalidateQueries({ queryKey: ['properties', id] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  }, [queryClient, id]);

  const updateClient = useMutation({
    mutationFn: (input: UpdateClientRequest) => apiClient.updateClient(id!, input),
    onSuccess: () => {
      invalidate();
      setEditing(false);
      showSuccess('Client updated');
    },
  });

  const deactivateClient = useMutation({
    mutationFn: () => apiClient.deactivateClient(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      navigate('/clients');
    },
  });

  const createProperty = useMutation({
    mutationFn: (input: CreatePropertyRequest) => apiClient.createProperty(id!, input),
    onSuccess: () => {
      invalidate();
      setAddingProperty(false);
      showSuccess('Property added');
    },
  });

  const updateProperty = useMutation({
    mutationFn: ({ propId, data }: { propId: string; data: UpdatePropertyRequest }) =>
      apiClient.updateProperty(propId, data),
    onSuccess: () => {
      invalidate();
      showSuccess('Property updated');
    },
  });

  const deactivateProperty = useMutation({
    mutationFn: (propId: string) => apiClient.deactivateProperty(propId),
    onSuccess: () => {
      invalidate();
      showSuccess('Property removed');
    },
  });

  if (clientQuery.isLoading || propertiesQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="client-detail-page">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (clientQuery.error || !clientQuery.data) {
    return (
      <div className="mx-auto max-w-3xl" data-testid="client-detail-page">
        <Button variant="ghost" onClick={() => navigate('/clients')} className="mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Clients
        </Button>
        <div className="text-destructive">Client not found.</div>
      </div>
    );
  }

  const client = clientQuery.data;
  const properties = propertiesQuery.data ?? [];

  const isSaving =
    updateClient.isPending ||
    deactivateClient.isPending ||
    createProperty.isPending ||
    updateProperty.isPending ||
    deactivateProperty.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="client-detail-page">
      {/* Back link */}
      <Button variant="ghost" onClick={() => navigate('/clients')} size="sm">
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </Button>

      {/* Success message */}
      {successMessage && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
          {successMessage}
        </div>
      )}

      {/* Client info */}
      {editing ? (
        <ClientForm
          client={client}
          onSave={(data) => updateClient.mutate(data as UpdateClientRequest)}
          onCancel={() => setEditing(false)}
          saving={updateClient.isPending}
        />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {client.firstName[0]}{client.lastName[0]}
              </div>
              <div>
                <CardTitle>{formatClientName(client.firstName, client.lastName)}</CardTitle>
                {client.company && (
                  <p className="text-sm text-muted-foreground">{client.company}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (window.confirm(`Remove "${formatClientName(client.firstName, client.lastName)}"?`)) {
                    deactivateClient.mutate();
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              {client.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.company && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{client.company}</span>
                </div>
              )}
            </div>
            {client.tags.length > 0 && (
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-wrap gap-1">
                  {client.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {client.notes && (
              <div className="flex items-start gap-2 text-sm">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-muted-foreground">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Properties section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Properties</CardTitle>
          <Button size="sm" onClick={() => setAddingProperty(true)} disabled={addingProperty}>
            <Plus className="h-4 w-4" />
            Add Property
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {addingProperty && (
            <PropertyForm
              onSave={(data) => createProperty.mutate(data as CreatePropertyRequest)}
              onCancel={() => setAddingProperty(false)}
              saving={createProperty.isPending}
            />
          )}

          {properties.length === 0 && !addingProperty ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No properties yet. Add this client's first service property.
            </p>
          ) : (
            properties.map((property) => (
              <PropertyRow
                key={property.id}
                property={property}
                onEdit={(data) => updateProperty.mutate({ propId: property.id, data })}
                onDelete={() => {
                  if (window.confirm('Remove this property?')) {
                    deactivateProperty.mutate(property.id);
                  }
                }}
                saving={isSaving}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
