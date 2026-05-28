# Secrets Module – AWS Secrets Manager

Payment, Map, and Logistics API credentials. Lambda reads these at runtime; frontend never sees keys.

| Secret name (warmpawz/&lt;env&gt;/…) | Purpose | JSON shape | Terraform |
|--------------------------------------|--------|------------|-----------|
| `razorpay` | Payment (Razorpay) | `{ "key_id": "...", "key_secret": "..." }` | ✅ In module |
| `google-maps` | Map API (Google Maps) | `{ "api_key": "..." }` | ✅ In module |
| `shiprocket` | Logistics (Shiprocket) | `{ "email": "...", "password": "..." }` | ✅ In module |
| `aftership` | Vendor-managed shipping tracking | `{ "api_key": "...", "api_secret": "...", "webhook_secret": "..." }` | ✅ In module (value via CLI/tfvars) |
| `delhivery` | Logistics (Delhivery) | `{ "api_token": "...", "client_name": "..." }` | Create manually or add to module |
| `dunzo` | Logistics (Dunzo) | `{ "client_id": "...", "client_secret": "...", "webhook_secret": "..." }` | Create manually or add to module |

Backend usage: `backend/lambda/src/utils/secrets-manager.ts` → `getSecretJson('<name>')`.  
See **docs/NEXTJS_AWS_SERVERLESS_ARCHITECTURE.md** for full integration.
