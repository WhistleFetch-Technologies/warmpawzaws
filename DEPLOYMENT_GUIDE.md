# Server Deployment Guide

## Prerequisites

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**
   ```bash
   supabase login
   ```

3. **Link to your project**
   ```bash
   supabase link --project-ref vpvpbdwtyugbknrntkho
   ```

## Deployment Steps

### Option 1: Using the Deployment Script (Recommended)

```bash
./deploy-server.sh
```

### Option 2: Manual Deployment

1. **Prepare the function structure**
   ```bash
   # Create function directory
   mkdir -p supabase/functions/make-server-3dd53475
   
   # Copy server files
   cp -r src/supabase/functions/server/* supabase/functions/make-server-3dd53475/
   ```

2. **Deploy the function**
   ```bash
   supabase functions deploy make-server-3dd53475 --no-verify-jwt
   ```

## Verify Deployment

After deployment, test the function:

```bash
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/health
```

Expected response:
```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Function URL

Your deployed function will be available at:
```
https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475
```

## Environment Variables

Make sure the following environment variables are set in your Supabase project:

1. Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Add any required secrets (AWS keys, Razorpay keys, etc.)

## Troubleshooting

### Error: "Not linked to a Supabase project"
```bash
supabase link --project-ref vpvpbdwtyugbknrntkho
```

### Error: "Function not found"
Make sure the function directory exists:
```bash
ls -la supabase/functions/make-server-3dd53475/
```

### Error: "Deployment failed"
Check the logs:
```bash
supabase functions logs make-server-3dd53475
```

## Deployment Checklist

- [ ] Supabase CLI installed
- [ ] Logged in to Supabase
- [ ] Project linked
- [ ] Function structure created
- [ ] Server files copied
- [ ] Function deployed
- [ ] Health check passed
- [ ] Environment variables set

