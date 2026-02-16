# Production Deployment Scripts

This folder contains scripts specifically for **production** deployments and operations.

## Purpose

These scripts are separated from the main `scripts/` folder to:
- Keep production-specific operations isolated
- Prevent accidental production deployments from dev branch
- Maintain clear separation between dev and prod tooling

## Scripts

- `redeploy-lambda-prod.ps1` - Redeploy Lambda functions to production
- `run-prod.js` - Run production-specific operations
- `test-razorpay-prod.sh` - Test Razorpay integration in production
- `deploy-prod-db-fix.ps1` - Apply database fixes to production
- `deploy-prod-lambda-fix.ps1` - Apply Lambda fixes to production
- `fix-prod-*.sh` - Production-specific fix scripts
- `diagnose-prod-api-gateway.sh` - Diagnose production API Gateway issues
- `verify-and-fix-prod-admin-web.sh` - Verify and fix production admin web
- `test-prod-api-health.sh` - Test production API health
- `create-prod-nat-gateway.sh` - Create production NAT gateway
- `terraform-apply-prod.sh` - Apply Terraform changes to production

## Usage

**⚠️ WARNING: These scripts modify production infrastructure. Use with extreme caution.**

Always verify:
1. You are on the correct branch (develop or prod)
2. You have proper AWS credentials configured
3. You understand what the script will do
4. You have backups/rollback plans

## Development Scripts

For development operations, use scripts in the main `scripts/` folder.
