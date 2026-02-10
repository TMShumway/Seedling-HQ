import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { formatPrice } from '@/lib/format';

export function PublicQuoteViewPage() {
  const { token } = useParams<{ token: string }>();

  const quoteQuery = useQuery({
    queryKey: ['public-quote', token],
    queryFn: () => apiClient.getPublicQuote(token!),
    enabled: !!token,
    retry: false,
  });

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

  return (
    <div className="flex min-h-screen justify-center px-4 py-12" data-testid="public-quote-view">
      <div className="w-full max-w-2xl space-y-6">
        {/* Business header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">{data.businessName}</h1>
        </div>

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
