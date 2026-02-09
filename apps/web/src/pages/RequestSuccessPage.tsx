import { useParams } from 'react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

export function RequestSuccessPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Request Submitted</CardTitle>
          <CardDescription>
            Thank you! Your service request has been received.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>We'll review your request and get back to you as soon as possible.</p>
          <p>
            <a
              href={`/request/${tenantSlug}`}
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Submit another request
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
