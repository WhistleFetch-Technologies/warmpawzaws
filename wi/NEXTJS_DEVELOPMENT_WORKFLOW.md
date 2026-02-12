# Warmpawz NextJS - Development Workflow & Best Practices

**Version:** 1.0.0  
**Status:** PHASE 0 Complete

---

## 🚀 Development Environment Setup

### Prerequisites

```bash
Node.js: >= 18.0.0
pnpm: >= 8.0.0
Git: >= 2.40.0
AWS CLI: >= 2.0 (for Phase 5+)
```

### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/ketan0103/warmpawzaws.git
cd warmpawzaws

# 2. Install pnpm globally
npm install -g pnpm@latest

# 3. Install dependencies
pnpm install

# 4. Setup environment variables
cp .env.example .env.local
pnpm run setup:env

# 5. Run migrations (Phase 2+)
pnpm run db:migrate

# 6. Start development servers
pnpm run dev
```

---

## 📦 Package Manager: pnpm

### Why pnpm?

- **Monorepo support** via workspaces
- **Faster installs** than npm/yarn
- **Disk efficient** with hard links
- **Strict dependency isolation**

### Common Commands

```bash
# Install all dependencies
pnpm install

# Add dependency to specific app
pnpm --filter customer-web add react@latest

# Add to shared package
pnpm --filter @warmpawz/api-contracts add zod

# Remove dependency
pnpm --filter vendor-web remove axios

# Update all
pnpm update -r

# List all packages
pnpm list -r

# Clean all node_modules
pnpm -r clean
```

---

## 🏃 Running Development Servers

### Start All Apps

```bash
# Terminal 1: Start all dev servers (3001, 3002, 3003)
pnpm run dev

# Or run individually
pnpm run dev:customer    # Port 3001
pnpm run dev:vendor      # Port 3002
pnpm run dev:admin       # Port 3003
```


```bash

# Or with Docker
```

### Access Applications

```
Customer App: http://localhost:3001
Vendor App:   http://localhost:3002
Admin App:    http://localhost:3003
API Routes:   http://localhost:3001/api/v1/* (proxied from apps)
```

---

## 🔨 Build & Compilation

### Build Single App

```bash
pnpm --filter customer-web build
# Output: apps/customer-web/.next/

pnpm --filter vendor-web build
pnpm --filter admin-web build
```

### Build All Apps

```bash
pnpm run build
```

### Build Shared Packages

```bash
# Packages are built automatically when needed
pnpm --filter @warmpawz/api-contracts build
pnpm --filter @warmpawz/domain build
```

### Analyze Bundle Size

```bash
# Customer web
pnpm --filter customer-web run build:analyze

# Output: bundle analysis HTML in .next/
```

---

## 🧪 Testing

### Unit Tests (Jest)

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @warmpawz/domain test

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm test --coverage
```

### Component Tests (React Testing Library)

```bash
# Test components
pnpm --filter customer-web test

# Specific test file
pnpm --filter customer-web test BookingCard.test.tsx

# Watch mode
pnpm --filter customer-web test --watch
```

### E2E Tests (Playwright/Cypress)

```bash
# Run E2E tests
pnpm run e2e

# Specific test
pnpm run e2e -- customer-web/bookings.e2e.ts

# Interactive mode
pnpm run e2e:debug
```

### Test Coverage

```bash
# Generate coverage report
pnpm test --coverage --all

# Coverage thresholds
# Lines: 80%
# Branches: 75%
# Functions: 80%
# Statements: 80%
```

---

## 📝 Code Style & Linting

### ESLint

```bash
# Lint all code
pnpm lint

# Lint specific app
pnpm --filter customer-web lint

# Fix linting errors
pnpm lint --fix

# Specific file
pnpm lint -- src/components/booking/BookingCard.tsx --fix
```

### Prettier

```bash
# Format all code
pnpm format

# Format specific directory
pnpm format -- src/components --write

# Check formatting without fixing
pnpm format --check
```

### Type Checking

```bash
# Check types across all packages
pnpm type-check

# Specific package
pnpm --filter customer-web type-check

# Watch mode
pnpm type-check --watch
```

### Pre-commit Hooks (Husky)

```bash
# Hooks run automatically before commit
# - ESLint on changed files
# - Prettier format
# - Type check

# Bypass hooks (not recommended)
git commit --no-verify
```

---

## 🔄 Git Workflow

### Branch Naming

```bash
# Feature
git checkout -b feature/booking-cancellation

# Bug fix
git checkout -b bugfix/payment-validation

# Hotfix
git checkout -b hotfix/auth-token-expiry

# Chore
git checkout -b chore/update-dependencies
```

### Commit Messages

Follow conventional commits:

```
type(scope): subject

body

footer

# Type: feat, fix, docs, style, refactor, test, chore
# Scope: booking, vendor, auth, etc.

# Example
git commit -m "feat(booking): add cancellation with refund policy

- Implement cancellation logic in domain layer
- Add API endpoint for cancellation
- Update booking state machine

Closes #123"
```

### Pull Request Process

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes and commit
git add .
git commit -m "feat(scope): description"

# 3. Keep updated with main
git fetch origin
git rebase origin/main

# 4. Push and create PR
git push origin feature/my-feature

# 5. PR template fills automatically
# - Description of changes
# - Related issues (#123)
# - Testing done
# - Screenshots/videos (if UI)
# - Checklist items

# 6. Wait for reviews and CI checks
# - All tests pass
# - No type errors
# - ESLint passes
# - Code coverage maintained

# 7. Merge with squash (clean history)
# GitHub: "Squash and merge"
```

---

## 🔐 Environment Variables

### .env.local Structure

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_API_TIMEOUT=10000

# Cognito (Customer Pool)
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_CLIENT_ID=customer_client_id
NEXT_PUBLIC_COGNITO_POOL_ID=us-east-1_xxxxxxxxx
NEXT_PUBLIC_COGNITO_DOMAIN=customer-auth.warmpawz.com

# Sentry (Error tracking)
NEXT_PUBLIC_SENTRY_DSN=https://...
SENTRY_AUTH_TOKEN=your_token

# Feature Flags
NEXT_PUBLIC_FEATURE_PREMIUM=false
NEXT_PUBLIC_FEATURE_TELEMEDICINE=true

# Third-party APIs
NEXT_PUBLIC_RAZORPAY_KEY_ID=key_...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...

# Development only
DEBUG=warmpawz:*
```

### App-Specific Variables

```bash
# apps/customer-web/.env.local
NEXT_PUBLIC_PERSONA=customer
NEXT_PUBLIC_COGNITO_CLIENT_ID=customer_client_id

# apps/vendor-web/.env.local
NEXT_PUBLIC_PERSONA=vendor
NEXT_PUBLIC_COGNITO_CLIENT_ID=vendor_client_id

# apps/admin-web/.env.local
NEXT_PUBLIC_PERSONA=admin
NEXT_PUBLIC_COGNITO_CLIENT_ID=admin_client_id
```

### Validation

```typescript
// lib/env.ts
import { z } from "zod";

const envSchema = z.object({
	NEXT_PUBLIC_API_URL: z.string().url(),
	NEXT_PUBLIC_COGNITO_REGION: z.string(),
	NEXT_PUBLIC_COGNITO_CLIENT_ID: z.string(),
	NODE_ENV: z.enum(["development", "production", "test"]),
});

export const env = envSchema.parse(process.env);
```

---

## 🐛 Debugging

### Browser DevTools

```bash
# Chrome: F12
# Firefox: F12
# Edge: F12

# React DevTools Browser Extension
# Redux DevTools (if using)
# Zustand DevTools

# Debug specific component
# In component:
console.log('render', props);

# In browser console:
# $r returns selected component
# $r.props shows props
```

### VS Code Debugging

```json
// .vscode/launch.json
{
	"version": "0.2.0",
	"configurations": [
		{
			"name": "Next.js",
			"type": "node",
			"request": "launch",
			"program": "${workspaceFolder}/node_modules/.bin/next",
			"args": ["dev"],
			"console": "integratedTerminal"
		}
	]
}
```

### Server-Side Debugging

```typescript
// In API route
console.log("Request body:", JSON.stringify(body, null, 2));
console.log("User ID:", userId);
console.trace("Call stack");

// Output appears in terminal where dev server runs
```

### React Query DevTools

```typescript
// Add to root layout
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export default function RootLayout({ children }) {
	return (
		<html>
			<body>
				{children}
				{process.env.NODE_ENV === "development" && (
					<ReactQueryDevtools initialIsOpen={false} />
				)}
			</body>
		</html>
	);
}
```

---

## 🚀 Deployment

### Build for Production

```bash
# Build all apps
pnpm run build

# Build single app
pnpm --filter customer-web build

# Verify build
pnpm --filter customer-web start
```

### Deployment Options

#### Option 1: Vercel (Recommended for Next.js)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy specific app
cd apps/customer-web
vercel

# With environment variables
vercel env add NEXT_PUBLIC_COGNITO_CLIENT_ID
```

#### Option 2: AWS Amplify

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Initialize Amplify project
amplify init

# Deploy
amplify publish
```

#### Option 3: Docker

```dockerfile
# Dockerfile
FROM node:18-alpine AS installer
WORKDIR /app
COPY pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm fetch

FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=installer /app/node_modules ./node_modules
RUN pnpm install -r --offline
RUN pnpm --filter customer-web build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
RUN npm install -g pnpm
EXPOSE 3000
CMD ["pnpm", "start"]
```

---

## 📊 Monitoring & Logging

### Error Tracking (Sentry)

```typescript
// Sentry setup
import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	environment: process.env.NODE_ENV,
	beforeSend(event) {
		// Filter sensitive data
		if (event.request?.cookies) {
			delete event.request.cookies;
		}
		return event;
	},
});
```

### Application Logging

```typescript
// lib/logger.ts
export const logger = {
	info: (message: string, data?: any) => {
		console.log(`[INFO] ${message}`, data);
		// Send to logging service
	},
	error: (message: string, error?: Error) => {
		console.error(`[ERROR] ${message}`, error);
		// Send to Sentry
		Sentry.captureException(error);
	},
	warn: (message: string, data?: any) => {
		console.warn(`[WARN] ${message}`, data);
	},
};
```

### Performance Monitoring

```typescript
// hooks/usePageMetrics.ts
export function usePageMetrics() {
	useEffect(() => {
		const perfData = performance.getEntriesByType("navigation")[0];
		if (perfData) {
			const pageLoadTime = perfData.loadEventEnd - perfData.loadEventStart;
			// Send to analytics
			console.log("Page load time:", pageLoadTime);
		}
	}, []);
}
```

---

## 🔍 Code Review Checklist

Before creating a pull request:

### Architecture

- [ ] No database logic in API routes
- [ ] Business logic in domain layer only
- [ ] Repository pattern used for data access
- [ ] No framework-specific code in domain

### Code Quality

- [ ] All files linted (no warnings)
- [ ] No TypeScript errors
- [ ] Functions have JSDoc comments
- [ ] No console.log in production code
- [ ] Magic numbers extracted to constants

### Naming

- [ ] Variables use camelCase
- [ ] Components use PascalCase
- [ ] Constants use SCREAMING_SNAKE_CASE
- [ ] Functions are verbs (getUser, createBooking)
- [ ] Variables are nouns (user, booking)

### Testing

- [ ] Unit tests added for business logic
- [ ] Component tests added
- [ ] Happy path and error cases tested
- [ ] > 80% code coverage
- [ ] All tests passing

### Performance

- [ ] No unnecessary re-renders
- [ ] Images optimized
- [ ] Bundle size analyzed
- [ ] API calls batched where possible
- [ ] Caching strategy implemented

### Security

- [ ] No hardcoded secrets
- [ ] Input validation on all APIs
- [ ] XSS protection verified
- [ ] CORS configured properly
- [ ] Auth tokens secured (HTTP-only)

### Documentation

- [ ] README updated if needed
- [ ] Complex logic explained in comments
- [ ] API contracts documented
- [ ] Environment variables documented
- [ ] Changes reflected in CHANGELOG

---

## 📋 Useful Commands Cheatsheet

```bash
# Development
pnpm run dev                    # Start all dev servers
pnpm run dev:customer           # Customer app only
pnpm run build                  # Build all apps
pnpm run type-check             # Check types
pnpm lint                       # Lint all code
pnpm format                     # Format with Prettier

# Testing
pnpm test                       # Run all tests
pnpm test --watch              # Watch mode
pnpm test --coverage           # Coverage report
pnpm run e2e                   # Run E2E tests

# Database (Phase 2+)
pnpm run db:migrate            # Run migrations
pnpm run db:seed               # Seed test data
pnpm run db:reset              # Reset database

# Dependencies
pnpm outdated                  # Check outdated packages
pnpm update -r                 # Update all packages
pnpm --filter customer-web add @tanstack/react-query  # Add dep

# Cleanup
pnpm -r clean                  # Remove node_modules
pnpm prune                     # Remove unused deps
rm -rf .next                   # Clear Next.js cache

# Git
git status                     # Show status
git log --oneline              # View commits
git show HEAD                  # Show last commit
git revert HEAD                # Undo last commit
git reset --hard origin/main   # Reset to remote

# Troubleshooting
pnpm install --frozen-lockfile # Install exact versions
pnpm store prune               # Clean pnpm cache
rm -rf node_modules pnpm-lock.yaml && pnpm install  # Clean install
```

---

## 🆘 Troubleshooting Common Issues

### Issue: Port Already in Use

```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>

# Or use different port
PORT=3004 pnpm --filter customer-web dev
```

### Issue: Module Not Found

```bash
# Clear cache and reinstall
pnpm -r clean
pnpm install

# Check path aliases in tsconfig
cat tsconfig.base.json | grep -A 20 '"paths"'
```

### Issue: Type Errors After Package Update

```bash
# Regenerate types
pnpm type-check

# Update type definitions
pnpm install --save-dev @types/node@latest

# Check for version conflicts
pnpm why react
```


```bash
curl http://localhost:54321


# Check environment variables
```

### Issue: Tests Failing

```bash
# Run with verbose output
pnpm test --verbose

# Run single test file
pnpm test BookingCard.test.tsx

# Clear Jest cache
pnpm test --clearCache

# Update snapshots (carefully!)
pnpm test --updateSnapshot
```

---

## 📚 Additional Resources

### Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Zod Documentation](https://zod.dev)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Tools

- [VS Code](https://code.visualstudio.com/)
- [DevTools](https://developer.chrome.com/docs/devtools/)
- [Postman](https://www.postman.com/) - API testing
- [Figma](https://www.figma.com/) - Design collaboration

### Learning

- [egghead.io](https://egghead.io) - Video tutorials
- [CSS Tricks](https://css-tricks.com/) - Web dev articles
- [DEV Community](https://dev.to) - Articles and discussions

---

## 🎓 Phase-by-Phase Development

### PHASE 0: Contract Freeze (Current)

```bash
# Main tasks: Define contracts, create domain types
pnpm --filter @warmpawz/api-contracts dev
pnpm --filter @warmpawz/domain test

# Output: Frozen API contracts, domain entities
```

### PHASE 1: Domain Extraction

```bash
# Main tasks: Extract business logic
pnpm test:domain --watch

# Verify: No framework imports in domain
```


```bash
# Start development
pnpm run dev

# Test end-to-end
pnpm test e2e --grep "customer.*booking"
```

### PHASE 5: AWS Migration

```bash
# Deploy infrastructure
cd infrastructure
terraform apply

# Deploy Lambda functions
npm run deploy:lambda

# Point frontend to new backend
# Update NEXT_PUBLIC_API_URL in .env
```

---

**END OF DEVELOPMENT WORKFLOW DOCUMENT**
