import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth, isLocalMode, isCognitoMode } from '@/lib/auth';
import { ApiClientError } from '@/lib/api-client';
import type { LoginAccount } from '@/lib/api-client';

type Step = 'login' | 'accounts' | 'new-password' | 'forgot-confirm';

export function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [accounts, setAccounts] = useState<LoginAccount[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function navigateToDashboard() {
    navigate('/dashboard');
  }

  async function authenticateAccount(account: LoginAccount) {
    auth.selectAccount(account);
    const result = await auth.authenticate(password);
    if (result.newPasswordRequired) {
      setStep('new-password');
      return;
    }
    navigateToDashboard();
  }

  function handlePasswordError(err: unknown) {
    if (err instanceof ApiClientError && err.status === 401) {
      setError('Incorrect password. Please try again.');
    } else if (err instanceof Error) {
      if (err.message.includes('Incorrect username or password')) {
        setError('Incorrect password. Please try again.');
      } else {
        setError(err.message);
      }
    } else {
      setError('Authentication failed. Please try again.');
    }
  }

  async function handleForgotPassword() {
    setError('');
    if (!email) {
      setError('Please enter your email first.');
      return;
    }
    setLoading(true);

    let lookupResult: LoginAccount[];
    try {
      lookupResult = await auth.lookupEmail(email);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setError('No account found for that email');
      } else {
        setError('Something went wrong. Please try again.');
      }
      setLoading(false);
      return;
    }

    if (lookupResult.length === 0) {
      setError('No account found for that email');
      setLoading(false);
      return;
    }

    if (lookupResult.length > 1) {
      setAccounts(lookupResult);
      setSelectedIndex(0);
      setForgotMode(true);
      setStep('accounts');
      setLoading(false);
      return;
    }

    // Single account — auto-select and initiate forgot password
    auth.selectAccount(lookupResult[0]);
    try {
      await auth.forgotPassword();
      setStep('forgot-confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotConfirmSubmit(e: FormEvent) {
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
      await auth.confirmForgotPassword(verificationCode, newPassword);
      setStep('login');
      setForgotMode(false);
      setVerificationCode('');
      setNewPassword('');
      setConfirmPassword('');
      setPassword('');
      setError('');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to reset password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    let lookupResult: LoginAccount[];
    try {
      lookupResult = await auth.lookupEmail(email);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setError('No account found for that email');
      } else {
        setError('Something went wrong. Please try again.');
      }
      setLoading(false);
      return;
    }

    if (lookupResult.length === 0) {
      setError('No account found for that email');
      setLoading(false);
      return;
    }

    if (lookupResult.length > 1) {
      setAccounts(lookupResult);
      setSelectedIndex(0);
      setStep('accounts');
      setLoading(false);
      return;
    }

    try {
      await authenticateAccount(lookupResult[0]);
    } catch (err) {
      handlePasswordError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAccountSelect(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const account = accounts[selectedIndex];

    if (forgotMode) {
      auth.selectAccount(account);
      try {
        await auth.forgotPassword();
        setStep('forgot-confirm');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send verification code');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      await authenticateAccount(account);
    } catch (err) {
      handlePasswordError(err);
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

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            <span className="mr-1">🌱</span> Seedling HQ
          </CardTitle>
          <CardDescription>
            {step === 'new-password' && 'Set your new password'}
            {step === 'forgot-confirm' && 'Reset your password'}
            {(step === 'login' || step === 'accounts') && 'Sign in to your account'}
          </CardDescription>
        </CardHeader>

        {step === 'login' && (
          <form onSubmit={handleLoginSubmit}>
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
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {isLocalMode() && (
                <p className="text-xs text-muted-foreground">
                  Hint: owner@demo.local / password
                </p>
              )}
              {isCognitoMode() && (
                <button
                  type="button"
                  className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
                  onClick={handleForgotPassword}
                  disabled={loading}
                >
                  Forgot password?
                </button>
              )}
              {isLocalMode() && (
                <p className="text-xs text-muted-foreground">
                  Forgot your password? Contact your admin to reset it.
                </p>
              )}
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
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
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                  {error}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Multiple accounts found for <span className="font-medium">{email}</span>. Choose one:
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
              <Button type="submit" className="w-full" disabled={loading}>
                {forgotMode
                  ? loading ? 'Sending code...' : 'Send Reset Code'
                  : loading ? 'Signing in...' : 'Sign In'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep('login');
                  setAccounts([]);
                  setForgotMode(false);
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

        {step === 'forgot-confirm' && (
          <form onSubmit={handleForgotConfirmSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                  {error}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                A verification code has been sent to your email. Enter the code and your new password below.
              </p>
              <div className="space-y-2">
                <Label htmlFor="verificationCode">Verification Code</Label>
                <Input
                  id="verificationCode"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forgotNewPassword">New Password</Label>
                <Input
                  id="forgotNewPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forgotConfirmPassword">Confirm Password</Label>
                <Input
                  id="forgotConfirmPassword"
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
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep('login');
                  setForgotMode(false);
                  setVerificationCode('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setError('');
                }}
              >
                Back to Sign In
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
