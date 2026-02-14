import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { VisitWithContextResponse } from '@/lib/api-types';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ScheduleVisitModalProps {
  visit: VisitWithContextResponse;
  onClose: () => void;
  onSuccess: () => void;
}

/** Format a Date for <input type="datetime-local"> (YYYY-MM-DDTHH:MM) */
function formatForDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parse a datetime-local string to a local Date, then produce UTC ISO string */
function parseDatetimeLocal(str: string): string {
  const d = new Date(str);
  return d.toISOString();
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export function ScheduleVisitModal({ visit, onClose, onSuccess }: ScheduleVisitModalProps) {
  const isReschedule = visit.scheduledStart !== null;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canAssign = user?.role === 'owner' || user?.role === 'admin';

  const [startValue, setStartValue] = useState(() => {
    if (visit.scheduledStart) {
      return formatForDatetimeLocal(new Date(visit.scheduledStart));
    }
    // Default to tomorrow at 9 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return formatForDatetimeLocal(tomorrow);
  });

  const [selectedUserId, setSelectedUserId] = useState<string>(visit.assignedUserId ?? '');
  const [assignError, setAssignError] = useState<string | null>(null);

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.listUsers(),
    enabled: canAssign,
    staleTime: 5 * 60 * 1000, // cache for 5 min
  });

  const activeUsers = usersData?.users.filter((u) => u.status === 'active') ?? [];

  const startDate = new Date(startValue);
  const endDate = addMinutes(startDate, visit.estimatedDurationMinutes);
  const endDisplay = isNaN(endDate.getTime())
    ? '—'
    : endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const invalidateVisitQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['visits'] });
    queryClient.invalidateQueries({ queryKey: ['unscheduled-visits'] });
  };

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const assignmentChanged = canAssign && (selectedUserId || '') !== (visit.assignedUserId ?? '');
      const newAssignedUserId = selectedUserId || null;

      if (isReschedule) {
        // Check if time actually changed
        const currentStartIso = visit.scheduledStart ? new Date(visit.scheduledStart).toISOString() : null;
        const newStartIso = parseDatetimeLocal(startValue);
        const timeChanged = currentStartIso !== newStartIso;

        if (timeChanged) {
          await apiClient.scheduleVisit(visit.id, {
            scheduledStart: newStartIso,
          });
        }

        if (assignmentChanged) {
          try {
            await apiClient.assignVisit(visit.id, { assignedUserId: newAssignedUserId });
          } catch {
            if (timeChanged) {
              // Schedule succeeded but assign failed — partial success
              setAssignError('Visit time saved, but assignment failed — please try assigning again.');
              invalidateVisitQueries();
              return { partial: true };
            }
            throw new Error('Failed to assign technician');
          }
        }

        if (!timeChanged && !assignmentChanged) {
          // Nothing changed — just close
        }
      } else {
        // New schedule
        await apiClient.scheduleVisit(visit.id, {
          scheduledStart: parseDatetimeLocal(startValue),
        });

        if (assignmentChanged) {
          try {
            await apiClient.assignVisit(visit.id, { assignedUserId: newAssignedUserId });
          } catch {
            setAssignError('Visit time saved, but assignment failed — please try assigning again.');
            invalidateVisitQueries();
            return { partial: true };
          }
        }
      }

      return { partial: false };
    },
    onSuccess: (result) => {
      if (!result?.partial) {
        invalidateVisitQueries();
        onSuccess();
        onClose();
      }
    },
  });

  const isValid = !isNaN(startDate.getTime());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <Card data-testid="schedule-modal">
          <CardHeader>
            <CardTitle className="text-lg">
              {isReschedule ? 'Reschedule Visit' : 'Schedule Visit'}
            </CardTitle>
            <CardDescription>
              {visit.jobTitle} — {visit.clientName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scheduleMutation.error && !assignError && (
              <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {scheduleMutation.error instanceof Error ? scheduleMutation.error.message : 'Failed to schedule visit'}
              </div>
            )}
            {assignError && (
              <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                {assignError}
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="schedule-start">Start Date & Time</Label>
                <input
                  id="schedule-start"
                  type="datetime-local"
                  value={startValue}
                  onChange={(e) => setStartValue(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="schedule-start-input"
                />
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Duration: {visit.estimatedDurationMinutes} min</span>
                <span>Ends at: {endDisplay}</span>
              </div>

              {canAssign && (
                <div className="space-y-1.5">
                  <Label htmlFor="assign-user">Assign to</Label>
                  <select
                    id="assign-user"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="assign-user-select"
                  >
                    <option value="">Unassigned</option>
                    {activeUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  data-testid="schedule-submit"
                  onClick={() => scheduleMutation.mutate()}
                  disabled={scheduleMutation.isPending || !isValid}
                >
                  {scheduleMutation.isPending
                    ? 'Saving...'
                    : isReschedule
                      ? 'Save'
                      : 'Schedule'}
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
