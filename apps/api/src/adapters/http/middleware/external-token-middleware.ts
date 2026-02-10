import type { FastifyRequest, FastifyReply } from 'fastify';
import type { SecureLinkTokenRepository } from '../../../application/ports/secure-link-token-repository.js';
import type { AppConfig } from '../../../shared/config.js';
import { hashToken } from '../../../shared/crypto.js';

export interface ExternalAuthContext {
  tenantId: string;
  subjectType: string;
  subjectId: string;
  scopes: string[];
  tokenId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    externalAuthContext: ExternalAuthContext | null;
  }
}

export function buildExternalTokenMiddleware(deps: {
  secureLinkTokenRepo: SecureLinkTokenRepository;
  config: AppConfig;
  requiredScope: string;
  requiredSubjectType?: string;
}) {
  return async function externalTokenMiddleware(
    request: FastifyRequest<{ Params: { token: string } }>,
    reply: FastifyReply,
  ) {
    const rawToken = request.params.token;
    if (!rawToken) {
      return reply.status(403).send({
        error: { code: 'LINK_INVALID', message: 'This link is no longer valid.' },
      });
    }

    const tokenHash = hashToken(deps.config.SECURE_LINK_HMAC_SECRET, rawToken);
    const token = await deps.secureLinkTokenRepo.getByTokenHash(tokenHash);

    if (!token) {
      return reply.status(403).send({
        error: { code: 'LINK_INVALID', message: 'This link is no longer valid.' },
      });
    }

    if (token.expiresAt < new Date()) {
      return reply.status(403).send({
        error: { code: 'LINK_INVALID', message: 'This link is no longer valid.' },
      });
    }

    if (token.revokedAt !== null) {
      return reply.status(403).send({
        error: { code: 'LINK_INVALID', message: 'This link is no longer valid.' },
      });
    }

    if (!token.scopes.includes(deps.requiredScope)) {
      return reply.status(403).send({
        error: { code: 'LINK_INVALID', message: 'This link is no longer valid.' },
      });
    }

    if (deps.requiredSubjectType && token.subjectType !== deps.requiredSubjectType) {
      return reply.status(403).send({
        error: { code: 'LINK_INVALID', message: 'This link is no longer valid.' },
      });
    }

    // Update last used timestamp (best-effort)
    deps.secureLinkTokenRepo.updateLastUsedAt(token.id).catch(() => {});

    request.externalAuthContext = {
      tenantId: token.tenantId,
      subjectType: token.subjectType,
      subjectId: token.subjectId,
      scopes: token.scopes,
      tokenId: token.id,
    };
  };
}
