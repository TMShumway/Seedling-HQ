#!/usr/bin/env node
/**
 * Simple Express development server for local API development
 * Bypasses serverless-offline and Yarn PnP compatibility issues
 */

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mock Lambda context for development
const createMockContext = () => ({
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'dev-function',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:dev-function',
  memoryLimitInMB: '128',
  awsRequestId: 'mock-request-id',
  logGroupName: '/aws/lambda/dev-function',
  logStreamName: '2025/01/01/[$LATEST]mock-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {}
});

// Convert Express req/res to Lambda event/context format
const createLambdaEvent = (req) => ({
  httpMethod: req.method,
  path: req.path,
  pathParameters: req.params || {},
  queryStringParameters: req.query || {},
  headers: req.headers || {},
  body: req.body ? JSON.stringify(req.body) : null,
  isBase64Encoded: false,
  requestContext: {
    requestId: 'dev-request-id',
    stage: 'dev',
    httpMethod: req.method,
    resourcePath: req.path
  }
});

// Convert Lambda response to Express response
const sendLambdaResponse = (res, lambdaResponse) => {
  const statusCode = lambdaResponse.statusCode || 200;
  const headers = lambdaResponse.headers || {};
  
  // Set headers
  Object.entries(headers).forEach(([key, value]) => {
    res.set(key, value);
  });
  
  // Send response
  if (lambdaResponse.body) {
    try {
      const body = JSON.parse(lambdaResponse.body);
      res.status(statusCode).json(body);
    } catch {
      res.status(statusCode).send(lambdaResponse.body);
    }
  } else {
    res.status(statusCode).end();
  }
};

// Customer routes
app.get('/dev/customers', async (req, res) => {
  try {
    // Import the Lambda handler dynamically from compiled dist folder
    const { listCustomers } = await import('./dist/handlers/customers.js');
    
    const event = createLambdaEvent(req);
    const context = createMockContext();
    
    const result = await listCustomers(event, context);
    sendLambdaResponse(res, result);
  } catch (error) {
    console.error('Error handling /dev/customers:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST customers route
app.post('/dev/customers', async (req, res) => {
  try {
    const { createCustomer } = await import('./dist/handlers/customers.js');
    
    const event = createLambdaEvent(req);
    const context = createMockContext();
    
    const result = await createCustomer(event, context);
    sendLambdaResponse(res, result);
  } catch (error) {
    console.error('Error handling POST /dev/customers:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET customer by ID route
app.get('/dev/customers/:id', async (req, res) => {
  try {
    const { getCustomer } = await import('./dist/handlers/customers.js');
    
    const event = createLambdaEvent(req);
    // Add path parameters
    event.pathParameters = { id: req.params.id };
    const context = createMockContext();
    
    const result = await getCustomer(event, context);
    sendLambdaResponse(res, result);
  } catch (error) {
    console.error('Error handling GET /dev/customers/:id:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API Development Server running at:`);
  console.log(`   Local: http://localhost:${PORT}`);
  console.log('');
  console.log('📋 Available endpoints:');
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  /dev/customers - List customers`);
  console.log(`   POST /dev/customers - Create customer`);
  console.log(`   GET  /dev/customers/:id - Get customer by ID`);
  console.log('');
  console.log('🔄 Watching for changes... (restart server to pick up handler changes)');
});
