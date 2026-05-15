# URGENT: Lambda Deployment Workarounds

## Status: URGENT - Lambda CLI Access Blocked

**Issue:** Cannot deploy Lambda via AWS CLI due to AccessDeniedException  
**Support Case:** case-057442119249-muen-2026-d3270440c0645a66 (Escalated)  
**Production Lambda:** `warmpawz-prod-api-handler`  
**Region:** ap-south-1

---

## ✅ IMMEDIATE ACTIONS TAKEN

1. ✅ **Urgent communication added to support case**
2. ✅ **Case escalated** - Requested immediate attention

---

## 🚀 WORKAROUND OPTIONS (Try in Order)

### Option 1: Deploy via Serverless Framework ⭐ RECOMMENDED

Serverless Framework may bypass Lambda CLI permission issues by using CloudFormation.

```powershell
# Navigate to Lambda directory
cd warmpawzApp\warmpawzaws\backend\lambda

# Install Serverless Framework (if not installed)
npm install -g serverless

# Deploy to PRODUCTION
serverless deploy --stage prod --region ap-south-1
```

**Why this might work:**
- Serverless Framework uses CloudFormation, not direct Lambda API calls
- CloudFormation may have different permissions than Lambda CLI
- This is the standard deployment method for this project

---

### Option 2: Deploy via AWS Console (Manual Upload)

If Serverless Framework also fails, manually upload via AWS Console:

1. **Build the Lambda package:**
   ```powershell
   cd warmpawzApp\warmpawzaws\backend\lambda
   npm install
   npm run build
   # This creates api-handler.zip
   ```

2. **Upload via AWS Console:**
   - Go to: https://console.aws.amazon.com/lambda/home?region=ap-south-1#/functions/warmpawz-prod-api-handler
   - Click "Upload from" → ".zip file"
   - Select `api-handler.zip`
   - Click "Save"

**Note:** Console upload may also fail if permissions are truly blocked, but worth trying.

---

### Option 3: Use CloudFormation Directly

If you have CloudFormation permissions:

```powershell
# Build Lambda first
cd warmpawzApp\warmpawzaws\backend\lambda
npm install
npm run build

# Use CloudFormation to update (if stack exists)
aws cloudformation update-stack \
  --stack-name warmpawz-prod-lambda \
  --template-body file://template.yaml \
  --region ap-south-1
```

---

### Option 4: Use Different AWS User/Role

If you have access to another AWS user or role with Lambda permissions:

```powershell
# Switch AWS credentials
aws configure --profile lambda-deployer
# Or use environment variables
$env:AWS_ACCESS_KEY_ID = "..."
$env:AWS_SECRET_ACCESS_KEY = "..."
$env:AWS_SESSION_TOKEN = "..." # if using temporary credentials

# Then deploy
cd warmpawzApp\warmpawzaws\backend\lambda
npm run build
aws lambda update-function-code --function-name warmpawz-prod-api-handler --zip-file fileb://api-handler.zip --region ap-south-1
```

---

### Option 5: Contact AWS Account Administrator

If you have an AWS account administrator or root user access:

1. **Root user can:**
   - Grant Lambda permissions directly
   - Fix IAM policy evaluation issues
   - Check for account-level restrictions

2. **Account administrator can:**
   - Review and fix IAM policies
   - Check for Service Control Policies (SCPs)
   - Verify account health

---

## 📋 QUICK DEPLOYMENT SCRIPT

Run this PowerShell script to try Serverless Framework deployment:

```powershell
# Save as: deploy-lambda-urgent.ps1
$ErrorActionPreference = "Stop"

Write-Host "🚨 URGENT: Deploying Lambda via Serverless Framework" -ForegroundColor Red
Write-Host ""

$lambdaDir = "warmpawzApp\warmpawzaws\backend\lambda"
Set-Location $lambdaDir

# Check if serverless is installed
if (!(Get-Command serverless -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Serverless Framework..." -ForegroundColor Yellow
    npm install -g serverless
}

# Deploy to production
Write-Host "Deploying to PRODUCTION..." -ForegroundColor Yellow
serverless deploy --stage prod --region ap-south-1 --verbose

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
} else {
    Write-Host "❌ Deployment failed. Try Option 2 (Console upload)" -ForegroundColor Red
}
```

---

## 🔍 VERIFY DEPLOYMENT

After deployment, verify:

```powershell
# Check Lambda function (if you can access it)
aws lambda get-function --function-name warmpawz-prod-api-handler --region ap-south-1

# Test API endpoint
$apiUrl = "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/auth/send-otp"
Invoke-RestMethod -Uri $apiUrl -Method POST -Body '{"phone":"+911234567890"}' -ContentType "application/json"
```

---

## 📞 ESCALATION PATH

1. **Support Case:** Already escalated - Check for response
2. **AWS Account Root User:** If available, use root credentials
3. **AWS Account Administrator:** Contact to fix IAM permissions
4. **AWS TAM (Technical Account Manager):** If you have Enterprise Support

---

## ⚠️ IMPORTANT NOTES

- **Serverless Framework is the recommended approach** - It's the standard deployment method
- **Console upload may work** even if CLI doesn't (different permission path)
- **Support case is escalated** - AWS should respond within hours for urgent cases
- **Document what works** - This will help resolve the root cause

---

## 📝 NEXT STEPS AFTER DEPLOYMENT

1. ✅ Verify Lambda is working
2. ✅ Test API endpoints
3. ✅ Monitor CloudWatch logs
4. ✅ Update support case with resolution
5. ✅ Document the working workaround

---

**Last Updated:** 2026-03-15  
**Priority:** URGENT
