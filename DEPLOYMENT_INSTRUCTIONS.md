# Deployment Instructions

## ✅ Database Migrations Applied

The following migrations have been successfully applied to Supabase:

1. **`create_returns_table`** - Returns table for e-commerce order returns
2. **`create_vendor_specialized_config_tables`** - Tables for:
   - Ambulance vehicles
   - Diagnostic tests catalog
   - Meal plans (nutritionist)
   - Boarding facilities config

## 🚀 Backend Deployment (Supabase Edge Functions)

### Option 1: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase --prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH

# Or use npx (no global install needed)
npx supabase functions deploy make-server-3dd53475 \
  --project-ref vpvpbdwtyugbknrntkho \
  --no-verify-jwt
```

### Option 2: Using Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/vpvpbdwtyugbknrntkho
2. Navigate to Edge Functions
3. Select `make-server-3dd53475`
4. Upload the function files from `supabase/functions/make-server-3dd53475/`

### Option 3: Using MCP Supabase Tools

The migrations have been applied via MCP. For function deployment, use the Supabase CLI or Dashboard.

## 📱 Frontend Setup (Local Development)

### Customer App

```bash
cd apps/WarmpawzCustomer

# Install dependencies
npm install

# Start Metro bundler
npm start

# Run on iOS (requires Xcode)
npm run ios

# Run on Android (requires Android Studio)
npm run android
```

### Vendor App

```bash
cd apps/WarmpawzVendor

# Install dependencies
npm install

# Start Metro bundler
npm start

# Run on iOS (requires Xcode)
npm run ios

# Run on Android (requires Android Studio)
npm run android
```

## 🔑 Environment Variables

Make sure both frontend apps have the correct Supabase configuration in:
- `apps/WarmpawzCustomer/src/config/supabase.ts`
- `apps/WarmpawzVendor/src/config/supabase.ts`

The Supabase project URL is: `https://vpvpbdwtyugbknrntkho.supabase.co`

## 📝 Recent Changes Deployed

1. **E-commerce Routes Migration** - All KV operations migrated to SQL
2. **Specialized Vendor Config** - All vendor-specific configurations migrated to SQL
3. **Returns Management** - New returns table and repository
4. **Vendor Specialized Tables** - Ambulance, diagnostics, meal plans, boarding facilities

## ✅ Verification

After deployment, verify:
1. Database migrations are applied (check Supabase Dashboard → Database → Migrations)
2. Edge Functions are active (check Supabase Dashboard → Edge Functions)
3. Frontend apps can connect to Supabase (check network requests in Metro bundler)
