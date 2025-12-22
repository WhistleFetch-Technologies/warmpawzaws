# Quick Guide: Populate Problem Grid Mappings

## ✅ Endpoint Ready

The endpoint is registered and ready to use:
- **URL:** `POST /make-server-3dd53475/admin/populate-problem-grid-mappings`
- **Method:** POST
- **Auth:** Requires Service Role Key or Admin access

---

## 🚀 Quick Start

### Option 1: Use the Script (Easiest)

```bash
./scripts/populate-problem-grid-mappings.sh
```

**Prerequisites:**
- Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` or environment

### Option 2: Direct cURL

```bash
curl -X POST \
  "https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/admin/populate-problem-grid-mappings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY"
```

### Option 3: Via Supabase Dashboard

1. Go to **API** → **Edge Functions**
2. Find `make-server-3dd53475`
3. Use the **Invoke** button or test via **API Explorer**

---

## 📋 Prerequisites

1. **Apply Migration First:**
   ```sql
   -- Run in Supabase SQL Editor
   -- db/migrations/010_populate_problem_grid_mappings.sql
   ```

2. **Deploy Functions:**
   ```bash
   supabase functions deploy make-server-3dd53475
   ```

---

## ✅ Expected Response

```json
{
  "success": true,
  "inserted": 150,
  "errors": 0,
  "message": "Problem grid mappings populated: 150 inserted, 0 errors"
}
```

---

## 🔍 Verify After Population

```sql
-- Check total mappings
SELECT COUNT(*) FROM problem_grid_mappings;

-- Check by role
SELECT role_id, COUNT(*) as count
FROM problem_grid_mappings
GROUP BY role_id
ORDER BY role_id;

-- Sample mappings
SELECT problem_id, problem_name, role_id, sub_category_id
FROM problem_grid_mappings
LIMIT 10;
```

---

## 📝 What Gets Populated

- **Veterinary problems** (surgery, dentistry, etc.) → `veterinarian` role
- **Grooming needs** → `groomer` role  
- **Training goals** → `trainer` role
- **Walking needs** → `walker` role
- **Behavioral issues** → `behaviourist` role
- **Boarding needs** → `boarding` role
- **Nutrition needs** → `nutritionist` role

Each problem's `mappedSubCategories` array becomes individual rows.

---

**Ready to populate!** Run the script or call the endpoint directly.

