# P8 — Full-flow testing and release readiness

- **Owner:** Bindu — done 13 Oct 2026
- **Estimate:** 3 days
- **Depends on:** G0 – G7
- **Gate:** G8

## Goal

Prove the whole journey end to end on dev, twice, and prepare a safe production rollout behind flags.

## Tasks

- [ ] Seed fixtures on dev: vendors V1, V2; companies C1, C2 with one published plan each; one customer with a dog and a cat and a complete profile.
- [ ] Run [FF-1 – FF-18](../03-test-gates-and-full-flow.md#full-flow-script-dev-uat-otp-123456) as two passes:
  - Pass A: V1 × C1, weekly window.
  - Pass B: V2 × C2, monthly window, including FF-18 negative paths.
- [ ] Log every defect with the FF step; fix and re-run the affected steps plus FF-15 – FF-17.
- [ ] Regression: WPay Pay Bill payment and a WAppt tele booking on dev unaffected; GST guard CI green and untouched.
- [ ] Prod readiness checklist:
  - Migration order and numbers verified against `develop`; each migration idempotent and Data API safe.
  - Flags `WARMPAWZ_INSURANCE_ENABLED` / `_ADMIN_ENABLED` off on prod.
  - RBAC grants verified for the admin roles that should see the module.
  - Rollback: flags off hides all surfaces; migrations are additive (no rollback SQL needed).
  - Monitoring: CloudWatch error filter for `warmpawz-insurance` routes.
- [ ] PR(s) to `develop` with migration list, dev test evidence, and this checklist.

## Exit (G8)

Both passes green, checklist signed by Abhi, Bindu and product. Production deploy and migrations only on explicit approval.
