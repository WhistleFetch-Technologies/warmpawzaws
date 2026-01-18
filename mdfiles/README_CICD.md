# Warmpawz CI/CD Infrastructure

Complete AWS serverless infrastructure with automated CI/CD pipeline for pet services marketplace.

## 🎯 Project Overview

Production-ready AWS infrastructure deployment across three isolated environments (dev, stage, prod) with:
- **100% serverless** architecture
- **Automated testing** with 100% pass requirement
- **Manual approval gates** for stage/prod
- **Zero-drift** infrastructure management
- **Blue/green deployments** for production
- **Comprehensive monitoring** and alerting

## 🏗️ Architecture

### AWS Stack
- **Compute**: AWS Lambda (Node.js 20)
- **API**: API Gateway HTTP API
- **Database**: Aurora Serverless v2 (PostgreSQL)
- **NoSQL**: DynamoDB
- **Storage**: S3
- **Auth**: Cognito
- **Messaging**: SNS + SQS
- **Search**: OpenSearch
- **Monitoring**: CloudWatch + X-Ray

### External Integrations
- **Payments**: Razorpay (Marketplace Mode), Stripe
- **Logistics**: Shiprocket, Borzo
- **Maps**: Google Maps APIs
- **AI**: AWS Bedrock

## 📁 Repository Structure

```
├── .github/workflows/      # CI/CD pipelines
│   ├── dev.yml            # Auto-deploy to dev
│   ├── stage.yml          # Deploy to stage (approval required)
│   └── prod.yml           # Deploy to prod (strict approval)
├── infra/                 # Infrastructure as Code
│   ├── bootstrap/         # Terraform state backend
│   ├── modules/           # Reusable Terraform modules
│   │   ├── vpc/
│   │   ├── rds/
│   │   ├── lambda/
│   │   ├── api-gateway/
│   │   ├── cognito/
│   │   ├── s3/
│   │   ├── dynamodb/
│   │   ├── sns/
│   │   ├── sqs/
│   │   └── opensearch/
│   └── envs/              # Environment-specific configs
│       ├── dev/
│       ├── stage/
│       └── prod/
├── backend/               # Backend code
│   └── lambda/           # Lambda functions
├── tests/                # Test suites
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── smoke/
├── scripts/              # Automation scripts
│   ├── readiness-checks.sh
│   ├── warmup-lambdas.sh
│   └── setup-secrets.sh
└── docs/                 # Documentation
    └── DEPLOYMENT_GUIDE.md
```

## 🚀 Quick Start

### Prerequisites
- AWS Account with admin access
- Terraform >= 1.6.0
- AWS CLI >= 2.13.0
- Node.js >= 20.0.0
- GitHub repository with Actions enabled

### 1. Initial Setup

```bash
# Clone repository
git clone https://github.com/yourusername/warmpawzecodev.git
cd warmpawzecodev

# Install dependencies
npm install

# Configure AWS CLI
aws configure

# Create Terraform state backend (one-time)
cd infra/bootstrap
terraform init
terraform apply -var="create_state_backend=true" -var="aws_account_id=YOUR_ACCOUNT_ID"
```

### 2. Set Up GitHub Secrets

Add the following secrets in GitHub Settings → Secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_ACCOUNT_ID`
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
- `STRIPE_SECRET_KEY`
- `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD`
- `GOOGLE_MAPS_API_KEY`
- `SLACK_WEBHOOK_URL`

See [.github/SECRETS.md](.github/SECRETS.md) for complete list.

### 3. Deploy Development Environment

```bash
# Push to develop branch to trigger auto-deployment
git checkout develop
git push origin develop

# Or deploy manually
cd infra/envs/dev
terraform init -backend-config=backend.hcl
terraform apply
```

### 4. Deploy to Stage & Production

Stage and production deployments require manual approval via GitHub Actions UI.

## 📊 Environment Comparison

| Feature | Dev | Stage | Prod |
|---------|-----|-------|------|
| Auto-deploy | ✅ | ❌ | ❌ |
| Approvals | 0 | 1 | 2 |
| HA | ❌ | ✅ | ✅ |
| Multi-AZ | ❌ | ✅ | ✅ |
| RDS Capacity | 0.5-1 ACU | 1-4 ACU | 2-16 ACU |
| Backup Retention | 3 days | 7 days | 30 days |
| Cost | ~$50/mo | ~$200/mo | ~$500/mo |

## 🧪 Testing

All tests must pass (100%) before deployment proceeds to next environment.

```bash
# Run all tests
npm test

# Individual test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:smoke
```

### Test Coverage
- **Unit Tests**: Business logic, pricing, commissions
- **Integration Tests**: Lambda↔RDS, Auth flows, Payments
- **E2E Tests**: Customer journey, Vendor onboarding, Booking lifecycle
- **Smoke Tests**: API health, DB connectivity, External integrations

## 🔒 Security

- ✅ All secrets in AWS Secrets Manager
- ✅ Encryption at rest (RDS, S3, DynamoDB)
- ✅ Encryption in transit (TLS 1.2+)
- ✅ VPC isolation per environment
- ✅ IAM least privilege policies
- ✅ MFA on root account
- ✅ CloudTrail audit logging
- ✅ Security Hub enabled

## 📈 Monitoring

### CloudWatch Alarms
- RDS CPU utilization > 80%
- Lambda errors > 5 per 5 minutes
- API Gateway 5XX errors
- DynamoDB throttles
- SQS message age > 10 minutes

### Dashboards
- Lambda performance metrics
- API Gateway latency
- Database connections
- Queue depths
- Payment success rates

## 🔄 CI/CD Pipeline

### Development Pipeline (Automatic)
1. Static analysis (lint, type-check)
2. Unit tests with coverage
3. Build & package
4. Terraform apply
5. Database migrations
6. Integration tests
7. Smoke tests
8. Readiness checks

### Stage Pipeline (Manual Approval)
1. Drift detection
2. Full test suite (unit + integration + e2e)
3. Build production artifacts
4. Terraform plan
5. **Manual approval required**
6. Terraform apply
7. Database migrations
8. E2E tests
9. Smoke tests
10. Tag release candidate

### Production Pipeline (Strict Approval)
1. Confirmation check
2. Pre-deployment checklist
3. Infrastructure diff (stage vs prod)
4. Build with production optimizations
5. Terraform plan
6. **Final approval (2 reviewers required)**
7. Blue/green deployment
8. Database backup
9. Migrations
10. Warm up Lambdas
11. Smoke tests
12. Payment gateway validation
13. Final readiness report
14. Tag production release

## 📚 Documentation

- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Secrets Management](.github/SECRETS.md)
- [Environment Variables](.env.example)
- [Architecture Diagrams](docs/architecture/)

## 🛠️ Troubleshooting

### Common Issues

**Terraform state locked:**
```bash
terraform force-unlock <LOCK_ID>
```

**Lambda cold starts:**
```bash
./scripts/warmup-lambdas.sh dev
```

**Database connection issues:**
```bash
# Check security groups
aws ec2 describe-security-groups --group-ids <SG_ID>

# Test from Lambda
aws lambda invoke --function-name warmpawz-dev-api-handler \
  --payload '{"action":"db-test"}' response.json
```

See [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) for more troubleshooting steps.

## 🔙 Rollback

### Rollback to Previous Version
```bash
cd infra/envs/prod
PREV_VERSION=$(git describe --abbrev=0 --tags HEAD~1)
git checkout $PREV_VERSION
terraform apply
```

### Rollback Database Migrations
```bash
cd db
npm run migrate:down
```

## 📝 License

Proprietary - All Rights Reserved

## 👥 Team

- **DevOps**: devops@warmpawz.com
- **Backend**: backend@warmpawz.com
- **Support**: #warmpawz-devops on Slack

## 🎯 Success Criteria

✅ **Infrastructure**
- No drift
- All resources created
- No errors in logs

✅ **Tests**
- 100% pass rate
- Coverage > 90%

✅ **Connectivity**
- RDS reachable
- API Gateway live
- Cognito active
- All queues operational

✅ **External Integrations**
- Razorpay validated
- Stripe validated
- Shiprocket connected

✅ **Deployment**
- Zero downtime
- Rollback plan ready
- Monitoring active

---

**Built with ❤️ for pet lovers**

