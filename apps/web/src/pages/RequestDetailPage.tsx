import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Mail, Phone, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: 'bg-amber-100 text-amber-800',
    reviewed: 'bg-blue-100 text-blue-800',
    converted: 'bg-green-100 text-green-800',
    declined: 'bg-gray-100 text-gray-600',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const requestQuery = useQuery({
    queryKey: ['request', id],
    queryFn: () => apiClient.getRequest(id!),
    enabled: !!id,
  });

  if (requestQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="request-detail-page">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (requestQuery.error || !requestQuery.data) {
    return (
      <div className="mx-auto max-w-3xl" data-testid="request-detail-page">
        <Button variant="ghost" onClick={() => navigate('/requests')} className="mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Requests
        </Button>
        <div className="text-destructive">Request not found.</div>
      </div>
    );
  }

  const req = requestQuery.data;
  const canConvert = req.status === 'new' || req.status === 'reviewed';

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="request-detail-page">
      {/* Back link */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/requests')} size="sm">
          <ArrowLeft className="h-4 w-4" />
          Back to Requests
        </Button>
      </div>

      {/* Header with name and status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{req.clientName}</h1>
            <p className="text-sm text-muted-foreground">
              {req.source === 'public_form' ? 'Public form' : 'Manual entry'}
            </p>
          </div>
        </div>
        <StatusBadge status={req.status} />
      </div>

      {/* Convert button */}
      {canConvert && (
        <Button
          onClick={() => navigate(`/requests/${id}/convert`)}
          data-testid="convert-button"
        >
          Convert to Client
        </Button>
      )}

      {/* Contact info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{req.clientEmail}</span>
            </div>
            {req.clientPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{req.clientPhone}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Description card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Service Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{req.description}</p>
        </CardContent>
      </Card>

      {/* Timestamps */}
      <Card>
        <CardContent className="space-y-2 pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Submitted {formatDate(req.createdAt)}</span>
          </div>
          {req.createdAt !== req.updatedAt && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Updated {formatDate(req.updatedAt)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
