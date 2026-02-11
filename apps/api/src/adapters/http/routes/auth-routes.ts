import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { UserRepository } from '../../../application/ports/user-repository.js';
import { UnauthorizedError } from '../../../shared/errors.js';
import { buildRateLimiter } from '../middleware/rate-limit.js';
import type { AppConfig } from '../../../shared/config.js';

interface AuthRoutesDeps {
  userRepo: UserRepository;
  config: AppConfig;
}

const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
});

const loginResponseSchema = z.object({
  accounts: z.array(
    z.object({
      tenantId: z.string(),
      tenantName: z.string(),
      userId: z.string(),
      fullName: z.string(),
      role: z.string(),
    }),
  ),
});

export function buildAuthRoutes({ userRepo, config }: AuthRoutesDeps) {
  return async function authRoutes(app: FastifyInstance) {
    const server = app.withTypeProvider<ZodTypeProvider>();

    server.post(
      '/v1/auth/local/login',
      {
        preHandler: buildRateLimiter({ maxRequests: 10 }),
        schema: {
          body: loginBodySchema,
          response: {
            200: loginResponseSchema,
            404: z.object({
              error: z.object({ code: z.string(), message: z.string() }),
            }),
          },
        },
      },
      async (request, reply) => {
        if (config.AUTH_MODE !== 'local') {
          return reply.status(404).send({
            error: { code: 'NOT_FOUND', message: 'Not Found' },
          });
        }

        const email = request.body.email; // already trimmed + lowercased by Zod schema
        const results = await userRepo.listActiveByEmail(email);

        if (results.length === 0) {
          throw new UnauthorizedError('No account found for that email');
        }

        return {
          accounts: results.map(({ user, tenantName }) => ({
            tenantId: user.tenantId,
            tenantName,
            userId: user.id,
            fullName: user.fullName,
            role: user.role,
          })),
        };
      },
    );
  };
}
