# Seedling HQ Quick Reference

A quick reference guide for common development tasks and commands in the Seedling HQ monorepo.

## 🚀 Quick Start Commands

```bash
# Initial setup
corepack enable
yarn install
yarn build
yarn dev

# Development servers
yarn workspace @seedling-hq/web dev     # Frontend (port 5173)
yarn workspace @seedling-hq/api dev     # Backend (port 3001)
```

## 🔄 Common Development Tasks

### Adding a New Feature

1. **Create Types First**
```bash
# 1. Add types to packages/types/src/
touch packages/types/src/newFeature.ts

# 2. Export from index.ts
# 3. Build types
yarn workspace @seedling-hq/types build
```

2. **Backend Implementation**
```bash
# 1. Create route file
touch packages/api/src/routes/newFeature.ts

# 2. Create service file  
touch packages/api/src/services/newFeatureService.ts

# 3. Register route in app.ts
# 4. Test and build
yarn workspace @seedling-hq/api build
yarn workspace @seedling-hq/api dev
```

3. **Frontend Implementation**
```bash
# 1. Create service
touch apps/web/src/services/newFeatureService.ts

# 2. Create hook
touch apps/web/src/hooks/useNewFeature.ts

# 3. Create components
mkdir apps/web/src/components/newFeature
touch apps/web/src/components/newFeature/NewFeatureForm.tsx

# 4. Create page
touch apps/web/src/pages/NewFeaturePage.tsx

# 5. Test
yarn workspace @seedling-hq/web dev
```

### Code Quality Checks

```bash
# Run all checks
yarn lint          # All packages
yarn type-check    # All packages  
yarn build         # All packages

# Individual packages
yarn workspace @seedling-hq/web lint
yarn workspace @seedling-hq/api type-check
yarn workspace @seedling-hq/types build
```

### Testing

```bash
# Run tests (when implemented)
yarn test

# Individual package tests
yarn workspace @seedling-hq/web test
yarn workspace @seedling-hq/api test
```

## 🌐 API Development

### Quick Route Template

```typescript
// packages/api/src/routes/template.ts
import { FastifyInstance } from 'fastify';
import { YourType } from '@seedling-hq/types';

export async function templateRoutes(fastify: FastifyInstance) {
  fastify.get('/template', {
    schema: {
      response: {
        200: { type: 'object', properties: { message: { type: 'string' } } }
      }
    }
  }, async () => {
    return { message: 'Hello from template route' };
  });
}
```

### Quick Service Template

```typescript
// packages/api/src/services/templateService.ts
import { YourType } from '@seedling-hq/types';

class TemplateService {
  async getData(): Promise<YourType[]> {
    // Implementation
    return [];
  }
}

export const templateService = new TemplateService();
```

## ⚛️ React Development

### Quick Component Template

```typescript
// apps/web/src/components/Template.tsx
interface TemplateProps {
  title: string;
  children?: React.ReactNode;
}

export function Template({ title, children }: TemplateProps) {
  return (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  );
}
```

### Quick Hook Template

```typescript
// apps/web/src/hooks/useTemplate.ts
import { useState, useEffect } from 'react';
import { YourType } from '@seedling-hq/types';
import { templateService } from '../services/templateService';

export function useTemplate() {
  const [data, setData] = useState<YourType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const result = await templateService.getData();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { data, loading, error };
}
```

### Quick Service Template

```typescript
// apps/web/src/services/templateService.ts
import { YourType } from '@seedling-hq/types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api/v1';

class TemplateService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      ...options
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async getData(): Promise<YourType[]> {
    return this.request<YourType[]>('/template');
  }
}

export const templateService = new TemplateService();
```

## 📦 Package Management

### Adding Dependencies

```bash
# Frontend dependencies
yarn workspace @seedling-hq/web add react-router-dom
yarn workspace @seedling-hq/web add -D @types/react-router-dom

# Backend dependencies  
yarn workspace @seedling-hq/api add jsonwebtoken
yarn workspace @seedling-hq/api add -D @types/jsonwebtoken

# Shared dependencies (types)
yarn workspace @seedling-hq/types add -D some-utility-type
```

### Updating Dependencies

```bash
# Update all workspaces
yarn upgrade

# Update specific workspace
yarn workspace @seedling-hq/web upgrade
yarn workspace @seedling-hq/api upgrade
```

## 🚢 Deployment

### Backend (AWS Lambda)

```bash
# Deploy to development
cd packages/api
yarn deploy:dev

# Deploy to production
yarn deploy:prod

# View logs
yarn logs

# Remove deployment
yarn remove
```

### Frontend (Manual Build)

```bash
# Build for production
cd apps/web
yarn build

# Preview production build
yarn preview
```

## 🔍 Debugging

### Backend Debugging

```bash
# Start with detailed logging
cd packages/api
NODE_ENV=development yarn dev

# Test API endpoints
curl http://localhost:3001/health
curl http://localhost:3001/api/v1/users

# View serverless offline
yarn offline
```

### Frontend Debugging

```bash
# Start dev server with debugging
cd apps/web
yarn dev

# Check environment variables
echo $VITE_API_BASE

# Build with debug info
yarn build --mode development
```

## 🧹 Maintenance

### Clean Build Artifacts

```bash
# Clean all packages
yarn clean

# Clean individual packages
yarn workspace @seedling-hq/web clean
yarn workspace @seedling-hq/api clean
```

### Reset Dependencies

```bash
# Remove all node_modules and reinstall
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
yarn install
```

### Update Turbo Cache

```bash
# Clear Turborepo cache
rm -rf .turbo

# Force rebuild all packages
yarn build --force
```

## 🔧 Environment Variables

### Frontend (.env.local)

```bash
VITE_API_BASE=http://localhost:3001/api/v1
VITE_ENV=development
VITE_ENABLE_LOGGING=true
```

### Backend (.env)

```bash
NODE_ENV=development
STAGE=dev
API_VERSION=1.0.0
PORT=3001
CORS_ORIGINS=http://localhost:5173
```

## 🐛 Troubleshooting

### Common Issues

**"Module not found" errors**
```bash
# Rebuild types package
yarn workspace @seedling-hq/types build

# Clear and reinstall
yarn clean && yarn install
```

**TypeScript errors**
```bash
# Check all packages
yarn type-check

# Individual package check
yarn workspace @seedling-hq/web type-check
```

**Build failures**
```bash
# Clean and rebuild
yarn clean
yarn build

# Check for dependency issues
yarn install --check-files
```

**Server won't start**
```bash
# Check port availability
lsof -ti:3001 | xargs kill -9  # Kill process on port 3001
lsof -ti:5173 | xargs kill -9  # Kill process on port 5173

# Restart with clean slate
yarn clean && yarn build && yarn dev
```

## 📚 Useful Commands

```bash
# Project info
yarn workspaces info
yarn why <package-name>

# Performance analysis
yarn build --analyze
yarn turbo run build --dry

# Security audit
yarn audit
yarn audit --fix

# Dependency tree
yarn list --depth=0
yarn workspace @seedling-hq/web list
```

This quick reference provides immediate access to the most common commands and patterns you'll use while developing with the Seedling HQ tech stack.
