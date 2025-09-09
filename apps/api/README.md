# @seedling-hq/api-app

Serverless API backend for Seedling HQ built with AWS Lambda, following Clean Architecture principles.

## Architecture

This API app serves as the **dependency injection container** and **HTTP interface** that wires together all our Clean Architecture components:

```
HTTP Request → Lambda Handler → Use Case → Repository → Database
            ↑                  ↑         ↑           ↑
            Infrastructure    Application Domain    Infrastructure
            Layer            Layer       Layer      Layer
```

### Clean Architecture Layers

- **Infrastructure**: Lambda handlers, HTTP utilities, database adapters
- **Application**: Use cases orchestrating business logic
- **Domain**: Entities with business rules (Customer)
- **Ports**: Interfaces defining contracts between layers

## API Endpoints

### Customers

- `POST /customers` - Create a new customer
- `GET /customers/{id}` - Get customer by ID  
- `GET /customers` - List customers with pagination

### Request/Response Examples

#### Create Customer
```bash
POST /customers
{
  "email": "john.doe@example.com",
  "name": "John Doe",
  "phoneNumber": "+1-555-0123"  // optional
}

# Response (201 Created)
{
  "success": true,
  "data": {
    "customer": {
      "id": "cust_V1StGXR8_Z5j",
      "email": "john.doe@example.com",
      "name": "John Doe",
      "phoneNumber": "+1-555-0123",
      "isActive": true,
      "createdAt": "2025-09-09T03:45:00.000Z"
    }
  }
}
```

#### Get Customer
```bash
GET /customers/cust_V1StGXR8_Z5j

# Response (200 OK)
{
  "success": true,
  "data": {
    "customer": {
      "id": "cust_V1StGXR8_Z5j",
      "email": "john.doe@example.com",
      "name": "John Doe",
      "phoneNumber": "+1-555-0123",
      "isActive": true,
      "createdAt": "2025-09-09T03:45:00.000Z"
    }
  }
}
```

#### List Customers
```bash
GET /customers?limit=10&offset=0&isActive=true

# Response (200 OK)
{
  "success": true,
  "data": {
    "customers": [...],
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 25,
      "hasMore": true
    }
  }
}
```

## Development

### Prerequisites
- Node.js 22.0+
- AWS CLI configured (for deployment)
- PostgreSQL database

### Setup
```bash
# Install dependencies (from project root)
yarn install

# Set up environment variables
cp apps/api/.env.example apps/api/.env
# Edit .env with your database connection string

# Build the application
yarn workspace @seedling-hq/api-app build

# Run locally with serverless offline
yarn workspace @seedling-hq/api-app dev
```

### Environment Variables
```bash
# Required
DATABASE_URL=postgresql://username:password@localhost:5432/seedling_hq

# Optional
LOG_LEVEL=INFO
DB_MAX_CONNECTIONS=10
DB_IDLE_TIMEOUT=20
```

### Local Development
```bash
# Start local API server (http://localhost:3001)
yarn workspace @seedling-hq/api-app dev

# Test endpoints
curl -X POST http://localhost:3001/customers \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'
```

## Deployment

### Development Environment
```bash
yarn workspace @seedling-hq/api-app deploy:dev
```

### Production Environment
```bash
yarn workspace @seedling-hq/api-app deploy:prod
```

### Logs
```bash
# View function logs
yarn workspace @seedling-hq/api-app logs createCustomer
```

## Technology Stack

- **Runtime**: Node.js 22.x on AWS Lambda
- **Framework**: Serverless Framework
- **Database**: PostgreSQL with Drizzle ORM
- **ID Generation**: NanoID with prefixes
- **Logging**: AWS Lambda Powertools
- **Build**: TypeScript + ESBuild

## Clean Architecture Benefits

1. **Technology Independence**: Swap database or ID generation without changing business logic
2. **Testability**: Mock interfaces for unit testing
3. **Maintainability**: Clear separation of concerns
4. **Flexibility**: Easy to add new use cases or change infrastructure

## Package Dependencies

- `@seedling-hq/core`: Domain entities and business rules
- `@seedling-hq/use-cases`: Application business logic
- `@seedling-hq/ports`: Interface definitions
- `@seedling-hq/database-drizzle`: PostgreSQL repository implementation
