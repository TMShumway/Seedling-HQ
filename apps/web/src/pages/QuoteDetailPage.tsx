import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, User, MapPin, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, type UpdateQuoteRequest } from '@/lib/api-client';
import { formatPrice, centsToDollars, dollarsToCents } from '@/lib/format';
import { LineItemRow, type LineItemData } from '@/components/quotes/LineItemRow';
import { ServiceItemPicker } from '@/components/quotes/ServiceItemPicker';

function QuoteStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    declined: 'bg-red-100 text-red-800',
    expired: 'bg-amber-100 text-amber-800',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const quoteQuery = useQuery({
    queryKey: ['quote', id],
    queryFn: () => apiClient.getQuote(id!),
    enabled: !!id,
  });

  const quote = quoteQuery.data;
  const isDraft = quote?.status === 'draft';

  // Client info
  const clientQuery = useQuery({
    queryKey: ['client', quote?.clientId],
    queryFn: () => apiClient.getClient(quote!.clientId),
    enabled: !!quote?.clientId,
  });

  // Property info
  const propertyQuery = useQuery({
    queryKey: ['properties', quote?.clientId],
    queryFn: () => apiClient.listProperties(quote!.clientId),
    enabled: !!quote?.clientId,
  });

  const property = quote?.propertyId
    ? propertyQuery.data?.find((p) => p.id === quote.propertyId)
    : null;

  // Editable state
  const [title, setTitle] = useState('');
  const [lineItems, setLineItems] = useState<LineItemData[]>([]);
  const [tax, setTax] = useState(0); // dollars
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // Initialize form when quote loads
  useEffect(() => {
    if (quote) {
      setTitle(quote.title);
      setLineItems(
        quote.lineItems.map((li) => ({
          serviceItemId: li.serviceItemId,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
        })),
      );
      setTax(centsToDollars(quote.tax));
    }
  }, [quote]);

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const total = subtotal + dollarsToCents(tax);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateQuoteRequest) =>
      apiClient.updateQuote(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setSuccessMessage('Quote saved successfully.');
      setError(null);
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: Error) => {
      setError(err.message);
      setSuccessMessage(null);
    },
  });

  const handleSave = () => {
    setError(null);
    setSuccessMessage(null);

    updateMutation.mutate({
      title,
      lineItems: lineItems.map((item) => ({
        serviceItemId: item.serviceItemId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      tax: dollarsToCents(tax),
    });
  };

  const handleLineItemChange = (index: number, item: LineItemData) => {
    const updated = [...lineItems];
    updated[index] = item;
    setLineItems(updated);
  };

  const handleLineItemRemove = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      { serviceItemId: null, description: '', quantity: 1, unitPrice: 0 },
    ]);
  };

  const handleServiceItemSelect = (item: LineItemData) => {
    setLineItems([...lineItems, item]);
  };

  if (quoteQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="quote-detail-page">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (quoteQuery.error || !quote) {
    return (
      <div className="mx-auto max-w-3xl" data-testid="quote-detail-page">
        <Button variant="ghost" onClick={() => navigate('/quotes')} className="mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Quotes
        </Button>
        <div className="text-destructive">Quote not found.</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="quote-detail-page">
      {/* Back link */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/quotes')} size="sm">
          <ArrowLeft className="h-4 w-4" />
          Back to Quotes
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isDraft ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-semibold"
              data-testid="quote-title-input"
            />
          ) : (
            <h1 className="text-xl font-semibold">{quote.title}</h1>
          )}
        </div>
        <QuoteStatusBadge status={quote.status} />
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800" data-testid="success-message">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

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

      {/* Request link */}
      {quote.requestId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Source Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link to={`/requests/${quote.requestId}`} className="text-sm text-primary hover:underline">
              View original request
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Line items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Column headers */}
          {lineItems.length > 0 && (
            <div className="grid grid-cols-[1fr_80px_100px_80px_40px] gap-2 text-xs font-medium text-muted-foreground">
              <span>Description</span>
              <span>Qty</span>
              <span>Unit Price</span>
              <span className="text-right">Total</span>
              <span />
            </div>
          )}

          {lineItems.map((item, i) => (
            <LineItemRow
              key={i}
              item={item}
              index={i}
              onChange={handleLineItemChange}
              onRemove={handleLineItemRemove}
              readOnly={!isDraft}
            />
          ))}

          {lineItems.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No line items yet. Add a service to get started.
            </p>
          )}

          {isDraft && (
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddLineItem}
                data-testid="add-line-item"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Line Item
              </Button>
              <ServiceItemPicker onSelect={handleServiceItemSelect} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="space-y-2 pt-6">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            {isDraft ? (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={tax}
                  onChange={(e) => setTax(Number(e.target.value))}
                  min={0}
                  step={0.01}
                  className="w-24 text-right"
                  data-testid="quote-tax-input"
                />
              </div>
            ) : (
              <span className="font-medium">{formatPrice(quote.tax)}</span>
            )}
          </div>
          <div className="border-t pt-2">
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {isDraft && (
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="save-quote"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Quote'}
          </Button>
        </div>
      )}
    </div>
  );
}
