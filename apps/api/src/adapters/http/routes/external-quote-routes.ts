import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { SecureLinkTokenRepository } from '../../../application/ports/secure-link-token-repository.js';
import type { QuoteRepository } from '../../../application/ports/quote-repository.js';
import type { ClientRepository } from '../../../application/ports/client-repository.js';
import type { TenantRepository } from '../../../application/ports/tenant-repository.js';
import type { PropertyRepository } from '../../../application/ports/property-repository.js';
import type { AuditEventRepository } from '../../../application/ports/audit-event-repository.js';
import type { AppConfig } from '../../../shared/config.js';
import { buildExternalTokenMiddleware } from '../middleware/external-token-middleware.js';

export function buildExternalQuoteRoutes(deps: {
  secureLinkTokenRepo: SecureLinkTokenRepository;
  quoteRepo: QuoteRepository;
  clientRepo: ClientRepository;
  tenantRepo: TenantRepository;
  propertyRepo: PropertyRepository;
  auditRepo: AuditEventRepository;
  config: AppConfig;
}) {
  const tokenMiddleware = buildExternalTokenMiddleware({
    secureLinkTokenRepo: deps.secureLinkTokenRepo,
    config: deps.config,
    requiredScope: 'quote:read',
  });

  return async function externalQuoteRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    // GET /v1/ext/quotes/:token
    typedApp.get(
      '/v1/ext/quotes/:token',
      {
        preHandler: tokenMiddleware,
        schema: {
          params: z.object({ token: z.string() }),
        },
      },
      async (request, reply) => {
        const ctx = request.externalAuthContext!;

        const quote = await deps.quoteRepo.getById(ctx.tenantId, ctx.subjectId);
        if (!quote) {
          return reply.status(403).send({
            error: { code: 'LINK_INVALID', message: 'This link is no longer valid.' },
          });
        }

        // Get tenant name
        const tenant = await deps.tenantRepo.getById(ctx.tenantId);
        const businessName = tenant?.name ?? 'Business';

        // Get client name
        const client = await deps.clientRepo.getById(ctx.tenantId, quote.clientId);
        const clientName = client ? `${client.firstName} ${client.lastName}`.trim() : '';

        // Get property address
        let propertyAddress: string | null = null;
        if (quote.propertyId) {
          const properties = await deps.propertyRepo.listByClientId(ctx.tenantId, quote.clientId);
          const property = properties.find((p) => p.id === quote.propertyId);
          if (property) {
            propertyAddress = [
              property.addressLine1,
              property.addressLine2,
              [property.city, property.state, property.zip].filter(Boolean).join(', '),
            ]
              .filter(Boolean)
              .join(', ');
          }
        }

        // Record audit event (best-effort)
        try {
          await deps.auditRepo.record({
            id: randomUUID(),
            tenantId: ctx.tenantId,
            principalType: 'external',
            principalId: ctx.tokenId,
            eventName: 'quote.viewed',
            subjectType: 'quote',
            subjectId: quote.id,
            correlationId: request.correlationId,
          });
        } catch {
          // best-effort
        }

        return {
          quote: {
            id: quote.id,
            title: quote.title,
            lineItems: quote.lineItems,
            subtotal: quote.subtotal,
            tax: quote.tax,
            total: quote.total,
            status: quote.status,
            sentAt: quote.sentAt?.toISOString() ?? null,
            createdAt: quote.createdAt.toISOString(),
          },
          businessName,
          clientName,
          propertyAddress,
        };
      },
    );
  };
}
