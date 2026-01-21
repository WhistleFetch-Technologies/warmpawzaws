# 🔐 GitHub Secrets Setup Guide

## Required Secrets for CI/CD Pipeline

You need to set up the following secrets in your GitHub repository.

### How to Add Secrets

1. Go to: **https://github.com/ketan0103/warmpawzaws/settings/secrets/actions**
2. Click **"New repository secret"**
3. Add each secret from the list below

---

## 📋 Complete List of Required Secrets

### AWS Credentials
| Secret Name | Value |
|-------------|-------|
| `AWS_ACCESS_KEY_ID` | `AKIAQK4TGNEFLQJLXMMI` |
| `AWS_SECRET_ACCESS_KEY` | `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` |

### Razorpay (Payment Gateway)
| Secret Name | Value |
|-------------|-------|
| `RAZORPAY_KEY_ID` | `rzp_test_Rnp57suJH3wzUl` |
| `RAZORPAY_KEY_SECRET` | `rplcWAxtmVfvXI9uydFt7YkH` |

### Google Maps
| Secret Name | Value |
|-------------|-------|
| `GOOGLE_MAPS_API_KEY` | `AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0` |

### Shiprocket (Delivery Logistics)
| Secret Name | Value |
|-------------|-------|
| `SHIPROCKET_EMAIL` | `ketanh@warmpawz.com` |
| `SHIPROCKET_PASSWORD` | `znoMnd9FkntmRuXCq$d@eKfQj1M8oXGj` |

### OpenSearch Passwords (Generate secure passwords)
| Secret Name | Value (Example - use strong passwords) |
|-------------|-------|
| `DEV_OPENSEARCH_PASSWORD` | `WarmpawzDev2024Aa1!` |
| `STAGE_OPENSEARCH_PASSWORD` | `WarmpawzStage2024Bb2!` |
| `PROD_OPENSEARCH_PASSWORD` | `WarmpawzProd2024Cc3!` |

---

## 🚀 Quick Setup (Copy & Paste)

### Using GitHub CLI (if installed)

```bash
# Install GitHub CLI first
brew install gh  # macOS
# or visit https://cli.github.com/ for other OS

# Authenticate
gh auth login

# Then run:
REPO="ketan0103/warmpawzaws"

# AWS
gh secret set AWS_ACCESS_KEY_ID --repo "$REPO" --body "AKIAQK4TGNEFLQJLXMMI"
gh secret set AWS_SECRET_ACCESS_KEY --repo "$REPO" --body "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"

# Razorpay
gh secret set RAZORPAY_KEY_ID --repo "$REPO" --body "rzp_test_Rnp57suJH3wzUl"
gh secret set RAZORPAY_KEY_SECRET --repo "$REPO" --body "rplcWAxtmVfvXI9uydFt7YkH"

# Google Maps
gh secret set GOOGLE_MAPS_API_KEY --repo "$REPO" --body "AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0"

# Shiprocket
gh secret set SHIPROCKET_EMAIL --repo "$REPO" --body "ketanh@warmpawz.com"
gh secret set SHIPROCKET_PASSWORD --repo "$REPO" --body 'znoMnd9FkntmRuXCq$d@eKfQj1M8oXGj'

# OpenSearch (use secure passwords)
gh secret set DEV_OPENSEARCH_PASSWORD --repo "$REPO" --body "WarmpawzDev2024Aa1!"
gh secret set STAGE_OPENSEARCH_PASSWORD --repo "$REPO" --body "WarmpawzStage2024Bb2!"
gh secret set PROD_OPENSEARCH_PASSWORD --repo "$REPO" --body "WarmpawzProd2024Cc3!"
```

---

## ✅ Verification Checklist

After adding all secrets, verify you have these 10 secrets:

- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`
- [ ] `RAZORPAY_KEY_ID`
- [ ] `RAZORPAY_KEY_SECRET`
- [ ] `GOOGLE_MAPS_API_KEY`
- [ ] `SHIPROCKET_EMAIL`
- [ ] `SHIPROCKET_PASSWORD`
- [ ] `DEV_OPENSEARCH_PASSWORD`
- [ ] `STAGE_OPENSEARCH_PASSWORD`
- [ ] `PROD_OPENSEARCH_PASSWORD`

---

## 🔄 After Setup

Once secrets are configured:

1. Go to **Actions** tab
2. Find the latest workflow run for `develop` branch
3. If it failed, click **"Re-run all jobs"**
4. Or push a new commit to trigger a fresh run

---

## 📱 What Gets Deployed

After successful deployment, you'll have:

### URLs
| App | URL |
|-----|-----|
| API | https://dev.api.warmpawz.com |
| Admin Dashboard | https://dev.admin.warmpawz.com |
| Vendor Portal | https://dev.vendor.warmpawz.com |
| Customer App | https://dev.customer.warmpawz.com |

### Mobile Apps
- **Android APKs** available as workflow artifacts
- Download from: Actions → Workflow Run → Artifacts

### Infrastructure
- ✅ VPC with subnets
- ✅ RDS Aurora PostgreSQL
- ✅ Lambda functions
- ✅ API Gateway with custom domain
- ✅ Cognito User Pools
- ✅ S3 buckets (uploads + frontend hosting)
- ✅ CloudFront distributions
- ✅ SNS for push notifications
- ✅ SQS for async processing
- ✅ OpenSearch/Elasticsearch (optional)

### Database
- ✅ 89+ migration files applied
- ✅ All tables, indexes, foreign keys created
- ✅ Seed data (roles, service catalog)

---

## ⚠️ Security Notes

1. **Keep secrets secure** - Never commit them to code
2. **Rotate regularly** - Update AWS credentials periodically
3. **Test keys** - The Razorpay keys provided are TEST keys
4. **Production** - Use different credentials for production

---

## 🆘 Troubleshooting

### Secret not found error
- Verify the secret name matches exactly (case-sensitive)
- Check for trailing spaces

### Terraform apply fails
- Ensure AWS credentials are correct
- Check IAM permissions for the AWS user

### Certificate validation pending
- Route53 zone must be properly configured
- DNS propagation can take up to 48 hours

### Mobile build fails
- Check Android keystore configuration
- Ensure Java 17 is available

---

**Status:** Ready to deploy! 🚀

After setting up secrets, the pipeline will:
1. Build all apps (backend + 3 frontends + 2 mobile)
2. Deploy infrastructure via Terraform
3. Deploy frontends to CloudFront
4. Run database migrations
5. Generate Android APKs

