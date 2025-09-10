import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import env from '@fastify/env';

export interface AppOptions {
  logger?: boolean;
  stage?: string;
}

const envSchema = {
  type: 'object',
  required: [],
  properties: {
    NODE_ENV: {
      type: 'string',
      default: 'development'
    },
    STAGE: {
      type: 'string',
      default: 'dev'
    },
    API_VERSION: {
      type: 'string',
      default: '1.0.0'
    }
  }
};

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: opts.logger ?? (process.env.NODE_ENV !== 'production'),
    ajv: {
      customOptions: {
        removeAdditional: 'all'
      }
    }
  });

  // Register environment plugin
  await fastify.register(env, {
    schema: envSchema,
    dotenv: true
  });

  // Register security plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  });

  await fastify.register(cors, {
    origin: (origin: string | undefined, callback: (error: Error | null, allow: boolean) => void) => {
      // In production, you'd want to restrict this to your actual domains
      const isAllowed = !origin || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        // Add your production domains here
        origin.includes('your-domain.com');
      
      callback(null, isAllowed);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  });

  // Health check endpoint
  fastify.get('/health', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      stage: process.env.STAGE || 'dev',
      version: process.env.API_VERSION || '1.0.0'
    };
  });

  // API info endpoint
  fastify.get('/', async () => {
    return {
      name: 'Seedling HQ API',
      version: process.env.API_VERSION || '1.0.0',
      stage: process.env.STAGE || 'dev',
      endpoints: {
        health: '/health',
        api: '/api/v1'
      }
    };
  });

  // Register API routes
  await fastify.register(async function (fastify) {
    // Example API route
    fastify.get('/users', async () => {
      return {
        users: [
          { id: 1, name: 'John Doe', email: 'john@example.com' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
        ]
      };
    });

    fastify.post('/users', {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' }
          }
        }
      }
    }, async (request: FastifyRequest<{
      Body: { name: string; email: string }
    }>, reply: FastifyReply) => {
      const { name, email } = request.body;
      
      // In a real app, you'd save to a database
      const newUser = {
        id: Date.now(), // Simple ID generation for demo
        name,
        email,
        createdAt: new Date().toISOString()
      };

      reply.status(201);
      return newUser;
    });
  }, { prefix: '/api/v1' });

  // 404 handler
  fastify.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404);
    return {
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404
    };
  });

  // Error handler
  fastify.setErrorHandler(async (error, _request: FastifyRequest, reply: FastifyReply) => {
    fastify.log.error(error);

    const statusCode = error.statusCode || 500;
    
    if (statusCode >= 500) {
      reply.status(statusCode);
      return {
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' 
          ? 'Something went wrong' 
          : error.message,
        statusCode
      };
    }

    reply.status(statusCode);
    return {
      error: error.name || 'Error',
      message: error.message,
      statusCode
    };
  });

  return fastify;
}
