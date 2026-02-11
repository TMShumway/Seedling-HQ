import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { InternalAuthContext } from '@seedling/shared';
import type { AppConfig } from '../../../shared/config.js';
import type { JwtVerifier } from '../../../application/ports/jwt-verifier.js';
import { UnauthorizedError } from '../../../shared/errors.js';
import { getLocalAuthContext } from '../../../infra/auth/local-auth-provider.js';

declare module 'fastify' {
  interface FastifyRequest {
    authContext: InternalAuthContext;
  }
}

export function buildAuthMiddleware(deps: { config: AppConfig; jwtVerifier?: JwtVerifier }) {
  const { config, jwtVerifier } = deps;

  return async function authMiddleware(request: FastifyRequest, _reply: FastifyReply) {
    if (config.AUTH_MODE === 'local') {
      if (config.NODE_ENV === 'production') {
        throw new Error('AUTH_MODE=local is not allowed in production');
      }
      request.authContext = getLocalAuthContext(config, {
        tenantId: request.headers['x-dev-tenant-id'] as string | undefined,
        userId: request.headers['x-dev-user-id'] as string | undefined,
      });
      return;
    }

    // AUTH_MODE=cognito
    if (!jwtVerifier) {
      throw new Error('AUTH_MODE=cognito requires a JwtVerifier instance');
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const result = await jwtVerifier.verify(token);
      request.authContext = {
        tenant_id: result.tenantId,
        user_id: result.userId,
        role: result.role,
        principal_type: 'internal',
      };
    } catch (err) {
      request.log.warn({ err }, 'JWT verification failed');
      throw new UnauthorizedError('Invalid or expired token');
    }
  };
}

export function registerAuthDecorator(app: FastifyInstance) {
  app.decorateRequest('authContext', null as unknown as InternalAuthContext);
}
