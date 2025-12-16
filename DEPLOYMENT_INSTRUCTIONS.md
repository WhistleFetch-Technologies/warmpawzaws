# Server Deployment Instructions

## Quick Deploy

The easiest way to deploy is to run the deployment script:

```bash
./deploy-server.sh
```

The script will:
1. Set up the proper directory structure
2. Copy function files
3. Check for authentication
4. Deploy to Supabase

## Manual Deployment

If you prefer to deploy manually:

### Step 1: Login to Supabase

```bash
npx supabase login
```

This will open a browser window for authentication.

### Step 2: Deploy the Function

```bash
npx supabase functions deploy server --project-ref vpvpbdwtyugbknrntkho
```

## Alternative: Using Access Token

If you have a Supabase access token, you can set it as an environment variable:

```bash
export SUPABASE_ACCESS_TOKEN=your_access_token_here
npx supabase functions deploy server --project-ref vpvpbdwtyugbknrntkho
```

## Project Information

- **Project ID**: `vpvpbdwtyugbknrntkho`
- **Function Name**: `server`
- **Function URL**: `https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/server`

## Directory Structure

Supabase expects functions in this structure:
```
supabase/
  functions/
    server/
      index.tsx
      (all other files)
```

The deployment script automatically creates this structure from:
```
src/supabase/functions/server/
```

## Verification

After deployment, you can verify by:

1. **Check Supabase Dashboard**: 
   - Go to https://supabase.com/dashboard/project/vpvpbdwtyugbknrntkho
   - Navigate to Edge Functions
   - Verify "server" function is listed

2. **Test the endpoint**:
   ```bash
   curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/server/health
   ```

## Troubleshooting

### Error: "Access token not provided"
- Run `npx supabase login` first
- Or set `SUPABASE_ACCESS_TOKEN` environment variable

### Error: "Function not found"
- Ensure the directory structure is correct
- Check that `supabase/functions/server/index.tsx` exists

### Error: "Project not found"
- Verify the project-ref is correct: `vpvpbdwtyugbknrntkho`
- Ensure you have access to the project

## Notes

- The function is deployed as a single Edge Function named "server"
- All routes are handled within this single function
- Deployment may take 1-2 minutes
- The function will be available immediately after successful deployment

