import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { isLocalMode, isCognitoMode } from '@/lib/auth';
import { ApiClientError } from '@/lib/api-client';
import type { LoginAccount } from '@/lib/api-client';

type Step = 'email' | 'accounts' | 'password' | 'new-password';

export function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [accounts, setAccounts] = useState<LoginAccount[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function navigateToDashboard() {
    navigate('/dashboard');
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await auth.lookupEmail(email);

      if (result.length === 1) {
        const done = auth.selectAccount(result[0]);
        if (done) {
          navigateToDashboard();
          return;
        }
        // Cognito mode: need password
        setAccounts(result);
        setStep('password');
        return;
      }

      setAccounts(result);
      setSelectedIndex(0);
      setStep('accounts');
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
    const account = accounts[selectedIndex];
    const done = auth.selectAccount(account);
    if (done) {
      navigateToDashboard();
      return;
    }
    // Cognito mode: need password
    setStep('password');
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await auth.authenticate(password);
      if (result.newPasswordRequired) {
        setStep('new-password');
        return;
      }
      navigateToDashboard();
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Incorrect username or password')) {
          setError('Incorrect password. Please try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleNewPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await auth.handleNewPassword(newPassword);
      navigateToDashboard();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to set new password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  // Check pendingNewPassword after authenticate call (state may have updated)
  // This is handled by the step state machine above

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            <span className="mr-1">🌱</span> Seedling HQ
          </CardTitle>
          <CardDescription>
            {step === 'new-password' ? 'Set your new password' : 'Sign in to your account'}
          </CardDescription>
        </CardHeader>

        {step === 'email' && (
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
              {isLocalMode() && (
                <p className="text-xs text-muted-foreground">
                  Hint: try owner@demo.local
                </p>
              )}
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
        )}

        {step === 'accounts' && (
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
                {isCognitoMode() ? 'Continue' : 'Log In'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep('email');
                  setAccounts([]);
                  setError('');
                }}
              >
                Back
              </Button>
            </CardFooter>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                  {error}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Signing in as <span className="font-medium">{accounts[selectedIndex]?.fullName}</span>
                {' '}at <span className="font-medium">{accounts[selectedIndex]?.tenantName}</span>
              </p>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep(accounts.length > 1 ? 'accounts' : 'email');
                  setPassword('');
                  setError('');
                }}
              >
                Back
              </Button>
            </CardFooter>
          </form>
        )}

        {step === 'new-password' && (
          <form onSubmit={handleNewPasswordSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                  {error}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Your administrator created your account with a temporary password.
                Please set a new password to continue.
              </p>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
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
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Setting password...' : 'Set Password & Continue'}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
