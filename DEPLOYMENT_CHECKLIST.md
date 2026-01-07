# Pre-Deployment Checklist

Use this checklist before deploying to any environment.

## ☑️ Prerequisites

### AWS Setup
- [ ] AWS account created
- [ ] AWS CLI installed and configured
- [ ] IAM user created with programmatic access
- [ ] IAM user has required permissions
- [ ] MFA enabled on root account
- [ ] AWS Account ID noted: `______________`

### Tools Installed
- [ ] Terraform >= 1.6.0
- [ ] AWS CLI >= 2.13.0
- [ ] Node.js >= 20.0.0
- [ ] Git >= 2.40.0
- [ ] jq (JSON processor)

### Repository Setup
- [ ] Repository cloned locally
- [ ] npm dependencies installed
- [ ] GitHub repository created
- [ ] GitHub Actions enabled

---

## ☑️ Bootstrap (One-Time Setup)

- [ ] Terraform state backend created
  ```bash
  cd infra/bootstrap
  terraform apply -var="create_state_backend=true"
  ```
- [ ] S3 bucket verified: `warmpawz-terraform-state-ACCOUNT_ID`
- [ ] DynamoDB table verified: `warmpawz-terraform-locks`
- [ ] All environment backend configs updated with account ID

---

## ☑️ GitHub Configuration

### Repository Secrets
- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`
- [ ] `AWS_REGION`
- [ ] `AWS_ACCOUNT_ID`
- [ ] `RAZORPAY_KEY_ID`
- [ ] `RAZORPAY_KEY_SECRET`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `SHIPROCKET_EMAIL`
- [ ] `SHIPROCKET_PASSWORD`
- [ ] `GOOGLE_MAPS_API_KEY`
- [ ] `SLACK_WEBHOOK_URL` (optional)
- [ ] `CODECOV_TOKEN` (optional)

### Environment-Specific Secrets
- [ ] `DEV_OPENSEARCH_PASSWORD` (optional)
- [ ] `STAGE_OPENSEARCH_PASSWORD`
- [ ] `PROD_OPENSEARCH_PASSWORD`

### GitHub Environments
- [ ] **dev** environment created
  - No protection rules
  - Allowed branches: `develop`
- [ ] **stage** environment created
  - Required reviewers: 1
  - Allowed branches: `main`
- [ ] **stage-approval** environment created
  - Required reviewers: 1
- [ ] **production** environment created
  - Required reviewers: 2
  - Allowed branches: `main`
- [ ] **production-approval** environment created
  - Required reviewers: 2

---

## ☑️ AWS Secrets Manager

### Development
- [ ] `warmpawz/dev/razorpay` created
- [ ] `warmpawz/dev/stripe` created
- [ ] `warmpawz/dev/shiprocket` created
- [ ] `warmpawz/dev/google-maps` created

### Stage
- [ ] `warmpawz/stage/razorpay` created
- [ ] `warmpawz/stage/stripe` created
- [ ] `warmpawz/stage/shiprocket` created
- [ ] `warmpawz/stage/google-maps` created

### Production
- [ ] `warmpawz/prod/razorpay` created
- [ ] `warmpawz/prod/stripe` created
- [ ] `warmpawz/prod/shiprocket` created
- [ ] `warmpawz/prod/google-maps` created

---

## ☑️ Development Environment Deployment

### Pre-Deployment
- [ ] Review `infra/envs/dev/terraform.tfvars`
- [ ] Update alert emails
- [ ] Set OpenSearch password (if enabled)
- [ ] Review resource allocations

### Deployment
- [ ] Terraform init successful
  ```bash
  cd infra/envs/dev
  terraform init -backend-config=backend.hcl
  ```
- [ ] Terraform plan reviewed
  ```bash
  terraform plan
  ```
- [ ] Terraform apply completed
  ```bash
  terraform apply
  ```
- [ ] Outputs captured
  ```bash
  terraform output -json > outputs.json
  ```

### Post-Deployment Verification
- [ ] VPC created
- [ ] RDS cluster available
- [ ] Lambda functions deployed
- [ ] API Gateway accessible
- [ ] Cognito pools active
- [ ] S3 buckets created
- [ ] DynamoDB tables created
- [ ] SNS topics created
- [ ] SQS queues created

### Database Setup
- [ ] Database migrations run
  ```bash
  cd db
  npm run migrate:up
  ```
- [ ] Migrations verified
  ```bash
  npm run migrate:status
  ```
- [ ] Test data seeded (optional)
  ```bash
  npm run seed:dev
  ```

### Testing
- [ ] Unit tests pass
  ```bash
  npm run test:unit
  ```
- [ ] Integration tests pass
  ```bash
  npm run test:integration
  ```
- [ ] Smoke tests pass
  ```bash
  npm run test:smoke
  ```
- [ ] Readiness checks pass
  ```bash
  ./scripts/readiness-checks.sh dev
  ```

### Monitoring
- [ ] CloudWatch logs accessible
- [ ] Alarms configured
- [ ] SNS notifications working

---

## ☑️ Stage Environment Deployment

### Pre-Deployment
- [ ] All dev tests passing
- [ ] No infrastructure drift in dev
- [ ] Review `infra/envs/stage/terraform.tfvars`
- [ ] Update alert emails
- [ ] Set strong OpenSearch password

### Deployment Checklist
- [ ] Push to `main` branch or trigger workflow manually
- [ ] Drift detection passed
- [ ] Full test suite passed (unit + integration + e2e)
- [ ] Terraform plan reviewed
- [ ] Manual approval obtained (1 reviewer)
- [ ] Terraform apply completed
- [ ] Database migrations successful
- [ ] E2E tests passed
- [ ] Smoke tests passed
- [ ] Release candidate tagged

### Post-Deployment Verification
- [ ] All services healthy
- [ ] API accessible via stage domain
- [ ] Auth flows working
- [ ] Payment sandbox validated
- [ ] Monitoring active
- [ ] Alerts configured

---

## ☑️ Production Environment Deployment

### Pre-Deployment
- [ ] All stage tests passing for at least 24 hours
- [ ] No incidents in stage
- [ ] Infrastructure validated
- [ ] Rollback plan prepared
- [ ] Team notified
- [ ] Maintenance window scheduled (if needed)

### Pre-Flight Checklist
- [ ] Stage deployment successful
- [ ] All tests passing (100%)
- [ ] Infrastructure diff reviewed (stage vs prod)
- [ ] Database backup verified
- [ ] Rollback procedure tested

### Deployment Checklist
- [ ] Trigger workflow manually from GitHub Actions
- [ ] Type confirmation: `DEPLOY_TO_PRODUCTION`
- [ ] Pre-flight checks passed
- [ ] Infrastructure diff reviewed
- [ ] Terraform plan reviewed
- [ ] Final approval obtained (2 reviewers)
- [ ] Deployment approved by stakeholders

### During Deployment
- [ ] Monitor CloudWatch logs
- [ ] Watch for errors in real-time
- [ ] Verify Lambda invocations
- [ ] Monitor API Gateway metrics
- [ ] Check database connections

### Post-Deployment Verification
- [ ] Blue/green deployment successful
- [ ] Database backup created
- [ ] Migrations applied successfully
- [ ] Lambda functions warmed up
- [ ] Smoke tests passed
- [ ] Payment gateways validated
  - [ ] Razorpay sandbox test
  - [ ] Stripe sandbox test
- [ ] External integrations working
  - [ ] Shiprocket auth
  - [ ] Borzo connection
  - [ ] Google Maps API
- [ ] Final readiness checks passed
- [ ] Production release tagged
- [ ] Team notified of successful deployment

### Monitoring (First 4 Hours)
- [ ] Monitor error rates
- [ ] Check latency metrics
- [ ] Verify throughput
- [ ] Monitor costs
- [ ] Watch for alarms
- [ ] Customer feedback channels monitored

---

## ☑️ Rollback Preparation

### Before Any Production Deployment
- [ ] Current version tagged
- [ ] Rollback procedure documented
- [ ] Database backup recent (< 1 hour)
- [ ] Previous version tested
- [ ] Rollback window identified

### Rollback Triggers
- [ ] Error rate > 5%
- [ ] Latency > 5 seconds
- [ ] Critical functionality broken
- [ ] Security vulnerability discovered
- [ ] Data integrity issues

---

## ☑️ Security Validation

- [ ] All secrets in Secrets Manager
- [ ] No secrets in code
- [ ] No secrets in logs
- [ ] Encryption at rest enabled
- [ ] Encryption in transit enabled
- [ ] IAM roles using least privilege
- [ ] Security groups properly configured
- [ ] VPC properly isolated
- [ ] CloudTrail enabled
- [ ] GuardDuty enabled (optional)

---

## ☑️ Cost Optimization

- [ ] Dev environment using minimal resources
- [ ] Auto-scaling configured
- [ ] Unused resources identified
- [ ] Budget alerts configured
- [ ] Cost allocation tags applied

---

## ☑️ Documentation

- [ ] Architecture diagram updated
- [ ] API documentation current
- [ ] Runbooks created
- [ ] Incident response plan documented
- [ ] Contact list updated

---

## ☑️ Final Sign-Off

### Development
- [ ] Technical Lead approval
- [ ] QA sign-off

### Stage
- [ ] Engineering Manager approval
- [ ] Product Owner sign-off

### Production
- [ ] CTO approval
- [ ] CEO sign-off (for major releases)
- [ ] Customer Success notified
- [ ] Marketing team notified

---

## 📊 Deployment Success Metrics

After deployment, verify:
- [ ] Uptime > 99.9%
- [ ] Error rate < 0.1%
- [ ] API latency < 500ms (p95)
- [ ] Database connections < 80%
- [ ] Lambda cold starts < 1%
- [ ] Cost within budget

---

## 📞 Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| DevOps Lead | _______ | _______ |
| Backend Lead | _______ | _______ |
| CTO | _______ | _______ |
| AWS Support | _______ | _______ |

---

## 🎯 Quick Reference

```bash
# Deploy dev
git checkout develop && git push

# Deploy stage
# Push to main, approve in GitHub Actions

# Deploy prod
# Trigger manually, type DEPLOY_TO_PRODUCTION

# Rollback
cd infra/envs/prod
git checkout previous-tag
terraform apply

# Check logs
aws logs tail /aws/lambda/warmpawz-ENVIRONMENT-FUNCTION --follow

# Run tests
npm run test:all

# Readiness checks
./scripts/readiness-checks.sh ENVIRONMENT

# Warm up Lambdas
./scripts/warmup-lambdas.sh ENVIRONMENT
```

---

**Remember**: Production deployments are irreversible operations. Triple-check everything! ✅

