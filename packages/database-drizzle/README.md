# @seedling-hq/database-drizzle

Database adapter implementation using Drizzle ORM and PostgreSQL. This package provides the concrete implementation of repository interfaces defined in `@seedling-hq/ports`.

## Features

- **Clean Architecture**: Implements repository interfaces without exposing implementation details to business logic
- **Drizzle ORM**: Type-safe SQL queries with excellent TypeScript integration
- **PostgreSQL**: Production-ready database with ACID compliance
- **Connection Management**: Configurable connection pooling and environment-based setup
- **Migrations**: Automated database schema management with Drizzle Kit
- **Performance**: Optimized queries with proper indexing

## Installation

This package is internal to the Seedling HQ monorepo and installed automatically with workspace dependencies.

## Usage

### Basic Setup

```typescript
import { 
  DrizzleCustomerRepository,
  createDatabaseConnectionFromEnv 
} from '@seedling-hq/database-drizzle';

// Create database connection
const db = createDatabaseConnectionFromEnv();

// Create repository
const customerRepository = new DrizzleCustomerRepository(db);
```

### Environment Variables

```bash
DATABASE_URL=postgresql://username:password@host:port/database
DB_MAX_CONNECTIONS=10    # Optional
DB_IDLE_TIMEOUT=20       # Optional
```

### Migration Commands

```bash
# Generate migrations from schema changes
yarn workspace @seedling-hq/database-drizzle db:generate

# Run migrations
yarn workspace @seedling-hq/database-drizzle db:migrate

# Push schema directly (development only)
yarn workspace @seedling-hq/database-drizzle db:push

# Open Drizzle Studio
yarn workspace @seedling-hq/database-drizzle db:studio
```

## Schema

### Customer Table

```sql
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX customers_email_idx ON customers(email);
CREATE INDEX customers_is_active_idx ON customers(is_active);
CREATE INDEX customers_created_at_idx ON customers(created_at);
```

## Architecture

This package follows Clean Architecture principles:

- **No Business Logic**: Repository only handles data persistence
- **Interface Implementation**: Implements `CustomerRepository` from `@seedling-hq/ports`
- **Domain Entity Mapping**: Converts between database rows and `Customer` entities
- **Database Abstraction**: Business logic never directly interacts with database

## Technology Swapping

Thanks to Clean Architecture, you can swap this Drizzle implementation with any other database technology:

```typescript
// Current: Drizzle
const customerRepository = new DrizzleCustomerRepository(db);

// Hypothetical: Prisma
const customerRepository = new PrismaCustomerRepository(prisma);

// Hypothetical: TypeORM  
const customerRepository = new TypeORMCustomerRepository(connection);
```

The business logic (`@seedling-hq/use-cases`) remains unchanged when swapping database implementations.

## Package Dependencies

- `@seedling-hq/core`: Customer domain entity
- `@seedling-hq/ports`: Repository interfaces
- `drizzle-orm`: ORM and query builder
- `postgres`: PostgreSQL client
- `drizzle-kit`: Migration and introspection tools
