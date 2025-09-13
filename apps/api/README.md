# Seedling HQ API

A modern serverless API built with **Fastify** and **AWS Lambda**, featuring TypeScript, comprehensive security, and development-friendly tooling.

## 🚀 Features

- **Fastify Framework** - High-performance web framework for Node.js
- **AWS Lambda Serverless** - Scalable, pay-per-use deployment
- **TypeScript** - Full type safety and modern JavaScript features  
- **Security First** - CORS, Helmet, Rate limiting, and input validation
- **Development Experience** - Hot reload, comprehensive logging, and debugging tools
- **Serverless Framework** - Infrastructure as Code with easy deployment
- **Environment Management** - Stage-specific configuration (dev, staging, prod)

## 📁 Project Structure

```
src/
├── app.ts          # Main Fastify application with plugins and routes
├── lambda.ts       # AWS Lambda handler wrapper
├── dev-server.ts   # Local development server
└── index.ts        # Package exports
```

## 🛠️ Development

### Prerequisites

- Node.js 18+ (required for Lambda runtime compatibility)
- AWS CLI configured (for deployment)
- Corepack enabled: `corepack enable`

### Setup

```bash
# Install dependencies
yarn install

# Copy environment template
cp .env.example .env

# Build the project
yarn build

# Start development server
yarn dev
```

### Available Scripts

- `yarn build` - Compile TypeScript to JavaScript
- `yarn dev` - Start local development server on port 3001
- `yarn dev:watch` - Start with file watching and auto-restart
- `yarn offline` - Run serverless offline (simulates Lambda locally)
- `yarn type-check` - Run TypeScript type checking
- `yarn lint` - Run ESLint code linting
- `yarn clean` - Clean build artifacts and serverless cache

## 🚢 Deployment

### Local Testing

```bash
# Start local development server
yarn dev

# Or test with serverless offline (simulates API Gateway + Lambda)
yarn offline
```

The API will be available at:
- 🌐 **Base URL**: http://localhost:3001
- 🔍 **Health Check**: http://localhost:3001/health
- 📚 **API Routes**: http://localhost:3001/api/v1

### AWS Deployment

```bash
# Deploy to development stage
yarn deploy:dev

# Deploy to production stage  
yarn deploy:prod

# View deployment logs
yarn logs

# Remove deployment
yarn remove
```

### Environment Stages

| Stage | Description | NODE_ENV |
|-------|-------------|----------|
| `dev` | Development environment | `development` |
| `staging` | Pre-production testing | `production` |
| `prod` | Production environment | `production` |

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Required
NODE_ENV=development
STAGE=dev
API_VERSION=1.0.0

# Optional
PORT=3001
HOST=0.0.0.0
AWS_REGION=us-east-1
```

### Serverless Configuration

The `serverless.yml` file controls deployment settings:

- **Runtime**: Node.js 18.x
- **Memory**: 512MB (adjustable)
- **Timeout**: 30 seconds
- **Region**: us-east-1 (configurable)

## 🔒 Security Features

- **CORS Protection** - Configurable origins for cross-origin requests
- **Helmet Security** - Security headers and CSP policies
- **Rate Limiting** - 100 requests per minute (configurable)
- **Input Validation** - JSON schema validation with Ajv
- **Error Handling** - Structured error responses with appropriate status codes

## 📡 API Endpoints

### Core Endpoints

- `GET /` - API information and available endpoints
- `GET /health` - Health check with timestamp and version info

### Example API Routes (`/api/v1`)

- `GET /api/v1/users` - List users (demo data)
- `POST /api/v1/users` - Create user (with validation)

### Response Format

```json
{
  "users": [
    {
      "id": 1,
      "name": "John Doe", 
      "email": "john@example.com"
    }
  ]
}
```

### Error Response Format

```json
{
  "error": "Validation Error",
  "message": "Invalid email format",
  "statusCode": 400
}
```

## 🔧 Architecture Notes

### Lambda Handler

The `lambda.ts` file uses `aws-lambda-fastify` to wrap the Fastify application for AWS Lambda execution. It includes:

- **Cold Start Optimization** - App initialization is cached between invocations
- **Binary Support** - Handles images, PDFs, and other binary content
- **Request Decoration** - Adds Lambda context to Fastify requests

### Plugin Architecture

The Fastify app uses a plugin-based architecture:

1. **Environment Plugin** (`@fastify/env`) - Environment variable validation
2. **Security Plugins** - Helmet, CORS, Rate limiting  
3. **Route Registration** - Modular route definitions with prefixes
4. **Error Handling** - Global error handlers with structured responses

### TypeScript Configuration

- **Target**: ES2022 (Lambda-compatible)
- **Module**: CommonJS (required for Lambda)
- **Strict Mode**: Enabled for type safety
- **Declaration Files**: Generated for library usage

## 🐛 Debugging

### Local Development

```bash
# Start with detailed logging
NODE_ENV=development yarn dev

# Check health endpoint
curl http://localhost:3001/health

# Test API endpoint
curl -X POST http://localhost:3001/api/v1/users \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Test User","email":"test@example.com"}'
```

### AWS Lambda Debugging

```bash
# View CloudWatch logs
yarn logs

# Deploy with debug logging
STAGE=dev NODE_ENV=development yarn deploy:dev
```

## 🤝 Integration

### Using in Other Packages

```typescript
import { buildApp, API_VERSION } from '@seedling-hq/api';

const app = await buildApp({ 
  logger: true, 
  stage: 'dev' 
});

await app.listen({ port: 3001 });
```

### Web App Integration

Update your web app to point to the API:

```typescript
// Development
const API_BASE = 'http://localhost:3001/api/v1';

// Production (after deployment)
const API_BASE = 'https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/api/v1';
```

## 📚 Next Steps

1. **Database Integration** - Add DynamoDB, PostgreSQL, or MongoDB
2. **Authentication** - Implement JWT or OAuth2 
3. **API Documentation** - Add Swagger/OpenAPI documentation
4. **Testing** - Add unit and integration tests
5. **Monitoring** - Set up CloudWatch alarms and metrics
6. **CI/CD** - Automate deployment with GitHub Actions

## 🆘 Troubleshooting

### Common Issues

**Module Resolution Errors**
- Ensure TypeScript config uses CommonJS modules
- Check that file extensions use `.js` in imports (TypeScript requirement)

**Lambda Deployment Fails**  
- Verify AWS credentials: `aws sts get-caller-identity`
- Check IAM permissions for Lambda, API Gateway, and CloudFormation

**CORS Issues**
- Update CORS origins in `app.ts`
- Verify API Gateway CORS configuration in `serverless.yml`

**Cold Start Performance**
- Consider increasing memory allocation in `serverless.yml`
- Implement connection pooling for databases
- Use provisioned concurrency for critical endpoints
