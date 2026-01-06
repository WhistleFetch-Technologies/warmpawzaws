# 🚀 Setup Guide

## Overview

This guide helps you set up the Warmpawz web applications (Admin, Vendor, Customer) for local development.

---

## 📋 Prerequisites

- **Node.js:** v18.x or higher
- **npm:** v9.x or higher
- **Git:** Latest version

**Verify installation:**
```bash
node --version  # Should be v18.x or higher
npm --version   # Should be v9.x or higher
git --version
```

---

## 🔧 Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd warmpawzecodev
```

### 2. Install Dependencies

**Root level:**
```bash
npm install
```

**Individual apps:**
```bash
# Admin Web
cd apps/admin-web
npm install

# Vendor Web
cd apps/vendor-web
npm install

# Customer Web
cd apps/customer-web
npm install

# Shared UI Package
cd packages/ui
npm install
```

---

## ⚙️ Environment Configuration

### Admin Web

Create `apps/admin-web/.env.local`:

```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://dev.api.warmpawz.com

# UAT Mode (for development)
NEXT_PUBLIC_UAT_MODE=true

# Optional: Analytics
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

### Vendor Web

Create `apps/vendor-web/.env.local`:

```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://dev.api.warmpawz.com

# UAT Mode (for development)
NEXT_PUBLIC_UAT_MODE=true
```

### Customer Web

Create `apps/customer-web/.env.local`:

```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://dev.api.warmpawz.com

# UAT Mode (for development)
NEXT_PUBLIC_UAT_MODE=true
```

---

## 🏃 Running Development Servers

### Option 1: Run Individual Apps

**Admin Web:**
```bash
cd apps/admin-web
npm run dev
# Runs on http://localhost:3000
```

**Vendor Web:**
```bash
cd apps/vendor-web
npm run dev
# Runs on http://localhost:3001
```

**Customer Web:**
```bash
cd apps/customer-web
npm run dev
# Runs on http://localhost:3002
```

### Option 2: Run All Apps (if using workspace manager)

```bash
# From root
npm run dev:all
```

---

## 🏗️ Building for Production

### Build Individual Apps

```bash
# Admin Web
cd apps/admin-web
npm run build
npm start  # Start production server

# Vendor Web
cd apps/vendor-web
npm run build
npm start

# Customer Web
cd apps/customer-web
npm run build
npm start
```

### Build Output

Production builds generate:
- Static HTML pages
- Optimized JavaScript bundles
- CSS files
- Static assets

Output location: `.next/` directory in each app

---

## 🔐 Authentication Setup

### UAT Mode (Development)

When `NEXT_PUBLIC_UAT_MODE=true`:
- OTP verification is bypassed
- Use any phone number for testing
- Default OTP: `123456` (if backend supports)

### Production Mode

- Full OTP verification required
- Real phone numbers needed
- SMS/Email OTP sent from backend

---

## 🌐 API Configuration

### Development

**Default:** `https://dev.api.warmpawz.com`

**Override:** Set `NEXT_PUBLIC_API_BASE_URL` in `.env.local`

### Production

**Default:** `https://api.warmpawz.com`

**Override:** Set via runtime-config.js (deployment-time)

### Runtime Configuration

For production deployments, create `public/runtime-config.js`:

```javascript
window.__WARMPAWZ_RUNTIME_CONFIG__ = {
  apiBaseUrl: 'https://api.warmpawz.com',
  uatMode: false
};
```

---

## 🧪 Testing

### Type Checking

```bash
# Admin Web
cd apps/admin-web
npx tsc --noEmit

# Vendor Web
cd apps/vendor-web
npx tsc --noEmit

# Customer Web
cd apps/customer-web
npx tsc --noEmit
```

### Linting

```bash
# Admin Web
cd apps/admin-web
npm run lint

# Vendor Web
cd apps/vendor-web
npm run lint

# Customer Web
cd apps/customer-web
npm run lint
```

### Build Verification

```bash
# Test production builds
cd apps/admin-web && npm run build
cd apps/vendor-web && npm run build
cd apps/customer-web && npm run build
```

---

## 🐛 Troubleshooting

### Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Module Not Found

**Error:** `Cannot find module '@warmpawz/ui'`

**Solution:**
```bash
# Rebuild shared package
cd packages/ui
npm install
npm run build

# Then rebuild app
cd apps/admin-web
npm install
```

### API Connection Errors

**Error:** `Failed to fetch` or CORS errors

**Solution:**
1. Verify `NEXT_PUBLIC_API_BASE_URL` is correct
2. Check backend API is running
3. Verify CORS configuration on backend
4. Check network tab in browser DevTools

### Build Errors

**Error:** TypeScript compilation errors

**Solution:**
1. Run `npx tsc --noEmit` to see all errors
2. Fix type errors
3. Ensure all imports are correct
4. Check `tsconfig.json` configuration

---

## 📦 Dependencies

### Core Dependencies

- **Next.js:** 14.2.35
- **React:** 18.3.1
- **TypeScript:** 5.3.3
- **Tailwind CSS:** 3.4.0

### Shared Dependencies

- `@warmpawz/ui` - Shared UI components
- Common utilities and helpers

---

## 🔄 Development Workflow

### 1. Start Development

```bash
# Terminal 1: Admin Web
cd apps/admin-web && npm run dev

# Terminal 2: Vendor Web
cd apps/vendor-web && npm run dev

# Terminal 3: Customer Web
cd apps/customer-web && npm run dev
```

### 2. Make Changes

- Edit files in respective app directories
- Changes hot-reload automatically
- Check browser console for errors

### 3. Test Changes

- Navigate to relevant pages
- Test functionality
- Check network tab for API calls
- Verify error handling

### 4. Build & Deploy

```bash
# Build for production
npm run build

# Test production build locally
npm start

# Deploy to staging/production
# (Follow deployment guide)
```

---

## 📝 Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API URL | `https://dev.api.warmpawz.com` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_UAT_MODE` | Enable UAT mode | `false` |
| `NEXT_PUBLIC_ANALYTICS_ID` | Analytics tracking ID | - |

---

## 🚀 Quick Start

```bash
# 1. Clone and install
git clone <repo>
cd warmpawzecodev
npm install

# 2. Configure environment
cp apps/admin-web/.env.example apps/admin-web/.env.local
# Edit .env.local with your settings

# 3. Start development
cd apps/admin-web
npm run dev

# 4. Open browser
# http://localhost:3000
```

---

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [API Endpoints Documentation](./API_ENDPOINTS.md)
- [Components Documentation](./COMPONENTS.md)

---

**Last Updated:** January 6, 2026

