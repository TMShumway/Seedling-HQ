import type { FastifyInstance } from 'fastify';
import type { UserRepository } from '../../../application/ports/user-repository.js';
import { NotFoundError } from '../../../shared/errors.js';
import { buildAuthMiddleware } from '../middleware/auth-middleware.js';
import type { AppConfig } from '../../../shared/config.js';
import type { JwtVerifier } from '../../../application/ports/jwt-verifier.js';

export function buildUserRoutes(deps: { userRepo: UserRepository; config: AppConfig; jwtVerifier?: JwtVerifier }) {
  const authMiddleware = buildAuthMiddleware({ config: deps.config, jwtVerifier: deps.jwtVerifier });

  return async function userRoutes(app: FastifyInstance) {
    // GET /v1/users/me — authenticated
    app.get('/v1/users/me', { preHandler: authMiddleware }, async (request) => {
      const user = await deps.userRepo.getById(
        request.authContext.tenant_id,
        request.authContext.user_id,
      );
      if (!user) {
        throw new NotFoundError('User not found');
      }
      return {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      };
    });
  };
}
