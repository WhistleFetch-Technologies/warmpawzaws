# Populate Problem Grid Mappings - Direct cURL Command

## Quick Command

Replace `YOUR_PROJECT` and `YOUR_SERVICE_ROLE_KEY` with your actual values:

```bash
curl -X POST \
  "https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/admin/populate-problem-grid-mappings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY"
```

---

## Interactive Script

Or use the interactive script that will prompt for values:

```bash
./scripts/populate-mappings-curl.sh
```

---

## Where to Find Your Values

### 1. Supabase Project URL
- Go to: **Supabase Dashboard** → Your Project
- Copy the **Project URL** from the top
- Format: `https://abcdefghijklmnop.supabase.co`

### 2. Service Role Key
- Go to: **Supabase Dashboard** → **Settings** → **API**
- Find **service_role** key (under "Project API keys")
- Copy the key (starts with `eyJ...`)

---

## Example

```bash
curl -X POST \
  "https://abcdefghijklmnop.supabase.co/functions/v1/make-server-3dd53475/admin/populate-problem-grid-mappings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Expected Response

```json
{
  "success": true,
  "inserted": 150,
  "errors": 0,
  "message": "Problem grid mappings populated: 150 inserted, 0 errors"
}
```

---

## Troubleshooting

### 404 Not Found
- **Solution:** Deploy functions first:
  ```bash
  supabase functions deploy make-server-3dd53475
  ```

### 401/403 Unauthorized
- **Solution:** Use Service Role Key (not anon key)
- **Location:** Dashboard → Settings → API → service_role

### 500 Server Error
- **Solution:** Apply migration first:
  ```sql
  -- Run in Supabase SQL Editor
  -- db/migrations/010_populate_problem_grid_mappings.sql
  ```

---

**Ready to run!** Copy the command above and replace with your values.

