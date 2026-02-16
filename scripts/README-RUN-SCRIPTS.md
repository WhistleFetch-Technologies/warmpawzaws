# Run Scripts Documentation

## Overview

These scripts allow you to run the Warmpawz web applications (admin-web, customer-web, vendor-web) in either **development** or **production** mode with the correct environment configuration.

## Quick Start

### Run All Apps

```bash
# Development mode (all apps)
npm run dev

# Production mode (all apps)
npm run prod
```

### Run Individual Apps

```bash
# Development mode
npm run dev:admin      # Admin web on port 3003
npm run dev:vendor     # Vendor web on port 3002
npm run dev:customer   # Customer web on port 3001

# Production mode
npm run prod:admin     # Admin web on port 3003
npm run prod:vendor    # Vendor web on port 3002
npm run prod:customer  # Customer web on port 3001
```

### Run Specific Apps

```bash
# Run only admin and customer in dev mode
node scripts/run-all.js dev admin-web customer-web

# Run only vendor in prod mode
node scripts/run-all.js prod vendor-web
```

## Environment Configuration

### Development Mode
- **API Gateway**: `z0b3obweb6` (dev)
- **URL**: `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`
- **Environment**: `development`
- **UAT Mode**: `enabled` (auto-login for testing)
- **NODE_ENV**: `development`

### Production Mode
- **API Gateway**: `mss9sa4y01` (prod)
- **URL**: `https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com`
- **Environment**: `production`
- **UAT Mode**: `disabled` (requires proper authentication)
- **NODE_ENV**: `production`

## Ports

| App | Port |
|-----|------|
| admin-web | 3003 |
| vendor-web | 3002 |
| customer-web | 3001 |

## Access URLs

When running in development mode:
- Admin: http://localhost:3003
- Vendor: http://localhost:3002
- Customer: http://localhost:3001

## Environment Variables Set

The scripts automatically set these environment variables:

### Development
```bash
NEXT_PUBLIC_API_BASE_URL=https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_UAT_MODE=true
NODE_ENV=development
```

### Production
```bash
NEXT_PUBLIC_API_BASE_URL=https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_UAT_MODE=false
NODE_ENV=production
```

## Scripts

### `run-all.js`
Runs multiple apps simultaneously. All apps share the same environment configuration.

**Usage:**
```bash
node scripts/run-all.js [dev|prod] [app1] [app2] [app3]
```

**Examples:**
```bash
# Run all apps in dev mode
node scripts/run-all.js dev

# Run all apps in prod mode
node scripts/run-all.js prod

# Run only admin and customer in dev mode
node scripts/run-all.js dev admin-web customer-web
```

### `run-dev.js`
Runs a single app in development mode.

**Usage:**
```bash
node scripts/run-dev.js [app-name] [api-url]
```

**Examples:**
```bash
node scripts/run-dev.js admin-web
node scripts/run-dev.js vendor-web
node scripts/run-dev.js customer-web
```

### `run-prod.js`
Runs a single app in production mode.

**Usage:**
```bash
node scripts/run-prod.js [app-name] [api-url]
```

**Examples:**
```bash
node scripts/run-prod.js admin-web
node scripts/run-prod.js vendor-web
node scripts/run-prod.js customer-web
```

## Stopping Apps

Press `Ctrl+C` to stop all running apps. The scripts handle graceful shutdown.

## Notes

- All apps run in parallel when using `run-all.js`
- Each app runs on its designated port
- Environment variables are set automatically
- The UI will reflect the correct environment (dev/prod)
- In production mode, UAT tokens are rejected for security
