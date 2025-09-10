# Seedling HQ Monorepo

A modern monorepo built with Turborepo, featuring intelligent caching, React 19 frontend, and Fastify serverless API backend.

## 📚 Documentation

**New to the project? Start here:**

### 📖 [Development Guide](./DEVELOPMENT_GUIDE.md)
Comprehensive guide covering the complete tech stack from frontend to backend:
- 🎯 Frontend Development (React + Vite + TypeScript)
- ⚡ Backend Development (Fastify + AWS Lambda)
- 🔗 Shared Types Architecture
- 🚀 Full-Stack Feature Development Workflow
- 🧪 Testing Strategies
- 📋 Best Practices & Conventions
- 🏗️ System Architecture Diagrams

### ⚡ [Quick Reference](./QUICK_REFERENCE.md)
Fast access to common development tasks and commands:
- 🚀 Quick start commands
- 🔄 Adding new features workflow
- 📝 Code templates (routes, services, components, hooks)
- 🐛 Debugging and troubleshooting
- 📦 Package management
- 🚢 Deployment shortcuts

---

## Project Structure

This monorepo follows a clear separation between **applications** and **packages**:

- **`apps/`** - End-user applications that are deployed (API server, Web app)
- **`packages/`** - Reusable library packages consumed by apps or other packages

```
seedling-hq/
├── apps/                    # Application packages (end-user applications)
│   ├── api/                 # Fastify serverless API (@seedling-hq/api)
│   └── web/                 # React + Vite web application (@seedling-hq/web)
├── packages/                # Library packages (shared code)
│   ├── api-client/          # API client library (@seedling-hq/api-client)
│   └── types/               # Shared TypeScript types (@seedling-hq/types)
├── .vscode/                 # VS Code workspace configuration
│   ├── settings.json        # Yarn PnP and TypeScript integration
│   └── extensions.json      # Recommended extensions
├── .yarn/
│   └── sdks/                # Yarn SDKs for IDE integration
├── package.json             # Root workspace configuration
├── turbo.json               # Turborepo configuration
└── .pnp.cjs                 # Yarn PnP manifest
```

## Getting Started

### Prerequisites

- **Node.js 22.12+** (required for Vite 7.x compatibility)
- **Corepack** (included with Node.js 16.9+ and 14.19+, just needs to be enabled)
- **No global Yarn installation required** - Corepack manages the correct version automatically

> **Note**: Corepack comes built-in with modern Node.js versions but may be disabled by default. If `corepack --version` fails, you may need to enable it first.

### Installation

```bash
# Enable Corepack (one-time setup)
corepack enable

# Clone the repository
git clone <repository-url>
cd seedling-hq

# Install dependencies (Corepack will automatically use Yarn 4.9.4)
yarn install

# Build all packages
yarn build

# Start development mode
yarn dev
```

### Alternative: Using Corepack Commands Directly

If you prefer to be explicit or don't have Yarn globally:

```bash
# Use Corepack to run Yarn commands directly
corepack yarn install
corepack yarn build
corepack yarn dev
```

## Available Scripts

### Root Commands
- `yarn build` - Build all packages and apps with Turborepo caching
- `yarn dev` - Start development servers for all apps
- `yarn lint` - Lint all packages with ESLint
- `yarn type-check` - Type check all packages with TypeScript
- `yarn clean` - Clean all build artifacts

### Individual Package Commands
```bash
# Build specific workspace
yarn workspace @seedling-hq/web build
yarn workspace @seedling-hq/api build
yarn workspace @seedling-hq/api-client build
yarn workspace @seedling-hq/types build
```

## Apps

### API (@seedling-hq/api)
Fastify serverless API featuring:
- **Fastify Framework** - High-performance Node.js web framework
- **AWS Lambda** - Serverless compute with auto-scaling
- **TypeScript** - Full type safety with strict configuration
- **Security** - CORS, Helmet, Rate limiting, Input validation
- **Development** - Local dev server with hot reload
- **Deployment** - Serverless Framework for Infrastructure as Code

### Web (@seedling-hq/web)
React application built with:
- **Vite 7.x** for fast development and building
- **React 19** with TypeScript
- **ESLint 9.x** with flat config
- Hot Module Replacement (HMR)
- Production bundle: ~188KB (gzipped: ~59KB)

## Packages

### API Client (@seedling-hq/api-client)
TypeScript API client library (stub package for future development):
- **TypeScript** - Full type safety
- **ES Modules** - Modern module system
- **Dependencies** - Uses shared types from @seedling-hq/types
- **Monorepo Integration** - Builds with Turborepo

### Types (@seedling-hq/types)
Shared TypeScript type definitions including:
- User types and interfaces
- Strict TypeScript configuration
- ESLint integration
- Exported types for cross-package usage

## Development

### Technologies

**Frontend Stack:**
- **React 19** - Latest React with concurrent features  
- **Vite 7.x** - Ultra-fast build tool and development server
- **TypeScript 5.x** - Type safety and enhanced developer experience

**Backend Stack:**
- **Fastify** - High-performance Node.js web framework
- **AWS Lambda** - Serverless compute platform
- **Serverless Framework** - Infrastructure as Code

**Development Infrastructure:**
- **Turborepo 2.5.6** - Build orchestration with intelligent caching
- **Yarn 4.9.4** - Modern package manager with Plug'n'Play (PnP)
- **ESLint 9.x** - Code linting with flat configuration

### Performance Features
- **Turborepo Caching** - Subsequent builds complete in ~70ms
- **Yarn PnP** - Fast dependency resolution without node_modules
- **Smart Dependencies** - Packages build in correct dependency order
- **Cache Hits** - "FULL TURBO" performance on unchanged code

### Workspace Dependencies
Packages can reference each other using workspace protocol:
```json
{
  "dependencies": {
    "@seedling-hq/types": "workspace:*",
    "@seedling-hq/api-client": "workspace:*"
  }
}
```

**Dependency Flow:**
- `apps/api` → `packages/types`
- `apps/web` → `packages/types`, `packages/api-client`
- `packages/api-client` → `packages/types`

## Troubleshooting

### No Yarn Installed / Version Mismatch
If you get "yarn: command not found" or version conflicts:

**Option 1: Use Corepack (Recommended)**
```bash
# Enable Corepack and let it manage Yarn
corepack enable
corepack yarn --version  # Should show 4.9.4
corepack yarn install
```

**Option 2: Prepare Yarn with Corepack**
```bash
corepack enable
corepack prepare yarn@4.9.4 --activate
yarn --version  # Should now show 4.9.4
```

### Corepack Not Found
If `corepack --version` returns "command not found":

**For Node.js 16.9+ / 14.19+:**
```bash
# Corepack should be included, try enabling it
npm install -g corepack
corepack enable
```

**For older Node.js versions:**
```bash
# Install Corepack manually
npm install -g corepack
corepack enable
```

**Alternative: Install Yarn directly**
```bash
npm install -g yarn@4.9.4
# Then use yarn commands normally
```

### Cache Issues
To clear Turborepo cache:
```bash
yarn clean
# or
rm -rf .turbo
```

### VS Code Setup
This project is configured for VS Code with Yarn PnP support:

1. **Install Recommended Extensions**: When opening the project, VS Code will prompt to install recommended extensions including:
   - ZipFS (arcanis.vscode-zipfs) - Required for Yarn PnP
   - TypeScript Importer - Better TypeScript support

2. **Select Workspace TypeScript Version**:
   - Open any `.ts` file
   - Press `Cmd+Shift+P` → "TypeScript: Select TypeScript Version"
   - Choose "Use Workspace Version"

3. **Reload VS Code**: `Cmd+Shift+P` → "Developer: Reload Window"

See `.vscode/README.md` for detailed setup instructions and troubleshooting.

### PnP Issues
If experiencing module resolution issues, ensure your IDE supports Yarn PnP or install the appropriate extensions.
