import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UsersRound, Mail, Plus } from 'lucide-react';
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
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeColors[role] ?? 'bg-gray-100 text-gray-800'}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeColors[status] ?? 'bg-gray-100 text-gray-800'}`}>
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

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function MemberCard({
  user,
  callerRole,
  currentUserId,
  onResetPassword,
}: {
  user: UserResponse;
  callerRole: string;
  currentUserId: string | undefined;
  onResetPassword: () => void;
}) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-4"
      data-testid="member-card"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {getInitials(user.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{user.fullName}</span>
            <RoleBadge role={user.role} />
            <StatusBadge status={user.status} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {user.email}
            </span>
            <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        {canResetPassword(callerRole, user.role) && user.id !== currentUserId && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            data-testid={`reset-pw-${user.id}`}
            onClick={onResetPassword}
          >
            Reset Password
          </Button>
        )}
      </div>
    </div>
  );
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
      <div className="mx-auto max-w-3xl space-y-4" data-testid="team-page">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  }

  if (teamQuery.error) {
    return (
      <div className="text-destructive" data-testid="team-page">
        Failed to load team. Please try again.
      </div>
    );
  }

  const users = teamQuery.data?.users ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="team-page">
      {/* Header */}
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
            <Plus className="h-4 w-4" />
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

      {/* Member list */}
      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center" data-testid="empty-state">
          <UsersRound className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No team members yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite your first team member to get started.
          </p>
          {canCreateUser(callerRole) && (
            <Button className="mt-4" onClick={() => setShowInviteForm(true)}>
              <Plus className="h-4 w-4" />
              Invite Member
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <MemberCard
              key={u.id}
              user={u}
              callerRole={callerRole}
              currentUserId={authUser?.userId}
              onResetPassword={() => setResetTarget(u)}
            />
          ))}
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
