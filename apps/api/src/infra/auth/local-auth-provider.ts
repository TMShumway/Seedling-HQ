import type { InternalAuthContext } from '@seedling/shared';
import type { AppConfig } from '../../shared/config.js';

export function getLocalAuthContext(
  config: AppConfig,
  headers?: { tenantId?: string; userId?: string },
): InternalAuthContext {
  return {
    principal_type: 'internal',
    tenant_id: headers?.tenantId || config.DEV_AUTH_TENANT_ID,
    user_id: headers?.userId || config.DEV_AUTH_USER_ID,
    role: config.DEV_AUTH_ROLE,
  };
}
