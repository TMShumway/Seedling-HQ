// Seedling HQ API - Fastify Serverless Application
export const API_VERSION = '1.0.0';

// Export main application builder
export { buildApp } from './app';
export type { AppOptions } from './app';

// Export lambda handler for serverless deployment
export { handler } from './lambda';
