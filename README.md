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

## Official CloudFront URLs (permanent)

Use **only** these CloudFront URLs for the three web apps:

| App      | URL |
|----------|-----|
| **Admin**   | https://dfof7mguaa0a5.cloudfront.net |
| **Vendor**  | https://d1s6ykkj381k58.cloudfront.net |
| **Customer**| https://d2aoyjj8ine0wk.cloudfront.net |

See `docs/OFFICIAL_CLOUDFRONT_URLS.md` for CORS and deploy script references.

## Documentation

All documentation is in the `docs/` directory:
- `docs/archive/` - Historical status reports and audit logs
- **`docs/IMPLEMENTATION_FLOW.md`** - Deployment architecture, DB migrations, and deployment scripts (start here for deploy/migrate)

## Deployment & DB migrations

- **Architecture:** AWS Serverless (RDS, Cognito, S3, Lambda, CloudFront).
- **DB migrations:** Use **Node scripts in `scripts/`** (e.g. `run-migration-rds-node.js`). See `docs/IMPLEMENTATION_FLOW.md`.
- **Deployment:** Use **scripts in `scripts/`** (e.g. `deploy-all.sh`, `deploy-admin-web.sh`). See `docs/IMPLEMENTATION_FLOW.md`.
