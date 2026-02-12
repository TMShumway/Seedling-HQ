import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { UserResponse } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { isLocalMode } from '@/lib/auth/auth-config';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { InviteMemberForm } from '@/components/team/InviteMemberForm';
import { ResetPasswordDialog } from '@/components/team/ResetPasswordDialog';

const roleBadgeColors: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800',
  admin: 'bg-blue-100 text-blue-800',
  member: 'bg-gray-100 text-gray-800',
};

const statusBadgeColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  disabled: 'bg-red-100 text-red-800',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${roleBadgeColors[role] ?? 'bg-gray-100 text-gray-800'}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusBadgeColors[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function canCreateUser(callerRole: string): boolean {
  return callerRole === 'owner' || callerRole === 'admin';
}

function canResetPassword(callerRole: string, targetRole: string): boolean {
  if (!isLocalMode()) return false;
  if (callerRole === 'owner' && (targetRole === 'admin' || targetRole === 'member')) return true;
  if (callerRole === 'admin' && targetRole === 'member') return true;
  return false;
}

export function TeamPage() {
  const { user: authUser } = useAuth();
  const callerRole = authUser?.role ?? '';

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserResponse | null>(null);

  const teamQuery = useQuery({
    queryKey: ['team'],
    queryFn: () => apiClient.listUsers(),
  });

  if (teamQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-5 w-56" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (teamQuery.error) {
    return (
      <div className="text-destructive">Failed to load team. Please try again.</div>
    );
  }

  const users = teamQuery.data?.users ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your team members and their roles.
          </p>
        </div>
        {canCreateUser(callerRole) && (
          <Button
            data-testid="invite-member-btn"
            onClick={() => setShowInviteForm(true)}
            disabled={showInviteForm}
          >
            Invite Member
          </Button>
        )}
      </div>

      {showInviteForm && (
        <InviteMemberForm
          callerRole={callerRole}
          onClose={() => setShowInviteForm(false)}
        />
      )}

      {users.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No team members yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Joined</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{u.fullName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canResetPassword(callerRole, u.role) && u.id !== authUser?.userId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`reset-pw-${u.id}`}
                        onClick={() => setResetTarget(u)}
                      >
                        Reset Password
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resetTarget && (
        <ResetPasswordDialog
          user={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}
