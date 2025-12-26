# 🔄 KV MIGRATION PLAN: auth-service.tsx

**File:** `supabase/functions/make-server-3dd53475/auth-service.tsx`  
**Status:** ⚠️ 21 KV operations found  
**Priority:** P0 (CRITICAL - Blocks NO KV rule)

---

## Current KV Usage

### 1. Session Management (Lines 322-370)
**Current KV Operations:**
- `kv.set(\`session:${sessionId}\`, session)` - Store session
- `kv.set(\`session:user:${userId}\`, sessionId)` - User → session mapping
- `kv.set(\`session:phone:${phone}\`, sessionId)` - Phone → session mapping
- `kv.get(\`session:${sessionId}\`)` - Get session by ID
- `kv.get(\`session:user:${userId}\`)` - Get session by user ID
- `kv.del(\`session:${sessionId}\`)` - Delete session
- `kv.del(\`session:user:${userId}\`)` - Delete user mapping
- `kv.del(\`session:phone:${phone}\`)` - Delete phone mapping

**SQL Replacement:**
- ✅ **Repository:** `supabase/lib/repositories/sessions.ts` - `SessionsRepository`
- ✅ **Table:** `sessions` (already exists)
- ✅ **Methods Available:**
  - `create(input)` - Create session
  - `findById(sessionId)` - Get session by ID
  - `findByUser(userId, userType)` - Get sessions by user
  - `update(sessionId, input)` - Update session
  - `delete(sessionId)` - Delete session

---

### 2. Token Management (Lines 399-447)
**Current KV Operations:**
- `kv.set(\`token:${token}\`, tokenData)` - Store token
- `kv.set(\`token:user:${userId}\`, token)` - User → token mapping
- `kv.get(\`token:${token}\`)` - Get token data
- `kv.del(\`token:${token}\`)` - Delete token
- `kv.del(\`token:user:${userId}\`)` - Delete user mapping

**SQL Replacement:**
- ⚠️ **Table Needed:** `access_tokens` (check if exists)
- ⚠️ **Repository Needed:** Create `access-tokens.ts` repository
- **Schema:**
  ```sql
  CREATE TABLE access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    user_type TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

---

### 3. Admin Profile Management (Lines 739-754)
**Current KV Operations:**
- `kv.get(\`admin:user:${userId}\`)` - Get admin ID by user ID
- `kv.get(\`admin:${adminId}\`)` - Get admin profile
- `kv.set(\`admin:${adminId}\`, profile)` - Store admin profile
- `kv.set(\`admin:user:${userId}\`, adminId)` - User → admin mapping

**SQL Replacement:**
- ⚠️ **Table Needed:** `admin_profiles` (check if exists)
- ⚠️ **Repository Needed:** Create `admin-profiles.ts` repository OR use existing admin table
- **Schema:**
  ```sql
  CREATE TABLE admin_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id TEXT UNIQUE NOT NULL,
    user_id TEXT UNIQUE NOT NULL,
    profile_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

---

## Migration Steps

### Step 1: Verify SQL Tables Exist
- [ ] Check if `sessions` table exists ✅ (confirmed)
- [ ] Check if `access_tokens` table exists
- [ ] Check if `admin_profiles` table exists OR use existing admin table

### Step 2: Create Missing Repositories
- [ ] Create `access-tokens.ts` repository (if table exists)
- [ ] Create `admin-profiles.ts` repository (if table exists)

### Step 3: Migrate Session Management
- [ ] Replace `createSession()` to use `SessionsRepository.create()`
- [ ] Replace `getSession()` to use `SessionsRepository.findById()`
- [ ] Replace `getSessionByUserId()` to use `SessionsRepository.findByUser()`
- [ ] Replace `deleteSession()` to use `SessionsRepository.delete()`

### Step 4: Migrate Token Management
- [ ] Replace `createToken()` to use `AccessTokensRepository.create()`
- [ ] Replace `getToken()` to use `AccessTokensRepository.findByToken()`
- [ ] Replace `deleteToken()` to use `AccessTokensRepository.delete()`

### Step 5: Migrate Admin Profile Management
- [ ] Replace admin profile KV operations with SQL repository calls

### Step 6: Remove KV Import
- [ ] Remove `import * as kv from './kv_store.tsx';`
- [ ] Remove all KV-related code

---

## Functions to Migrate

1. `createSession()` - Lines 300-329
2. `getSession()` - Lines 334-349
3. `getSessionByUserId()` - Lines 354-359
4. `deleteSession()` - Lines 364-375
5. `createToken()` - Lines 390-410
6. `getToken()` - Lines 415-430
7. `deleteToken()` - Lines 433-450
8. `getAdminProfile()` - Lines 735-760

---

## Testing Checklist

- [ ] Session creation works
- [ ] Session retrieval works
- [ ] Session deletion works
- [ ] Token creation works
- [ ] Token retrieval works
- [ ] Token deletion works
- [ ] Admin profile retrieval works
- [ ] No KV imports remain
- [ ] All tests pass

---

**Status:** ⚠️ AWAITING TABLE VERIFICATION

