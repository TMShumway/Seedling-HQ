import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { formatPrice } from '@/lib/format';

export function PublicQuoteViewPage() {
  const { token } = useParams<{ token: string }>();

  const [respondStatus, setRespondStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [respondAction, setRespondAction] = useState<'approve' | 'decline' | null>(null);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const [respondError, setRespondError] = useState<string | null>(null);

  // Reset respond state when token changes (e.g. navigating between quotes)
  useEffect(() => {
    setRespondStatus('idle');
    setRespondAction(null);
    setShowDeclineConfirm(false);
    setRespondError(null);
  }, [token]);

  const quoteQuery = useQuery({
    queryKey: ['public-quote', token],
    queryFn: () => apiClient.getPublicQuote(token!),
    enabled: !!token,
    retry: false,
  });

  const handleApprove = async () => {
    if (!token) return;
    setRespondStatus('loading');
    setRespondAction('approve');
    setRespondError(null);
    try {
      await apiClient.approveQuote(token);
      setRespondStatus('success');
    } catch (err) {
      setRespondStatus('idle');
      setRespondAction(null);
      setRespondError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    setRespondStatus('loading');
    setRespondAction('decline');
    setRespondError(null);
    setShowDeclineConfirm(false);
    try {
      await apiClient.declineQuote(token);
      setRespondStatus('success');
    } catch (err) {
      setRespondStatus('idle');
      setRespondAction(null);
      setRespondError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  if (quoteQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12" data-testid="public-quote-view">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (quoteQuery.error) {
    const isLinkError = quoteQuery.error instanceof ApiClientError && quoteQuery.error.status === 403;
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12" data-testid="public-quote-view">
        <Card className="w-full max-w-lg text-center">
          <CardContent className="pt-6">
            <p className="text-lg font-medium text-destructive">
              {isLinkError
                ? 'This link is no longer valid.'
                : 'Something went wrong.'}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Please contact the business for an updated link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = quoteQuery.data!;
  const { quote } = data;

  // Determine which banner to show
  const showApprovedBanner = respondStatus === 'success' && respondAction === 'approve';
  const showDeclinedBanner = respondStatus === 'success' && respondAction === 'decline';
  const alreadyApproved = (quote.status === 'approved' || quote.status === 'scheduled') && respondStatus !== 'success';
  const alreadyDeclined = quote.status === 'declined' && respondStatus !== 'success';
  const canRespond = quote.status === 'sent' && respondStatus !== 'success';

  return (
    <div className="flex min-h-screen justify-center px-4 py-12" data-testid="public-quote-view">
      <div className="w-full max-w-2xl space-y-6">
        {/* Business header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">{data.businessName}</h1>
        </div>

        {/* Status banners */}
        {showApprovedBanner && (
          <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800" data-testid="quote-response-status">
            Quote approved! The business has been notified.
          </div>
        )}
        {showDeclinedBanner && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="quote-response-status">
            Quote declined. The business has been notified.
          </div>
        )}
        {alreadyApproved && (
          <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800" data-testid="quote-response-status">
            You approved this quote on {new Date(quote.approvedAt!).toLocaleDateString()}.
          </div>
        )}
        {alreadyDeclined && (
          <div className="rounded-md border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700" data-testid="quote-response-status">
            This quote was declined on {new Date(quote.declinedAt!).toLocaleDateString()}.
          </div>
        )}

        {respondError && (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
            {respondError}
          </div>
        )}

        {/* Quote info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{quote.title}</CardTitle>
            {data.clientName && (
              <p className="text-sm text-muted-foreground">
                Prepared for: {data.clientName}
              </p>
            )}
            {data.propertyAddress && (
              <p className="text-sm text-muted-foreground">
                {data.propertyAddress}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {/* Line items table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 text-right font-medium">Qty</th>
                    <th className="pb-2 text-right font-medium">Unit Price</th>
                    <th className="pb-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lineItems.map((item, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2">{item.description}</td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">{formatPrice(item.unitPrice)}</td>
                      <td className="py-2 text-right">{formatPrice(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-4 space-y-1 border-t pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(quote.subtotal)}</span>
              </div>
              {quote.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatPrice(quote.tax)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatPrice(quote.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        {canRespond && !showDeclineConfirm && (
          <div className="flex justify-center gap-3">
            <Button
              onClick={handleApprove}
              disabled={respondStatus === 'loading'}
              className="bg-green-600 hover:bg-green-700"
              data-testid="approve-quote-btn"
            >
              {respondStatus === 'loading' && respondAction === 'approve' ? 'Approving...' : 'Approve Quote'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeclineConfirm(true)}
              disabled={respondStatus === 'loading'}
              className="border-red-300 text-red-600 hover:bg-red-50"
              data-testid="decline-quote-btn"
            >
              Decline Quote
            </Button>
          </div>
        )}

        {/* Decline confirmation */}
        {showDeclineConfirm && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="mb-3 text-sm text-red-900">
                Are you sure you want to decline this quote?
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDecline}
                  disabled={respondStatus === 'loading'}
                  data-testid="decline-confirm-btn"
                >
                  {respondStatus === 'loading' && respondAction === 'decline' ? 'Declining...' : 'Decline'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeclineConfirm(false)}
                  disabled={respondStatus === 'loading'}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        {quote.sentAt && (
          <p className="text-center text-xs text-muted-foreground">
            Quote sent on {new Date(quote.sentAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}
