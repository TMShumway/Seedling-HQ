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

    // Create the lambda proxy before calling app.ready()
    proxy = awsLambda(app, {
      binaryMimeTypes: [
        'application/octet-stream',
        'application/pdf',
        'image/*',
        'audio/*',
        'video/*'
      ]
    });
    
    // Wait for the app to be ready after lambda proxy is created
    await app.ready();
  }

  // Handle the request
  return proxy(event, context);
};
