# Function URLs Reference

## ✅ Correct URL Format

All Edge Functions use this base URL format:
```
https://{project-ref}.supabase.co/functions/v1/{function-name}/{endpoint}
```

## 📍 Available Functions

### All Functions Status: ✅ Working (HTTP 200)

| Function | Health Endpoint | Status |
|----------|----------------|--------|
| `make-server-core` | `/functions/v1/make-server-core/health` | ✅ HTTP 200 |
| `make-server-admin` | `/functions/v1/make-server-admin/health` | ✅ HTTP 200 |
| `make-server-vendor` | `/functions/v1/make-server-vendor/health` | ✅ HTTP 200 |
| `make-server-customer` | `/functions/v1/make-server-customer/health` | ✅ HTTP 200 |
| `make-server-booking` | `/functions/v1/make-server-booking/health` | ✅ HTTP 200 |
| `make-server-payment` | `/functions/v1/make-server-payment/health` | ✅ HTTP 200 |
| `make-server-canary` | `/functions/v1/make-server-canary/health` | ✅ HTTP 200 |

## 🔗 Full URLs (Project: vpvpbdwtyugbknrntkho)

### Core Function (Auth, Regions)
```bash
# Health Check
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-core/health

# Regions
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-core/regions/active
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-core/regions/india

# Auth
curl -X POST https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-core/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919999999999"}'
```

### Admin Function
```bash
# Health Check
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-admin/health

# Admin Endpoints
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-admin/admin/vendors
```

### Vendor Function
```bash
# Health Check
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-vendor/health

# Vendor Endpoints
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-vendor/vendor/dashboard
```

### Customer Function
```bash
# Health Check
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-customer/health

# Customer Endpoints
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-customer/customer/services
```

### Booking Function
```bash
# Health Check
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-booking/health

# Booking Endpoints
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-booking/bookings
```

### Payment Function
```bash
# Health Check
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-payment/health

# Payment Endpoints
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-payment/payments
```

### Canary Function (Test)
```bash
# Health Check
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-canary/health
```

## ❌ Common Mistakes

### Wrong Domain Format
```bash
# ❌ WRONG
https://vpvpbdwtyugbknrntkho.functions.supabase.co/canary/health

# ✅ CORRECT
https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-canary/health
```

### Missing `/v1/` Path
```bash
# ❌ WRONG
https://vpvpbdwtyugbknrntkho.supabase.co/functions

# ✅ CORRECT
https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/{function-name}/health
```

### Missing Function Name
```bash
# ❌ WRONG
https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/health

# ✅ CORRECT
https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-core/health
```

## 🧪 Quick Test Script

```bash
#!/bin/bash
PROJECT_REF="vpvpbdwtyugbknrntkho"
BASE_URL="https://${PROJECT_REF}.supabase.co/functions/v1"

for func in make-server-core make-server-admin make-server-vendor \
            make-server-customer make-server-booking make-server-payment \
            make-server-canary; do
  echo "Testing $func..."
  curl -s "${BASE_URL}/${func}/health" | jq '.status' || echo "Failed"
done
```

## 📝 CORS Preflight (OPTIONS)

All functions support OPTIONS requests:

```bash
curl -X OPTIONS https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-core/health \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET"
```

Expected: HTTP 204 with CORS headers

