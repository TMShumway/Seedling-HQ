import { Navigate } from 'react-router';
import type { ReactNode } from 'react';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const tenantId = localStorage.getItem('dev_tenant_id');
  const userId = localStorage.getItem('dev_user_id');

  if (!tenantId || !userId) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
