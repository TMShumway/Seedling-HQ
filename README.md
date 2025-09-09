# Seedling HQ Monorepo

A modern monorepo built with Turborepo, featuring intelligent caching and a React web application with shared packages.

## Project Structure

```
seedling-hq/
├── apps/
│   └── web/          # React + Vite web application (@seedling-hq/web)
├── packages/
│   ├── api/          # API client library (@seedling-hq/api)
│   └── types/        # Shared TypeScript types (@seedling-hq/types)
├── package.json      # Root workspace configuration
├── turbo.json        # Turborepo configuration
└── .pnp.cjs          # Yarn PnP manifest
```

## Getting Started

### Prerequisites

- **Node.js 22.0+** (LTS version for modern tooling compatibility)
- **Corepack** (included with Node.js, just needs to be enabled)
- **No global Yarn installation required** - Corepack manages the correct version automatically

> **Note**: This project targets Node.js 22 LTS for the best compatibility with modern tooling like Vite 7.x, Drizzle ORM, and other dependencies.

#### Installing Node.js 22 LTS

**Option 1: Using Node Version Manager (nvm) - Recommended**
```bash
# Install nvm if you haven't already
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node.js 22 LTS
nvm install --lts
nvm use --lts

# Set as default (optional)
nvm alias default node
```

**Option 2: Using Homebrew (macOS)**
```bash
brew install node
```

**Option 3: Download from Official Website**
Visit [nodejs.org](https://nodejs.org/) and download the LTS version.

#### Verify Your Installation
```bash
node --version  # Should show v22.x.x or higher
yarn check-node  # Our custom version checker
```

### Installation

```bash
# Check Node.js version first (should be 22.0+)
node --version

# Enable Corepack (one-time setup)
corepack enable

# Clone the repository
git clone <repository-url>
cd seedling-hq

# Install dependencies (will also check Node.js version)
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
- `yarn check-node` - Verify Node.js version meets requirements

### Individual Package Commands
```bash
# Build specific workspace
yarn workspace @seedling-hq/web build
yarn workspace @seedling-hq/api build
yarn workspace @seedling-hq/types build
```

## Apps

### Web (@seedling-hq/web)
React application built with:
- **Vite 7.x** for fast development and building
- **React 19** with TypeScript
- **ESLint 9.x** with flat config
- Hot Module Replacement (HMR)
- Production bundle: ~188KB (gzipped: ~59KB)

## Packages

### API (@seedling-hq/api)
Shared API client library featuring:
- TypeScript with strict configuration
- ESLint with modern flat config
- Build target: ES2022

### Types (@seedling-hq/types)
Shared TypeScript type definitions including:
- User types and interfaces
- Strict TypeScript configuration
- ESLint integration
- Exported types for cross-package usage

## Development

### Technologies
- **Turborepo 2.5.6** - Build orchestration with intelligent caching
- **Yarn 4.9.4** - Modern package manager with Plug'n'Play (PnP)
- **TypeScript 5.x** - Type safety across all packages
- **Vite 7.x** - Fast development and production builds
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
    "@seedling-hq/types": "workspace:*"
  }
}
```

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

### PnP Issues
If experiencing module resolution issues, ensure your IDE supports Yarn PnP or install the appropriate extensions.
