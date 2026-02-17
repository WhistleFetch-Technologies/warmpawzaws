# Admin OTP: UAT (dev) vs prod testing

Same rules as Customer and Vendor: **dev uses UAT with OTP 123456**; **prod uses real authentication and real OTP**.

## DB migrations (dev and prod)

Run once per environment (already applied):

```bash
ENVIRONMENT=dev  ./scripts/run-migration-562-563-admin-rbac.sh
ENVIRONMENT=prod ./scripts/run-migration-562-563-admin-rbac.sh
```

- **562**: Creates `admins` table if not exists.
- **563**: Adds `role_type` on roles, `admin_role_id` on admins, admin roles and permissions, and assigns existing admins to super_admin.

## Dev – UAT_MODE and OTP 123456

**Code (backend):** In `backend/lambda/src/endpoints/admin-users.ts`:

```ts
function generateOTP(): string {
  return process.env.UAT_MODE === 'true'
    ? '123456'
    : Math.floor(100000 + Math.random() * 900000).toString();
}
```

- When **Lambda env `UAT_MODE=true`** (dev): every generated OTP is **123456** (no SMS needed for testing).
- When **`UAT_MODE` is not `true`** (prod): OTP is a random 6-digit number and is sent via SMS.

**Confirming dev:** Run:

```bash
./scripts/test-admin-otp-dev.sh
```

This creates an admin user on dev (with UAT token, unique phone per run) and then calls `verify-otp-set-password` with OTP **123456**. If dev Lambda has `UAT_MODE=true` and migrations 562+563 are applied, the verify step succeeds. (If you see 503, retry; if `admins` does not exist, run the migration script above.)

---

## Prod – real OTP (phone 9611377119)

1. **Trigger OTP** to **9611377119** using one of:
   - Admin UI → Role & User Management → Admin users → **Reset password** for the admin that has phone 9611377119, or  
   - **Create user** with that phone (if you have admin JWT), or  
   - Same admin using “Reset password” (self) so OTP is sent to 9611377119.

2. **When you receive the OTP**, run:

```bash
ADMIN_EMAIL=your@email.com OTP=XXXXXX NEW_PASSWORD=YourNewPass123! ./scripts/test-admin-otp-prod.sh
```

- `ADMIN_EMAIL`: email of the admin account that has 9611377119 (and for which you triggered the OTP).  
- `OTP`: 6-digit code you received on 9611377119.  
- `NEW_PASSWORD`: new password (min 8 chars).

Optional: `ADMIN_PHONE=9611377119` (default) or `API_URL=...` if you use a different prod API.

3. Script calls **POST /admin/users/verify-otp-set-password** (public) on prod. On success you can log in with that email and the new password.
