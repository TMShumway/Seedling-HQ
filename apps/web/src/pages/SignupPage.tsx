import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { isCognitoMode } from '@/lib/auth';
import { useAuth } from '@/lib/auth';

export function SignupPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerFullName, setOwnerFullName] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isCognitoMode()) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              <span className="mr-1">🌱</span> Seedling HQ
            </CardTitle>
            <CardDescription>Account creation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Account creation is managed by your administrator.
              Contact them to get started.
            </p>
          </CardContent>
          <CardFooter className="justify-center">
            <a href="/login" className="text-sm text-primary underline underline-offset-4 hover:text-primary/80">
              Back to login
            </a>
          </CardFooter>
        </Card>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (ownerPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (ownerPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const result = await apiClient.createTenant({ businessName, ownerEmail, ownerFullName, ownerPassword });
      // Select account and authenticate with the password just created
      auth.selectAccount({
        tenantId: result.tenant.id,
        userId: result.user.id,
        fullName: result.user.fullName,
        role: result.user.role,
        tenantName: result.tenant.name,
      });
      await auth.authenticate(ownerPassword);
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
            <div className="space-y-2">
              <Label htmlFor="ownerPassword">Password</Label>
              <Input
                id="ownerPassword"
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <a href="/login" className="text-primary underline underline-offset-4 hover:text-primary/80">
                Log in
              </a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
