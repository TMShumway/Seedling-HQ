import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { apiClient, ApiClientError, type LoginAccount } from '@/lib/api-client';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [accounts, setAccounts] = useState<LoginAccount[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function selectAccount(account: LoginAccount) {
    localStorage.setItem('dev_tenant_id', account.tenantId);
    localStorage.setItem('dev_user_id', account.userId);
    navigate('/dashboard');
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await apiClient.localLogin(email);

      if (result.accounts.length === 1) {
        selectAccount(result.accounts[0]);
        return;
      }

      setAccounts(result.accounts);
      setSelectedIndex(0);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setError('No account found for that email');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleAccountSelect(e: FormEvent) {
    e.preventDefault();
    if (accounts) {
      selectAccount(accounts[selectedIndex]);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            <span className="mr-1">🌱</span> Seedling HQ
          </CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>

        {!accounts ? (
          <form onSubmit={handleEmailSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Hint: try owner@demo.local
              </p>
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Continue'}
              </Button>
              <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <a href="/signup" className="text-primary underline underline-offset-4 hover:text-primary/80">
                  Sign up
                </a>
              </p>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleAccountSelect}>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Multiple accounts found. Choose one:
              </p>
              <fieldset className="space-y-2">
                <legend className="sr-only">Select account</legend>
                {accounts.map((account, i) => (
                  <label
                    key={account.tenantId}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
                      selectedIndex === i
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="account"
                      value={i}
                      checked={selectedIndex === i}
                      onChange={() => setSelectedIndex(i)}
                      className="accent-primary"
                    />
                    <div>
                      <div className="font-medium">{account.tenantName}</div>
                      <div className="text-sm text-muted-foreground">
                        {account.fullName} &middot; {account.role}
                      </div>
                    </div>
                  </label>
                ))}
              </fieldset>
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full">
                Log In
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setAccounts(null);
                  setError('');
                }}
              >
                Back
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
