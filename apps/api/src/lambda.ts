import awsLambda from '@fastify/aws-lambda';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { buildApp } from './app';

let proxy: ((event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>) | null = null;

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Initialize the Fastify app only once (cold start optimization)
  if (proxy === null) {
    const app = await buildApp({
      logger: process.env.NODE_ENV !== 'production',
      stage: process.env.STAGE || 'dev'
    });

    // Wait for the app to be ready
    await app.ready();
    
    // Create the lambda proxy
    proxy = awsLambda(app, {
      binaryMimeTypes: [
        'application/octet-stream',
        'application/pdf',
        'image/*',
        'audio/*',
        'video/*'
      ]
    });
  }

  // Handle the request
  return proxy(event, context);
};
