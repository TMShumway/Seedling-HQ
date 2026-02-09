import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../../shared/errors.js';

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    request.log.warn({ err: error }, error.message);
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
    });
  }

  // Fastify validation errors
  if (error.validation) {
    return reply.status(400).send({
      error: { code: 'VALIDATION_ERROR', message: error.message },
    });
  }

  request.log.error({ err: error }, 'Unhandled error');
  return reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
}
