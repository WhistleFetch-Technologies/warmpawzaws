# Forensic Test Results: /config/roles API

**Date:** 2026-02-02  
**Script:** `scripts/forensic-test-config-roles.sh`  
**API Base:** `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`

---

## Deployment

| Step | Script | Status |
|------|--------|--------|
| Backend (Lambda + CDK) | `./scripts/deploy-cdk.sh dev` | ✅ Completed |
| Vendor-web (S3 + CloudFront) | `./scripts/deploy-vendor-web.sh` | ✅ Completed |

---

## Systematic Forensic Tests

| # | Test | Result |
|---|------|--------|
| 1 | GET /config/roles returns 200 | ✅ PASS |
| 2 | GET /config/roles returns roles array | ✅ PASS |
| 3 | GET /config/roles returns total | ✅ PASS |
| 4 | GET /config/roles/:id (valid UUID from list) returns 200 | ✅ PASS |
| 5 | GET /config/roles/:id returns capabilities array | ✅ PASS |
| 6 | GET /config/roles/:id returns roleId | ✅ PASS |
| 7 | GET /config/roles/groomer_solo (by name) returns 200 | ✅ PASS |
| 8 | GET /config/roles/groomer_solo returns capabilities | ✅ PASS |
| 9 | GET /config/roles/00000000-0000-0000-0000-000000000000 returns 404 | ✅ PASS |
| 10 | GET /config/roles/nonexistent_role_xyz returns 404 | ✅ PASS |
| 11 | GET /config/roles/{uuid} (braces normalization) returns 200 | ✅ PASS |

**Summary:** PASS: 11, FAIL: 0

---

## Contract Validation

- **List:** GET /config/roles returns 200 with `success`, `roles` array, and `total` (DB-backed).
- **By ID (UUID):** GET /config/roles/:id returns 200 with `success`, `capabilities` array, and `roleId` when the role exists and is active.
- **By name:** GET /config/roles/groomer_solo returns 200 with capabilities (name fallback from DB).
- **Not found:** Invalid UUID and nonexistent role name return 404 with "Role not found".
- **Normalization:** Path param with `{uuid}` braces is normalized and returns 200 for a valid role.

---

## Re-run

```bash
./scripts/forensic-test-config-roles.sh
# Or with explicit API base:
./scripts/forensic-test-config-roles.sh https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com
```
