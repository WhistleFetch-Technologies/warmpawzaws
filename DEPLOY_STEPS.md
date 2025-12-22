# Server Deployment Steps

## ✅ Step 1: Login to Supabase (Required)

Open a terminal and run:
```bash
npx supabase login
```

This will open a browser window for you to authenticate with Supabase.

## ✅ Step 2: Deploy the Server

After logging in, run:
```bash
./deploy-now.sh
```

Or manually:
```bash
npx supabase functions deploy make-server-3dd53475 --no-verify-jwt
```

## ✅ Step 3: Verify Deployment

Test the health endpoint:
```bash
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/health
```

Expected response:
```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2024-12-22T..."
}
```

## 📝 Function URL

Your deployed server will be available at:
```
https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475
```

## 📊 View Logs

To check deployment logs:
```bash
npx supabase functions logs make-server-3dd53475
```

## 🔧 Troubleshooting

### If deployment fails:
1. Make sure you're logged in: `npx supabase login`
2. Check project is linked: `npx supabase projects list`
3. Verify function directory exists: `ls -la supabase/functions/make-server-3dd53475/`

### If you need to re-link:
```bash
npx supabase link --project-ref vpvpbdwtyugbknrntkho
```

