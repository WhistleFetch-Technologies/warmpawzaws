# UAT Mode Token Expiry & State Persistence Fix

## Summary
Implemented 60-second JWT token expiry in UAT mode for customer, vendor, and admin users, and ensured all state is persisted in the database on login.

## Changes Made

### 1. Token Expiry - 60 Seconds in UAT Mode ✅

#### Customer & Vendor Auth (`auth-enhanced.ts`)
- **File**: `backend/lambda/src/endpoints/auth-enhanced.ts`
- **Change**: Updated UAT mode token expiry from 86400 seconds (24 hours) to 60 seconds
- **Line**: 356
- **Code**:
  ```typescript
  expiresIn: 60, // 60 seconds for UAT mode testing
  ```

#### Admin Auth (`admin-comprehensive.ts`)
- **File**: `backend/lambda/src/endpoints/admin-comprehensive.ts`
- **Change**: Added token expiry structure with 60 seconds for UAT mode
- **Lines**: 204-214
- **Code**:
  ```typescript
  token: {
    access_token: `uat-token-admin-${Date.now()}`,
    expires_in: 60, // 60 seconds for UAT mode testing
    token_type: 'Bearer',
  }
  ```

### 2. State Persistence - last_login_at Updates ✅

#### Customer Login
- **File**: `backend/lambda/src/endpoints/auth-enhanced.ts`
- **Change**: Updates `last_login_at` timestamp in `customers` table on login
- **Lines**: 283-287
- **Code**:
  ```typescript
  await update('customers', { id: userId }, { 
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  ```

#### Vendor Login
- **File**: `backend/lambda/src/endpoints/auth-enhanced.ts`
- **Change**: Updates `last_login_at` timestamp in `vendors` table on login
- **Lines**: 320-324
- **Code**:
  ```typescript
  await update('vendors', { id: userId }, { 
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  ```

#### Admin Login
- **File**: `backend/lambda/src/endpoints/admin-comprehensive.ts`
- **Change**: Updates `last_login_at` timestamp in `admins` table on login
- **Lines**: 227-231
- **Code**:
  ```typescript
  await update('admins', { id: admin.id }, { 
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  ```

### 3. Admin Role Support in OTP Auth ✅

- **File**: `backend/lambda/src/endpoints/auth-enhanced.ts`
- **Change**: Added admin role handling in OTP verification endpoint
- **Lines**: 340-352
- **Code**: Added `else if (role === 'admin')` block to handle admin login via OTP

## Database Schema Requirements

### Tables with last_login_at Column:
1. ✅ `customers` - Has `last_login_at TIMESTAMPTZ` column
2. ⚠️ `vendors` - **NEEDS** `last_login_at TIMESTAMPTZ` column (may need migration)
3. ⚠️ `admins` - **NEEDS** `last_login_at TIMESTAMPTZ` column (may need migration)

### Migration Needed:
If `vendors` and `admins` tables don't have `last_login_at` column, run:
```sql
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
```

## Testing

### UAT Mode Token Expiry Test:
1. Set `UAT_MODE=true` or `NODE_ENV=development`
2. Login as customer/vendor/admin
3. Token should expire in 60 seconds
4. Verify token expiry by checking `expires_in` field in response

### State Persistence Test:
1. Login as customer/vendor/admin
2. Check database - `last_login_at` should be updated
3. Logout and login again
4. Verify `last_login_at` is updated with new timestamp
5. All user state should persist in database

## Files Modified

1. `backend/lambda/src/endpoints/auth-enhanced.ts`
   - Token expiry: 60 seconds in UAT mode
   - Customer last_login_at update
   - Vendor last_login_at update
   - Admin role support

2. `backend/lambda/src/endpoints/admin-comprehensive.ts`
   - Admin token expiry: 60 seconds in UAT mode
   - Admin last_login_at update

## Notes

- In production mode, tokens use Cognito's default expiry (typically 1 hour)
- UAT mode tokens are temporary and skip Cognito authentication
- All login state is now persisted in database for recovery
- `last_login_at` helps track user activity and session management
