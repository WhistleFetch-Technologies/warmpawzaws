# Admin Login "Invalid Credentials" Fix

## Issue
When trying to login to production API Gateway (`mss9sa4y01`) from `localhost:3003`, getting error:
```json
{"error":"Invalid credentials"}
```

## Root Cause
In production mode (UAT_MODE=false), the admin login handler:
1. Checks if admin exists in database with the provided email
2. If admin exists AND has a `password_hash`, it verifies the password
3. If password doesn't match, returns "Invalid credentials" (401)
4. If admin doesn't exist OR has no `password_hash`, login is allowed (Cognito-only path)

The error occurs when:
- Admin exists in database ✅
- Admin has `password_hash` set ✅
- Provided password doesn't match the hash ❌

## Solution

### Option 1: Use Correct Password
Use the correct password for the admin email you're trying to login with.

### Option 2: Create/Update Admin with Known Password
Use the `/admin/setup/create-admin` endpoint to create or update an admin account:

```bash
POST https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/admin/setup/create-admin
Content-Type: application/json

{
  "email": "admin@warmpawz.com",
  "password": "Admin123!",
  "name": "Admin User"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Admin created successfully" or "Admin updated successfully",
  "admin": {
    "id": "...",
    "email": "admin@warmpawz.com",
    "name": "Admin User",
    "role": "admin"
  }
}
```

### Option 3: Use Admin Without Password Hash
If the admin in the database has no `password_hash`, any password will work (password verification is skipped). This is the "Cognito-only" authentication path.

## Test Credentials Created
- **Email:** `admin@warmpawz.com`
- **Password:** `Admin123!`

## How It Works

### Production Mode (UAT_MODE=false)
1. Check if admin exists in database
2. If exists and has `password_hash`:
   - Verify password using bcrypt
   - If match: Generate JWT tokens (Cognito not configured, so fallback to JWT)
   - If no match: Return "Invalid credentials" (401)
3. If exists but no `password_hash`:
   - Skip password verification
   - Generate JWT tokens
4. If doesn't exist:
   - Create virtual admin
   - Generate JWT tokens

### Development Mode (UAT_MODE=true)
- Any email/password combination works
- Generates UAT JWT tokens with 60s expiry

## Lambda Environment Variables
- `UAT_MODE`: `false` (production)
- `COGNITO_USER_POOL_ID`: `null` (not configured)
- `COGNITO_CLIENT_ID`: `null` (not configured)

Since Cognito is not configured, the Lambda falls back to JWT token generation.

## Date Fixed
2026-02-16
