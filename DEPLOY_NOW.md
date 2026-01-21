# 🚀 Deploy Now - Manual Steps

Since automated deployment isn't showing output, here are the manual steps:

## Step 1: Deploy Backend Lambda

```bash
cd backend/lambda
npm install
npm run build
# Then deploy using your method:
# - serverless deploy --stage dev
# - OR use AWS SAM
# - OR use your CI/CD pipeline
```

## Step 2: Deploy Frontend Apps

**Vendor Web:**
```bash
cd apps/vendor-web
npm install
npm run build
# Deploy to your hosting (Vercel, CloudFront, etc.)
```

**Customer Web:**
```bash
cd apps/customer-web
npm install
npm run build
# Deploy to your hosting (Vercel, CloudFront, etc.)
```

## Quick Deploy Script

Try running the deployment script directly in your terminal:

```bash
cd /Users/ketan/Documents/warmpawzecodev
bash scripts/deploy-all.sh dev
```

Or deploy components individually:

```bash
# Backend
cd backend/lambda && npm run build && serverless deploy --stage dev

# Frontend
cd apps/vendor-web && npm run build && # deploy command
cd apps/customer-web && npm run build && # deploy command
```

## What Gets Deployed

✅ **Backend:** Instant Tele Queue endpoints + GPS tracking
✅ **Frontend:** Dashboard widgets + Tele consultation pages
✅ **Database:** Already migrated ✅

## Verification

After deployment, test:
1. API endpoints respond
2. Vendor dashboard shows Instant Tele widget
3. Customer can access tele consultation page
