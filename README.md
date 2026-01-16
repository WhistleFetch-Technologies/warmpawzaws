# Warmpawz Ecosystem

Pet services marketplace platform with admin, customer, and vendor applications.

## Project Structure

```
warmpawzecodev/
├── apps/                    # Frontend applications
│   ├── admin-web/          # Admin dashboard (Next.js)
│   ├── customer-web/       # Customer portal (Next.js)
│   ├── vendor-web/         # Vendor dashboard (Next.js)
│   ├── WarmpawzCustomer/   # Customer mobile app (React Native)
│   └── WarmpawzVendor/     # Vendor mobile app (React Native)
│
├── backend/                 # Backend services
│   └── lambda/             # AWS Lambda API handlers
│
├── infrastructure/          # AWS CDK infrastructure
├── scripts/                 # Build, deploy, and utility scripts
├── docs/                    # Documentation
├── database/                # Database migrations and seeds
└── .github/                 # CI/CD workflows
```

## Quick Start

```bash
# Install dependencies
npm install

# Start admin dashboard
cd apps/admin-web && npm run dev

# Start customer portal
cd apps/customer-web && npm run dev

# Start vendor dashboard
cd apps/vendor-web && npm run dev
```

## Documentation

All documentation is in the `docs/` directory:
- `docs/archive/` - Historical status reports and audit logs

## Deployment

See `scripts/` directory for deployment scripts.
