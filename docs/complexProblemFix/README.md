# Complex Problem Fix – Documentation Index

This folder contains detailed end-to-end documentation for complex fixes. **When something is not working, ask the agent to review these files first** to gain context and knowledge.

## Project rules (do not violate)

1. **Vendor fetch**: Do **not** modify the vendor fetch system. In UAT mode, vendor fetch uses relaxed availability and related checks; in production it is strict. This difference must be preserved.

2. **Lambda behavior**: All Lambda changes must work for **both UAT and production**. The only exception is the vendor fetch logic above.

3. **Deployment**: Before deployment, coordinate with the agent to gather **complete information about AWS resources** for both Dev and Prod (API Gateway URLs, Lambda names, stages, etc.).

4. **Backend sync**: Backend Lambdas for UAT and Dev must stay in sync and behave the same in both environments, except for the vendor fetch differences.

5. **After solving a complex problem**: Add a new `.md` file here with:
   - Problem description  
   - Schema changes (if any)  
   - Lambda updates  
   - Backend code changes  
   - Frontend changes  
   - Implementation flow and final solution  

   The doc must be detailed enough for automated/agent modes to understand and handle it without extra context.

## Documented fixes

| File | Problem | Date |
|------|---------|------|
| [ADMIN_ONBOARDING_FIELD_DELETE_404_FIX.md](./ADMIN_ONBOARDING_FIELD_DELETE_404_FIX.md) | Admin Catalog → Onboarding: delete field returns 404 (DELETE not configured or role not found) | 2026-02 |

---

**Note:** If your working copy uses the path `D:\WFTPL\warmpawzApp\warmpawzaws\complexProblemFix`, you can copy the contents of this folder there to keep historical implementation details in sync.
