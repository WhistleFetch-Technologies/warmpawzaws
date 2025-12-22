# Server Deployment Instructions

## Quick Start

### Step 1: Login to Supabase
```bash
npx supabase login
```
This will open a browser window for you to authenticate.

### Step 2: Deploy
```bash
./quick-deploy.sh
```

Or manually:
```bash
npx supabase functions deploy make-server-3dd53475 --no-verify-jwt
```

## Manual Deployment Steps

### 1. Prepare Function Structure
The function structure is already prepared in:
```
supabase/functions/make-server-3dd53475/
```

### 2. Link Project (if not already linked)
```bash
npx supabase link --project-ref vpvpbdwtyugbknrntkho
```

### 3. Login (if not already logged in)
```bash
npx supabase login
```

### 4. Deploy Function
```bash
npx supabase functions deploy make-server-3dd53475 --no-verify-jwt
```

## Verify Deployment

After deployment, test the health endpoint:
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

## Function Endpoints

Once deployed, your function will be available at:
```
https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475
```

All API endpoints will be prefixed with this base URL, for example:
- Health: `/make-server-3dd53475/health`
- Customer Services: `/make-server-3dd53475/customer/services`
- Bookings: `/make-server-3dd53475/bookings/create`
- etc.

## Troubleshooting

### "Access token not provided"
Run: `npx supabase login`

### "Project not linked"
Run: `npx supabase link --project-ref vpvpbdwtyugbknrntkho`

### "Function not found"
Make sure the function directory exists:
```bash
ls -la supabase/functions/make-server-3dd53475/
```

If it doesn't exist, copy the files:
```bash
mkdir -p supabase/functions/make-server-3dd53475
cp -r src/supabase/functions/server/* supabase/functions/make-server-3dd53475/
```

### View Deployment Logs
```bash
npx supabase functions logs make-server-3dd53475
```

## Environment Variables

If your function needs environment variables or secrets:
1. Go to Supabase Dashboard
2. Navigate to: Project Settings → Edge Functions → Secrets
3. Add your secrets (AWS keys, Razorpay keys, etc.)

## Next Steps After Deployment

1. ✅ Verify health endpoint works
2. ✅ Test a sample API call (e.g., list services)
3. ✅ Check function logs for any errors
4. ✅ Update frontend to use the deployed function URL

