# Run Deployment - Interactive Guide

The quick-start script is interactive and requires your input. Here's how to run it:

## Run the Script

```bash
./quick-start.sh
```

The script will prompt you at each step:
1. **Database Migration** - Type `y` to run, `n` to skip
2. **Backend Deployment** - Type `y` to deploy, `n` to skip
3. **Frontend Build** - Type `y` to build, `n` to skip

## Or Run Steps Manually

### Step 1: Database Migration
```bash
./db/migrations/run-migration-rds.sh
# Enter stage when prompted (dev/staging/prod)
```

### Step 2: Backend Deployment
```bash
cd backend/lambda
npm run build
serverless deploy --stage dev
cd ../..
```

### Step 3: Frontend Build
```bash
cd apps/admin-web
npm run build
# Then deploy to your platform
cd ../..
```

## Current Status

✅ All files are ready
✅ Scripts are executable
✅ Ready to deploy

**Run `./quick-start.sh` in your terminal to start!**
