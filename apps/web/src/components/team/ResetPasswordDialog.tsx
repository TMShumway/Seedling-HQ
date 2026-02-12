import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { UserResponse } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ResetPasswordDialogProps {
  user: UserResponse;
  onClose: () => void;
}

export function ResetPasswordDialog({ user, onClose }: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const resetMutation = useMutation({
    mutationFn: () => apiClient.resetUserPassword(user.id, password),
    onSuccess: () => {
      setSuccessMessage(`Password for ${user.fullName} has been reset.`);
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 2000);
    },
  });

  const passwordsMatch = password === confirmPassword;
  const isValid = password.length >= 8 && passwordsMatch;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Reset Password</CardTitle>
        <CardDescription>Set a new password for {user.fullName} ({user.email})</CardDescription>
      </CardHeader>
      <CardContent>
        {successMessage && (
          <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
            {successMessage}
          </div>
        )}
        {resetMutation.error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {resetMutation.error instanceof Error ? resetMutation.error.message : 'Failed to reset password'}
          </div>
        )}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reset-password">New Password</Label>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-confirm">Confirm Password</Label>
            <Input
              id="reset-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
            {confirmPassword && !passwordsMatch && (
              <p className="text-sm text-destructive">Passwords do not match</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              data-testid="reset-pw-submit"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending || !isValid}
            >
              {resetMutation.isPending ? 'Resetting...' : 'Reset Password'}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
