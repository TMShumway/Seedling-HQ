import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { InternalAuthContext } from '@seedling/shared';
import type { AppConfig } from '../../../shared/config.js';
import { UnauthorizedError } from '../../../shared/errors.js';
import { getLocalAuthContext } from '../../../infra/auth/local-auth-provider.js';

declare module 'fastify' {
  interface FastifyRequest {
    authContext: InternalAuthContext;
  }
}

export function buildAuthMiddleware(config: AppConfig) {
  return async function authMiddleware(request: FastifyRequest, _reply: FastifyReply) {
    if (config.AUTH_MODE === 'local') {
      if (config.NODE_ENV === 'production') {
        throw new Error('AUTH_MODE=local is not allowed in production');
      }
      request.authContext = getLocalAuthContext(config);
      return;
    }

    // AUTH_MODE=cognito — not implemented in S-001
    throw new UnauthorizedError('Cognito auth not yet implemented');
  };
}

export function registerAuthDecorator(app: FastifyInstance) {
  app.decorateRequest('authContext', null as unknown as InternalAuthContext);
}
