# Vendor Onboarding - Quick Start Guide

## 🚀 Implementation Summary

A complete, database-driven vendor onboarding system with:
- ✅ State machine with 8 states
- ✅ Dynamic role-based forms
- ✅ Admin approval workflow
- ✅ Post-activation setup tracking
- ✅ Full audit trail

---

## 📋 Files Created/Modified

### Database
1. **`db/migrations/049_vendor_onboarding_state_machine.sql`**
   - Core tables: `vendor_identity`, `vendor_onboarding_applications`, `vendor_onboarding_transitions`, `vendor_setup_completion`
   - State machine functions
   - Indexes and constraints

2. **`db/migrations/050_seed_onboarding_role_configs.sql`**
   - Role configuration examples with `onboardingFormSchema`

### Backend
3. **`backend/lambda/src/endpoints/vendor-onboarding.ts`**
   - All API endpoints for onboarding flow
   - Already registered in `handler/index.ts`

### Frontend
4. **`apps/vendor-web/app/onboarding/route-map.ts`**
   - Route mapping and guards
   - Status-based routing

### Documentation
5. **`docs/VENDOR_ONBOARDING_COMPLETE_IMPLEMENTATION.md`**
   - Complete specification
   - API contracts
   - Role configuration examples
   - Edge cases

---

## 🔧 Setup Steps

### 1. Run Database Migrations

```bash
cd db
npm run migrate:up
```

This creates:
- `vendor_identity` table
- `vendor_onboarding_applications` table
- `vendor_onboarding_transitions` table (audit trail)
- `vendor_setup_completion` table
- State machine functions

### 2. Verify API Endpoints

Endpoints are already registered. Test with:

```bash
# Get onboarding status
curl "https://dev.api.warmpawz.com/vendor/onboarding/status?phone=+919876543210"

# Get available roles
curl "https://dev.api.warmpawz.com/vendor/onboarding/roles"
```

### 3. Update Role Configurations

Ensure all roles have `onboardingFormSchema` in their `config` JSONB:

```sql
-- Check role configs
SELECT name, config->'onboardingFormSchema' as form_schema
FROM roles
WHERE is_active = true;

-- Update if needed (see migration 050 for examples)
```

### 4. Implement Frontend Routes

Create route components in `apps/vendor-web/app/onboarding/`:

- `role-selection/page.tsx` - Role selection UI
- `vendor-type/page.tsx` - Solo/Business selection
- `form/page.tsx` - Dynamic form renderer
- `pending-review/page.tsx` - Waiting screen
- `clarification/page.tsx` - Admin comments view
- `approved/page.tsx` - Success screen
- `rejected/page.tsx` - Rejection screen

### 5. Add Route Guards

Use `route-map.ts` to guard routes:

```typescript
import { getRouteForStatus, isRouteAllowed } from '@/app/onboarding/route-map';

// On page load
const { onboarding_status } = await getOnboardingStatus(phone);
if (!isRouteAllowed(currentRoute, onboarding_status)) {
  router.push(getRouteForStatus(onboarding_status));
}
```

---

## 📊 State Flow

```
INIT → ROLE_PENDING → FORM_PENDING → UNDER_REVIEW
                                         ↓
                    ┌────────────────────┼────────────────────┐
                    ↓                    ↓                    ↓
              APPROVED      CLARIFICATION_REQUIRED      REJECTED
                    ↓                    ↓                    ↓
              ACTIVATED            UNDER_REVIEW         ROLE_PENDING
```

---

## 🔑 Key API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/vendor/onboarding/status` | GET | Get current status |
| `/vendor/onboarding/roles` | GET | List available roles |
| `/vendor/onboarding/select-role` | POST | Select role |
| `/vendor/onboarding/select-vendor-type` | POST | Select solo/business |
| `/vendor/onboarding/form-schema` | GET | Get dynamic form schema |
| `/vendor/onboarding/submit-application` | POST | Submit application |
| `/admin/vendor/onboarding/:id/review` | POST | Admin review |
| `/vendor/onboarding/activate` | POST | Activate vendor |
| `/vendor/setup/update-completion` | POST | Update setup step |
| `/vendor/setup/go-live` | POST | Go live |

---

## 🎯 Role Configuration Structure

```json
{
  "vendorTypes": ["solo", "business"],
  "capabilities": ["manage_bookings", "manage_staff"],
  "serviceCatalogMapping": ["grooming_basic", "grooming_premium"],
  "onboardingFormSchema": {
    "solo": {
      "version": "1.0",
      "fields": [...]
    },
    "business": {
      "version": "1.0",
      "fields": [...]
    }
  }
}
```

---

## ✅ Production Checklist

- [ ] Migrations applied
- [ ] Role configs populated
- [ ] API endpoints tested
- [ ] Frontend routes implemented
- [ ] Route guards added
- [ ] State recovery on refresh
- [ ] Error handling
- [ ] Admin review UI
- [ ] File upload working
- [ ] Notifications configured

---

## 🐛 Troubleshooting

### Issue: State transition fails
**Solution:** Check `vendor_onboarding_transitions` table for audit trail. Use `validate_onboarding_transition()` function.

### Issue: Form schema not found
**Solution:** Verify `roles.config->'onboardingFormSchema'` exists for role + vendor_type.

### Issue: Application locked
**Solution:** Check `vendor_onboarding_applications.is_locked`. Only editable if `status = 'CLARIFICATION_REQUIRED'`.

### Issue: Page refresh loses state
**Solution:** Call `GET /vendor/onboarding/status` on page load and redirect to `nextStep`.

---

## 📚 Next Steps

1. **Implement Dynamic Form Renderer**
   - Parse JSON schema
   - Render fields (text, select, file, etc.)
   - Validate inputs
   - Handle file uploads

2. **Build Admin Review Interface**
   - List pending applications
   - Review form data
   - Add comments
   - Approve/Reject/Request Clarification

3. **Add Notifications**
   - Email/SMS on status changes
   - Admin notification on new applications
   - Vendor notification on approval/rejection

4. **Post-Activation Setup**
   - Profile completion
   - Bank details
   - Business hours
   - Staff management
   - Service configuration

---

## 📞 Support

- **Database Schema:** See `049_vendor_onboarding_state_machine.sql`
- **API Reference:** See `VENDOR_ONBOARDING_COMPLETE_IMPLEMENTATION.md`
- **Role Configs:** See `050_seed_onboarding_role_configs.sql`

---

**Status:** ✅ Database & API Complete | 🚧 Frontend Implementation Pending

