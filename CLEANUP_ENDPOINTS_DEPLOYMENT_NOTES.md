# 🚀 Cleanup Endpoints - Deployment Notes

## Status

✅ **Endpoints Created:** Cleanup endpoints have been added to `marketing-routes-v2.tsx`

⚠️ **Deployment Required:** The endpoints need to be deployed to the server before they can be used.

## Endpoints Added

1. `POST /admin/cleanup/find-duplicates` - Find duplicate promotions and coupons
2. `POST /admin/cleanup/remove-duplicates` - Remove duplicates (with dry-run mode)

## Route Registration

The endpoints are registered under the marketing routes at:
- Base path: `/make-server-3dd53475/marketing`
- Full paths:
  - `/make-server-3dd53475/marketing/admin/cleanup/find-duplicates`
  - `/make-server-3dd53475/marketing/admin/cleanup/remove-duplicates`

## Deployment Steps

1. **Deploy the server:**
   ```bash
   ./deploy-server.sh
   ```

2. **Verify deployment:**
   ```bash
   ./test-cleanup-duplicates.sh
   ```

3. **Test the endpoints:**
   ```bash
   # Find duplicates
   curl -X POST "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/marketing/admin/cleanup/find-duplicates" \
     -H "apikey: YOUR_API_KEY" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json"
   ```

## Files Modified

- `src/supabase/functions/server/marketing-routes-v2.tsx` - Added cleanup endpoints

## Testing

After deployment, run:
```bash
./test-cleanup-duplicates.sh
```

The test script will:
1. ✅ Find duplicates (read-only, safe)
2. ✅ Test dry-run mode (safe preview)
3. ⚠️ Ask for confirmation before actual removal

## Troubleshooting

### "Not Found" Error

If you see "Not Found" errors:
1. Verify the server has been deployed
2. Check that the routes are registered correctly in `index.tsx`
3. Verify the endpoint path includes `/marketing` prefix

### Route Not Accessible

If routes are not accessible:
1. Check server logs for registration messages
2. Verify `marketing-routes-v2.tsx` is properly exported
3. Ensure the server was restarted after deployment

## Next Steps

1. Deploy the server with the new endpoints
2. Test the endpoints using the test script
3. Review the dry-run results before actual removal
4. Use the cleanup endpoints to maintain data quality

---

**Created:** 2024-01-15  
**Status:** Ready for Deployment


