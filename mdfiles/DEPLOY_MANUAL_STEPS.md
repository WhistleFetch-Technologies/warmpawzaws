# 🚀 **DEPLOYMENT READY - Manual Steps Required**

Your AWS Account ID: **023394150666**
Your AWS Region: **ap-south-1** (Mumbai)

---

## ✅ **What's Ready**

- ✅ AWS CLI configured
- ✅ Git repository on `main` branch
- ✅ All infrastructure code created
- ✅ All documentation ready
- ✅ Secrets setup scripts ready

## ❌ **What's Missing**

- ❌ GitHub CLI (needed for automated secret setup)
- ❌ Terraform (needed for infrastructure deployment)
- ❌ GitHub Secrets not yet configured

---

## 🎯 **RECOMMENDED PATH: Manual GitHub Setup**

Since GitHub CLI isn't available, let's set up secrets manually via GitHub web interface:

### **STEP 1: Install GitHub CLI (Optional but Recommended)**

Download from: https://cli.github.com/

Or skip and use web interface below ⬇️

---

### **STEP 2: Set Up GitHub Secrets (Web Interface)**

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add each secret below:

#### **AWS Credentials**
```
Name: AWS_ACCESS_KEY_ID
Value: AKIAQK4TGNEFLQJLXMMI

Name: AWS_SECRET_ACCESS_KEY
Value: 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

Name: AWS_REGION
Value: ap-south-1

Name: AWS_ACCOUNT_ID
Value: 023394150666
```

#### **Razorpay**
```
Name: RAZORPAY_KEY_ID
Value: rzp_test_Rnp57suJH3wzUl

Name: RAZORPAY_KEY_SECRET
Value: rplcWAxtmVfvXI9uydFt7YkH

Name: RAZORPAY_WEBHOOK_SECRET
Value: (Get from https://dashboard.razorpay.com/app/webhooks)
```

#### **Google Maps**
```
Name: GOOGLE_MAPS_API_KEY
Value: AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0
```

#### **Shiprocket**
```
Name: SHIPROCKET_EMAIL
Value: ketanh@warmpawz.com

Name: SHIPROCKET_PASSWORD
Value: znoMnd9FkntmRuXCq$d@eKfQj1M8oXGj.
```

#### **OpenSearch Passwords (Generate Strong Passwords)**
```
Name: DEV_OPENSEARCH_PASSWORD
Value: (Generate strong password - optional)

Name: STAGE_OPENSEARCH_PASSWORD
Value: (Generate strong password)

Name: PROD_OPENSEARCH_PASSWORD
Value: (Generate strong password)
```

#### **Frontend Keys**
```
Name: NEXT_PUBLIC_RAZORPAY_KEY_DEV
Value: rzp_test_Rnp57suJH3wzUl

Name: NEXT_PUBLIC_RAZORPAY_KEY_STAGE
Value: rzp_test_Rnp57suJH3wzUl

Name: NEXT_PUBLIC_RAZORPAY_KEY_PROD
Value: rzp_test_Rnp57suJH3wzUl (use live key when ready)

Name: NEXT_PUBLIC_API_BASE_URL_DEV
Value: https://dev.api.warmpawz.com

Name: NEXT_PUBLIC_API_BASE_URL_STAGE
Value: https://stage.api.warmpawz.com

Name: NEXT_PUBLIC_API_BASE_URL_PROD
Value: https://api.warmpawz.com
```

#### **Optional**
```
Name: SLACK_WEBHOOK_URL
Value: (Your Slack webhook URL)

Name: CODECOV_TOKEN
Value: (Your Codecov token)
```

---

### **STEP 3: Set Up GitHub Environments**

1. Go to **Settings** → **Environments**
2. Create these environments:

#### **dev**
- No protection rules
- Deployment branches: `develop`

#### **stage** 
- Required reviewers: 1
- Deployment branches: `main`

#### **stage-approval**
- Required reviewers: 1
- Deployment branches: `main`

#### **production**
- Required reviewers: 2
- Deployment branches: `main`

#### **production-approval**
- Required reviewers: 2
- Deployment branches: `main`

---

### **STEP 4: Set Up AWS Secrets Manager**

Run this command to set up runtime secrets:

```bash
# The script will create secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name "warmpawz/dev/razorpay" \
  --secret-string '{"key_id":"rzp_test_Rnp57suJH3wzUl","key_secret":"rplcWAxtmVfvXI9uydFt7YkH"}' \
  --region ap-south-1

aws secretsmanager create-secret \
  --name "warmpawz/dev/google-maps" \
  --secret-string '{"api_key":"AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0"}' \
  --region ap-south-1

aws secretsmanager create-secret \
  --name "warmpawz/dev/shiprocket" \
  --secret-string '{"email":"ketanh@warmpawz.com","password":"znoMnd9FkntmRuXCq$d@eKfQj1M8oXGj."}' \
  --region ap-south-1
```

Repeat for `stage` and `prod` environments.

---

### **STEP 5: Install Terraform**

Download from: https://www.terraform.io/downloads

Or if you have `apt`/`yum`:
```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get install -y terraform

# RedHat/CentOS
sudo yum install -y terraform
```

---

### **STEP 6: Bootstrap Terraform**

```bash
cd /Users/ketan/Documents/warmpawzecodev/infra/bootstrap

# Update with your account ID
sed -i '' 's/YOUR_ACCOUNT_ID/023394150666/g' backend.tf

# Initialize and apply
terraform init
terraform apply -var="create_state_backend=true" -var="aws_account_id=023394150666"
```

---

### **STEP 7: Deploy to Development**

```bash
cd /Users/ketan/Documents/warmpawzecodev

# Create develop branch if it doesn't exist
git checkout -b develop

# Add all files
git add .

# Commit
git commit -m "feat: initial CI/CD infrastructure setup"

# Push to trigger deployment
git push origin develop
```

This will trigger `.github/workflows/dev.yml` automatically!

---

### **STEP 8: Monitor Deployment**

Go to: https://github.com/YOUR_USERNAME/warmpawzecodev/actions

You'll see the workflow running with these stages:
- Static Analysis
- Unit Tests
- Build
- Terraform Plan
- Terraform Apply
- Database Migrations
- Integration Tests
- Smoke Tests
- Readiness Checks

---

### **STEP 9: Deploy to Stage**

After dev is successful:

```bash
git checkout main
git merge develop
git push origin main
```

⚠️ **Requires 1 reviewer approval** in GitHub Actions

---

### **STEP 10: Deploy to Production**

1. Go to GitHub Actions
2. Select "Deploy to Production" workflow
3. Click "Run workflow"
4. Type: `DEPLOY_TO_PRODUCTION`
5. Get 2 reviewers to approve

---

## ⚠️ **CRITICAL: After Deployment**

**ROTATE ALL CREDENTIALS IMMEDIATELY!**

Your credentials were exposed in plain text. Follow `SECURITY_WARNING.md` for rotation instructions.

---

## 📚 **Quick Reference**

- **Check secrets**: GitHub → Settings → Secrets
- **Check AWS secrets**: `aws secretsmanager list-secrets --region ap-south-1`
- **Check deployments**: GitHub → Actions
- **Check CloudWatch**: AWS Console → CloudWatch → Log Groups

---

## 🆘 **Need Help?**

- Installation issues? See `docs/DEPLOYMENT_GUIDE.md`
- Deployment failures? Check GitHub Actions logs
- Runtime errors? Check CloudWatch logs
- Security questions? See `SECURITY_WARNING.md`

---

**You're ready to deploy! Start with STEP 2 above.** 🚀

