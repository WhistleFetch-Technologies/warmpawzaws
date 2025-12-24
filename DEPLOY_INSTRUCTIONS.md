# Service Catalog Deployment Instructions

## Step 1: Login to Supabase

You need to login to Supabase first. Run this in your terminal:

```bash
npx supabase login
```

This will open a browser window for authentication.

## Step 2: Deploy the Function

After logging in, run:

```bash
npx supabase functions deploy make-server-3dd53475 --no-verify-jwt
```

## Alternative: Use Access Token

If you prefer to use an access token instead:

1. Get your access token from: https://supabase.com/dashboard/account/tokens
2. Set it as an environment variable:
   ```bash
   export SUPABASE_ACCESS_TOKEN=your_token_here
   ```
3. Then deploy:
   ```bash
   npx supabase functions deploy make-server-3dd53475 --no-verify-jwt
   ```

## Step 3: Verify Deployment

After deployment, test the health endpoint:

```bash
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/health
```

## Step 4: Test Service Catalog Endpoints

### Test Seed Preview (No changes made):
```bash
curl -X POST https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/seed-all-services \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"confirm": false}'
```

### Test Price Update Preview:
```bash
curl -X POST https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/update-realistic-prices \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"confirm": false}'
```

## Expected Results

After successful deployment:
- ✅ Function deployed to Supabase
- ✅ Endpoints accessible
- ✅ Preview mode works (returns preview without making changes)
- ✅ Ready to seed services via UI or API

## Troubleshooting

If deployment fails:
1. Make sure you're logged in: `npx supabase login`
2. Check project is linked: `npx supabase projects list`
3. Verify function directory exists: `ls -la supabase/functions/make-server-3dd53475/`
4. Check logs: `npx supabase functions logs make-server-3dd53475`
