import { randomUUID } from 'node:crypto';
import type { UserRepository } from '../ports/user-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import type { CognitoProvisioner } from '../ports/cognito-provisioner.js';
import type { User } from '../../domain/entities/user.js';
import type { Role } from '../../domain/types/roles.js';
import type { AppConfig } from '../../shared/config.js';
import { ConflictError, ForbiddenError, ValidationError } from '../../shared/errors.js';
import { hashPassword } from '../../shared/password.js';

export interface CreateUserInput {
  tenantId: string;
  email: string;
  fullName: string;
  role: Role;
  password?: string;
  callerRole: string;
  callerUserId: string;
  correlationId: string;
}

export class CreateUserUseCase {
  constructor(
    private config: AppConfig,
    private cognitoProvisioner?: CognitoProvisioner,
  ) {}

  async execute(input: CreateUserInput, uow: UnitOfWork, userRepo: UserRepository): Promise<{ user: User }> {
    // Validate role is admin or member (cannot create owner)
    if (input.role === 'owner') {
      throw new ValidationError('Cannot create a user with the owner role');
    }

    // Role hierarchy: owner can create admin/member, admin can create member only
    if (input.callerRole === 'admin' && input.role !== 'member') {
      throw new ForbiddenError('Admins can only create members');
    }
    if (input.callerRole === 'member') {
      throw new ForbiddenError('Members cannot create users');
    }

    // Check for existing user with same email in tenant
    const existing = await userRepo.getByEmail(input.tenantId, input.email);

    if (existing && existing.status === 'active') {
      throw new ConflictError('Email already in use');
    }

    let user: User;

    if (existing && existing.status === 'disabled') {
      // Re-provision path: reuse existing userId, update fields
      const passwordHash = input.password ? await hashPassword(input.password) : null;
      const updated = await userRepo.updateUser(input.tenantId, existing.id, {
        fullName: input.fullName,
        role: input.role,
        status: 'active',
        passwordHash,
      });
      user = updated!;

      // Best-effort audit for re-provision
      try {
        await uow.run(async ({ auditRepo }) => {
          await auditRepo.record({
            id: randomUUID(),
            tenantId: input.tenantId,
            principalType: 'internal',
            principalId: input.callerUserId,
            eventName: 'user.reprovisioned',
            subjectType: 'user',
            subjectId: existing.id,
            correlationId: input.correlationId,
          });
        });
      } catch {
        // Best-effort audit — don't fail the operation
      }
    } else {
      // New user path
      const userId = randomUUID();
      const passwordHash = input.password ? await hashPassword(input.password) : null;

      user = await uow.run(async ({ userRepo: txUserRepo, auditRepo }) => {
        const created = await txUserRepo.create({
          id: userId,
          tenantId: input.tenantId,
          email: input.email,
          fullName: input.fullName,
          role: input.role,
          passwordHash,
          status: 'active',
        });

        await auditRepo.record({
          id: randomUUID(),
          tenantId: input.tenantId,
          principalType: 'internal',
          principalId: input.callerUserId,
          eventName: 'user.created',
          subjectType: 'user',
          subjectId: userId,
          correlationId: input.correlationId,
        });

        return created;
      });
    }

    // Cognito provisioning (outside UoW — external service call)
    if (this.config.AUTH_MODE === 'cognito' && this.cognitoProvisioner) {
      try {
        await this.cognitoProvisioner.provisionUser({
          username: user.id,
          email: input.email,
          tenantId: input.tenantId,
          groupName: input.role,
        });
      } catch (err) {
        // Mark user as disabled on Cognito failure
        await userRepo.updateStatus(input.tenantId, user.id, 'disabled');
        throw new Error(
          `User created but Cognito provisioning failed. Retry to re-provision. Original error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { user };
  }
}
