# Quick Setup Guide - Credentials Already Provided

## ⚠️ READ FIRST: Security Warning

Your credentials have been exposed in plain text. Follow this guide and then **ROTATE ALL CREDENTIALS IMMEDIATELY**.

---

## Step 1: Add Scripts to .gitignore (DO THIS FIRST!)

```bash
cat >> .gitignore << 'EOF'

# Security - Never commit these
scripts/setup-github-secrets.sh
scripts/setup-aws-secrets.sh
SECURITY_WARNING.md
QUICK_SETUP_CREDENTIALS.md
EOF
```

---

## Step 2: Make Scripts Executable

```bash
chmod +x scripts/setup-github-secrets.sh
chmod +x scripts/setup-aws-secrets.sh
```

---

## Step 3: Install GitHub CLI (if not installed)

```bash
# macOS
brew install gh

# Linux
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh

# Windows
winget install --id GitHub.cli
```

---

## Step 4: Authenticate GitHub CLI

```bash
gh auth login
# Select: GitHub.com
# Select: HTTPS
# Select: Login with a web browser
# Follow the prompts
```

---

## Step 5: Update Repository Name in Script

Edit `scripts/setup-github-secrets.sh` line 22:

```bash
# Change this line:
REPO="ketan/warmpawzecodev"

# To your actual repository (format: username/repo-name)
REPO="YOUR_GITHUB_USERNAME/warmpawzecodev"
```

---

## Step 6: Run GitHub Secrets Setup

```bash
cd /Users/ketan/Documents/warmpawzecodev
./scripts/setup-github-secrets.sh
```

**What it does:**
- Sets up AWS credentials
- Sets up Razorpay credentials
- Sets up Google Maps API key
- Sets up Shiprocket credentials
- Prompts for OpenSearch passwords
- Prompts for Stripe credentials (if you have them)
- Prompts for Slack webhook (optional)

**You'll need to provide:**
- OpenSearch passwords (generate strong ones)
- Razorpay webhook secret (from dashboard)
- Stripe credentials (if you have them)
- Slack webhook URL (optional)

---

## Step 7: Configure AWS CLI (if not configured)

```bash
aws configure
# AWS Access Key ID: AKIAQK4TGNEFLQJLXMMI
# AWS Secret Access Key: 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
# Default region: ap-south-1
# Default output format: json
```

---

## Step 8: Run AWS Secrets Manager Setup

```bash
./scripts/setup-aws-secrets.sh
```

**What it does:**
- Creates secrets in AWS Secrets Manager for dev/stage/prod
- Sets up Razorpay, Google Maps, Shiprocket secrets
- Prompts for production credentials

**You'll need to provide:**
- Razorpay webhook secret
- Stripe credentials (if you have them)
- Production API keys (can skip and use test keys initially)

---

## Step 9: Verify Secrets Were Created

### GitHub Secrets
```bash
gh secret list
```

### AWS Secrets Manager
```bash
aws secretsmanager list-secrets \
  --region ap-south-1 \
  --query 'SecretList[?contains(Name, `warmpawz`)].Name'
```

---

## Step 10: Update Backend Configuration

Update `infra/envs/*/main.tf` to include region ap-south-1:

```bash
# For each environment (dev, stage, prod)
sed -i 's/us-east-1/ap-south-1/g' infra/envs/dev/main.tf
sed -i 's/us-east-1/ap-south-1/g' infra/envs/stage/main.tf
sed -i 's/us-east-1/ap-south-1/g' infra/envs/prod/main.tf
```

---

## Step 11: Deploy Infrastructure

### Deploy Dev Environment
```bash
cd infra/envs/dev

# Initialize Terraform
terraform init -backend-config=backend.hcl

# Plan
terraform plan

# Apply (if plan looks good)
terraform apply
```

---

## Step 12: ROTATE ALL CREDENTIALS (CRITICAL!)

**You MUST do this because credentials were exposed:**

### Rotate AWS Credentials
```bash
# Create new access key
aws iam create-access-key --user-name YOUR_USERNAME

# Update in GitHub
gh secret set AWS_ACCESS_KEY_ID -b"NEW_KEY_ID"
gh secret set AWS_SECRET_ACCESS_KEY -b"NEW_SECRET"

# Deactivate old key
aws iam update-access-key \
  --access-key-id AKIAQK4TGNEFLQJLXMMI \
  --status Inactive
```

### Rotate Razorpay Keys
1. Login: https://dashboard.razorpay.com/app/keys
2. Regenerate test keys
3. Update secrets:
```bash
gh secret set RAZORPAY_KEY_ID -b"NEW_KEY_ID"
gh secret set RAZORPAY_KEY_SECRET -b"NEW_SECRET"
```

### Restrict Google Maps Key
1. Go to: https://console.cloud.google.com/apis/credentials
2. Select your API key
3. Add restrictions:
   - API restrictions: Maps JavaScript API, Places API, Geocoding API
   - Application restrictions: Your domains only

### Change Shiprocket Password
1. Login: https://app.shiprocket.in/
2. Settings → Change Password
3. Update secret:
```bash
gh secret set SHIPROCKET_PASSWORD -b"NEW_PASSWORD"
```

---

## Step 13: Clean Up

```bash
# Delete or move setup scripts to secure location
rm -f scripts/setup-github-secrets.sh
rm -f scripts/setup-aws-secrets.sh
rm -f SECURITY_WARNING.md
rm -f QUICK_SETUP_CREDENTIALS.md

# Or move to secure location
mkdir -p ~/secure-credentials
mv scripts/setup-*-secrets.sh ~/secure-credentials/
mv SECURITY_WARNING.md ~/secure-credentials/
mv QUICK_SETUP_CREDENTIALS.md ~/secure-credentials/
```

---

## Troubleshooting

### Error: gh not found
Install GitHub CLI (see Step 3)

### Error: Not authenticated with GitHub
Run: `gh auth login`

### Error: AWS credentials not found
Run: `aws configure` (see Step 7)

### Error: Permission denied for scripts
Run: `chmod +x scripts/*.sh`

### Error: Secrets already exist
That's OK! The scripts will update them

---

## Next Steps

After secrets are set up:

1. ✅ Push to `develop` branch to trigger dev deployment
2. ✅ Monitor GitHub Actions for deployment progress
3. ✅ Verify deployment with readiness checks
4. ✅ Document the rotated credentials securely
5. ✅ Set up monitoring and alerts

---

## Reference Files

- `GITHUB_SECRETS_COMPLETE_LIST.md` - Complete list of all secrets
- `docs/DEPLOYMENT_GUIDE.md` - Full deployment guide
- `DEPLOYMENT_CHECKLIST.md` - Step-by-step checklist
- `.github/SECRETS.md` - Secrets documentation

---

**Remember**: Security is not a one-time setup. Rotate credentials every 90 days!

