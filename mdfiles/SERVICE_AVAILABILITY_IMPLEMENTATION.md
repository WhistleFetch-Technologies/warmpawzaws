# Service Availability Implementation - Complete

## Overview
Implemented a functional gateway system that controls service availability based on:
1. Dashboard UI config (button enabled/disabled, launch phase)
2. Role config (service types/styles allowed)
3. Service enabled status

## What Was Implemented

### 1. Backend Validation (`backend/lambda/src/utils/service-availability-validator.ts`)
- Validates service availability before booking creation
- Checks Dashboard UI config for button enabled status
- Validates launch phase (coming_soon, beta, full)
- Checks role-based service type/style restrictions
- Supports gradual rollout (percentage-based)

### 2. Booking Endpoint Integration (`backend/lambda/src/endpoints/bookings-enhanced.ts`)
- Added service availability validation before booking creation
- Extracts vendor role from vendorId
- Returns appropriate error codes:
  - `UI_DISABLED`: Button disabled in Dashboard UI config
  - `PHASE_RESTRICTED`: Service in coming_soon or rollout phase
  - `ROLE_RESTRICTED`: Service type/style not allowed for role
  - `SERVICE_DISABLED`: Service is_enabled = false

### 3. Admin UI Enhancement (`apps/admin-web/app/marketing/page.tsx`)
- Added Launch Phase selector (Coming Soon, Beta, Full Launch)
- Added Rollout Percentage input (0-100)
- Shows warnings for restricted phases
- Displays serviceId if configured

## Configuration Schema

### Dashboard UI Config Structure
```json
{
  "buttons": [
    {
      "id": "vet_consultation",
      "label": "Book Consultation",
      "icon": "🩺",
      "enabled": true,
      "serviceId": "service-uuid-123",
      "serviceType": "veterinary",
      "launchPhase": "full",
      "requiredRoleTypes": ["healthcare_provider"],
      "allowedServiceStyles": ["at_home", "at_clinic", "tele"],
      "rolloutPercentage": 100
    }
  ]
}
```

### Launch Phases
- **coming_soon**: Service blocked from booking (button can be visible but disabled)
- **beta**: Service available for beta users (can add whitelist later)
- **full**: Service fully available

### Rollout Percentage
- 0-100: Gradual rollout based on customer ID hash
- 100: Full availability
- < 100: Only customers in rollout percentage can book

## Testing Checklist

### 1. Backend Validation Tests
- [ ] Test with disabled button (enabled: false) - should block booking
- [ ] Test with coming_soon phase - should block booking
- [ ] Test with beta phase - should allow booking
- [ ] Test with rollout < 100% - should allow/block based on customer hash
- [ ] Test with role restrictions - should block if service type/style not allowed
- [ ] Test with service is_enabled = false - should block booking
- [ ] Test with no config (backward compatibility) - should allow booking

### 2. Admin UI Tests
- [ ] Load Dashboard UI config for a role
- [ ] Toggle button enabled/disabled
- [ ] Change launch phase
- [ ] Set rollout percentage
- [ ] Save configuration
- [ ] Verify changes persist

### 3. Integration Tests
- [ ] Create booking with enabled service - should succeed
- [ ] Create booking with disabled service - should fail with 403
- [ ] Create booking with coming_soon phase - should fail with 403
- [ ] Create booking with role mismatch - should fail with 403
- [ ] Verify error messages are clear

### 4. Edge Cases
- [ ] Test with missing roleId - should allow (backward compatibility)
- [ ] Test with invalid serviceId - should fail with 404
- [ ] Test with missing Dashboard config - should allow (backward compatibility)
- [ ] Test with malformed config - should allow (fail open)

## Deployment Steps

1. **Build Backend**
   ```bash
   cd backend/lambda
   npm run build
   ```

2. **Deploy Lambda**
   ```bash
   # Use your deployment script
   ./scripts/deploy-lambda-direct.sh
   ```

3. **Build Admin Web**
   ```bash
   cd apps/admin-web
   npm run build
   ```

4. **Deploy Admin Web**
   ```bash
   ./scripts/deploy-admin-web.sh
   ```

## Post-Deployment Testing

1. **Verify Backend Validation**
   - Create a test booking with disabled service
   - Verify 403 error with appropriate message

2. **Verify Admin UI**
   - Navigate to Marketing > Dashboard UI tab
   - Configure a service with coming_soon phase
   - Verify warning message appears
   - Save and verify persistence

3. **Verify End-to-End**
   - Disable a service button in admin UI
   - Try to create booking via API
   - Verify booking is blocked
   - Re-enable service
   - Verify booking succeeds

## Rollback Plan

If issues occur:
1. The validator fails open (allows booking on error) for backward compatibility
2. Can disable validation by commenting out the validation call in bookings-enhanced.ts
3. Admin UI changes are non-breaking (new fields are optional)

## Notes

- Backward compatibility: System allows bookings if validation fails (fail open)
- Can change to fail closed by modifying error handling in validator
- Beta user whitelist can be added later if needed
- Rollout percentage uses deterministic hash for consistent customer experience
