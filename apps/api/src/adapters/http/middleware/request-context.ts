import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
    correlationId: string;
  }
}

export function registerRequestContext(app: FastifyInstance) {
  app.decorateRequest('requestId', '');
  app.decorateRequest('correlationId', '');

  app.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    request.requestId = randomUUID();
    request.correlationId =
      (request.headers['x-correlation-id'] as string | undefined) ?? randomUUID();

    request.log = request.log.child({
      request_id: request.requestId,
      correlation_id: request.correlationId,
    });
  });
}
