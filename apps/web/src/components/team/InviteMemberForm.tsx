import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { isLocalMode, isCognitoMode } from '@/lib/auth/auth-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InviteMemberFormProps {
  callerRole: string;
  onClose: () => void;
}

export function InviteMemberForm({ callerRole, onClose }: InviteMemberFormProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [password, setPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.createUser({
        email,
        fullName,
        role,
        ...(isLocalMode() ? { password } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setSuccessMessage(`${fullName} has been invited successfully.`);
      setEmail('');
      setFullName('');
      setRole('member');
      setPassword('');
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 2000);
    },
  });

  const canCreateAdmin = callerRole === 'owner';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Invite Team Member</CardTitle>
      </CardHeader>
      <CardContent>
        {successMessage && (
          <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
            {successMessage}
          </div>
        )}
        {createMutation.error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create user'}
          </div>
        )}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Full Name</Label>
              <Input
                id="invite-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="member">Member</option>
              {canCreateAdmin && <option value="admin">Admin</option>}
            </select>
          </div>
          {isLocalMode() && (
            <div className="space-y-1.5">
              <Label htmlFor="invite-password">Password</Label>
              <Input
                id="invite-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
              />
            </div>
          )}
          {isCognitoMode() && (
            <p className="text-sm text-muted-foreground">
              A temporary password will be emailed to the new member.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              data-testid="invite-submit-btn"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !email || !fullName || (isLocalMode() && password.length < 8)}
            >
              {createMutation.isPending ? 'Inviting...' : 'Send Invite'}
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
