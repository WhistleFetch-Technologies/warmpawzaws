# @warmpawz/api-config

Single source for **API base URL** and **endpoint path constants** in the warmpawzecodev repo.

- **Backend**: `backend/lambda` (deployed to API Gateway).
- **Apps**: `apps/admin-web`, `apps/vendor-web`, `apps/customer-web`, `apps/WarmpawzVendor`, `apps/WarmpawzCustomer`, and the Vite app in `Warmpawz Ecosystem Development` should all point to the same base URL and use these paths.

## Usage

```ts
import { getApiBaseUrl, ENDPOINTS } from '@warmpawz/api-config';

const base = getApiBaseUrl();
const url = `${base}${ENDPOINTS.CONFIG_ROLES}`;
// or: ENDPOINTS.CONFIG_ROLE('veterinarian')
```

## Env (per app)

- Next.js: `NEXT_PUBLIC_API_BASE_URL`
- Vite: `VITE_API_BASE_URL`
- RN: `AWS_API_GATEWAY_URL` (see `apps/WarmpawzVendor/src/config/aws.ts`)

See **docs/REPO_STRUCTURE_AND_ENDPOINTS.md** for full structure and E2E verification.
