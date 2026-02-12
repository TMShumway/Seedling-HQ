import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { UserRepository } from '../../../application/ports/user-repository.js';
import type { UnitOfWork } from '../../../application/ports/unit-of-work.js';
import type { AuditEventRepository } from '../../../application/ports/audit-event-repository.js';
import type { CognitoProvisioner } from '../../../application/ports/cognito-provisioner.js';
import { CreateUserUseCase } from '../../../application/usecases/create-user.js';
import { NotFoundError, ForbiddenError } from '../../../shared/errors.js';
import { hashPassword, verifyPassword } from '../../../shared/password.js';
import { buildAuthMiddleware } from '../middleware/auth-middleware.js';
import { buildRateLimiter } from '../middleware/rate-limit.js';
import type { AppConfig } from '../../../shared/config.js';
import type { JwtVerifier } from '../../../application/ports/jwt-verifier.js';
import { randomUUID } from 'node:crypto';

const userResponseShape = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string(),
  fullName: z.string(),
  role: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

function toUserResponse(user: { id: string; tenantId: string; email: string; fullName: string; role: string; status: string; createdAt: Date; updatedAt: Date }) {
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
}

interface UserRoutesDeps {
  userRepo: UserRepository;
  auditRepo: AuditEventRepository;
  uow: UnitOfWork;
  config: AppConfig;
  jwtVerifier?: JwtVerifier;
  cognitoProvisioner?: CognitoProvisioner;
}

export function buildUserRoutes(deps: UserRoutesDeps) {
  const authMiddleware = buildAuthMiddleware({ config: deps.config, jwtVerifier: deps.jwtVerifier });

  // Mode-specific create user body schemas
  const baseFields = {
    email: z.string().trim().toLowerCase().email().max(255),
    fullName: z.string().min(1).max(255),
    role: z.enum(['admin', 'member']),
  };
  const localCreateSchema = z.object({ ...baseFields, password: z.string().min(8).max(128) });
  const cognitoCreateSchema = z.object(baseFields).strict();
  const createUserBodySchema = deps.config.AUTH_MODE === 'local' ? localCreateSchema : cognitoCreateSchema;

  const resetPasswordSchema = z.object({
    password: z.string().min(8).max(128),
  });

  const createUserUseCase = new CreateUserUseCase(deps.config, deps.cognitoProvisioner);

  return async function userRoutes(app: FastifyInstance) {
    const server = app.withTypeProvider<ZodTypeProvider>();

    // GET /v1/users/me — authenticated
    server.get('/v1/users/me', { preHandler: authMiddleware }, async (request) => {
      const user = await deps.userRepo.getById(
        request.authContext.tenant_id,
        request.authContext.user_id,
      );
      if (!user) {
        throw new NotFoundError('User not found');
      }
      return toUserResponse(user);
    });

    // GET /v1/users — list team members (all roles)
    server.get(
      '/v1/users',
      {
        preHandler: authMiddleware,
        schema: {
          response: {
            200: z.object({ users: z.array(userResponseShape) }),
          },
        },
      },
      async (request) => {
        const users = await deps.userRepo.listByTenantId(request.authContext.tenant_id);
        return { users: users.map(toUserResponse) };
      },
    );

    // POST /v1/users — create team member (owner/admin only)
    server.post(
      '/v1/users',
      {
        preHandler: authMiddleware,
        schema: {
          body: createUserBodySchema,
          response: {
            201: z.object({ user: userResponseShape }),
          },
        },
      },
      async (request, reply) => {
        const body = request.body as z.infer<typeof localCreateSchema>;
        const { user } = await createUserUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            email: body.email,
            fullName: body.fullName,
            role: body.role,
            password: body.password,
            callerRole: request.authContext.role,
            callerUserId: request.authContext.user_id,
            correlationId: request.id as string,
          },
          deps.uow,
          deps.userRepo,
        );
        return reply.status(201).send({ user: toUserResponse(user) });
      },
    );

    // POST /v1/users/:id/reset-password — admin password reset (owner/admin only)
    server.post(
      '/v1/users/:id/reset-password',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          body: resetPasswordSchema,
          response: {
            200: z.object({ success: z.boolean() }),
          },
        },
      },
      async (request) => {
        const { id } = request.params;
        const { password } = request.body;
        const callerRole = request.authContext.role;

        // Cannot reset own password via this endpoint
        if (id === request.authContext.user_id) {
          throw new ForbiddenError('Use the change password endpoint to change your own password');
        }

        // Member cannot reset anyone
        if (callerRole === 'member') {
          throw new ForbiddenError('Members cannot reset passwords');
        }

        const targetUser = await deps.userRepo.getById(request.authContext.tenant_id, id);
        if (!targetUser) {
          throw new NotFoundError('User not found');
        }

        // Nobody resets owner
        if (targetUser.role === 'owner') {
          throw new ForbiddenError('Cannot reset owner password');
        }

        // Admin can only reset member
        if (callerRole === 'admin' && targetUser.role !== 'member') {
          throw new ForbiddenError('Admins can only reset member passwords');
        }

        if (deps.config.AUTH_MODE === 'local') {
          const passwordHash = await hashPassword(password);
          await deps.userRepo.updatePasswordHash(request.authContext.tenant_id, id, passwordHash);
        } else if (deps.config.AUTH_MODE === 'cognito' && deps.cognitoProvisioner) {
          await deps.cognitoProvisioner.setUserPassword(targetUser.id, password, false);
        }

        // Best-effort audit
        try {
          await deps.auditRepo.record({
            id: randomUUID(),
            tenantId: request.authContext.tenant_id,
            principalType: 'internal',
            principalId: request.authContext.user_id,
            eventName: 'user.password_reset',
            subjectType: 'user',
            subjectId: id,
            correlationId: request.id as string,
          });
        } catch {
          // Best-effort
        }

        return { success: true };
      },
    );
  };
}
