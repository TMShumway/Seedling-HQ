import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { apiClient, ApiClientError } from '@/lib/api-client';

export function SignupPage() {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerFullName, setOwnerFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await apiClient.createTenant({ businessName, ownerEmail, ownerFullName });
      localStorage.setItem('dev_tenant_id', result.tenant.id);
      localStorage.setItem('dev_user_id', result.user.id);
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Get Started with Seedling</CardTitle>
          <CardDescription>Create your business account</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Acme Landscaping"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Your Email</Label>
              <Input
                id="ownerEmail"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerFullName">Your Full Name</Label>
              <Input
                id="ownerFullName"
                value={ownerFullName}
                onChange={(e) => setOwnerFullName(e.target.value)}
                placeholder="Jane Doe"
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
