# AWS Resources – Dev vs Prod (Deployment Map)

**Purpose:** Single reference for where scripts deploy. Use before any deployment to confirm targets.

**Region:** `ap-south-1`

---

## Lambda (Backend API)

| Environment | Function name            | Handler             | Zip structure | Script / override |
|-------------|--------------------------|---------------------|---------------|-------------------|
| **Dev**     | `warmpawz-api-dev-api`   | `dist/handler.handler` | Zip must contain **dist/** folder (e.g. `zip -r api-handler.zip dist`) | `./scripts/deploy-lambda-direct.sh` |
| **Prod**    | `warmpawz-prod-api-handler` | `handler.handler`  | Zip must have **handler.js at root** (e.g. `cd dist && zip -r ../api-handler.zip .`) | Build then: `aws lambda update-function-code --function-name warmpawz-prod-api-handler --zip-file fileb://api-handler.zip --region ap-south-1` |

- **Same code** is deployed to both; zip **layout** differs (Dev expects `dist/handler.js`, Prod expects `handler.js` at root). No vendor fetch or env-specific logic in this fix.
- **One-shot (Dev only):** `./scripts/deploy-lambda-direct.sh` builds and uploads to Dev (uses `npm run package` on Windows for zip; on macOS create zip manually with correct structure per row above).

---

## API Gateway (HTTP API)

| Name               | ApiId     | Endpoint |
|--------------------|-----------|----------|
| warmpawz-dev-api   | z0b3obweb6 | https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com |
| warmpawz-api-dev   | rrg9107m3d | https://rrg9107m3d.execute-api.ap-south-1.amazonaws.com |
| warmpawz-prod-api  | mss9sa4y01 | https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com |

---

## Admin Web (onboarding fix)

| Environment | S3 bucket                              | CloudFront dist ID  | Script |
|-------------|----------------------------------------|----------------------|--------|
| **Dev**     | warmpawz-dev-admin-frontend-ap-south-1  | E1WPXL8WBOWOE8       | `./scripts/deploy-admin-web.sh` |
| **Prod**    | warmpawz-prod-admin-frontend-ap-south-1| E2NHO6UUI5UIHW       | `./scripts/deploy-admin-web.sh --prod --yes` |

- Dev build uses DEV API URL (warmpawz-dev-api). Prod build uses PROD API URL (mss9sa4y01).

---

## Verify with AWS CLI

```bash
# Lambdas
aws lambda list-functions --region ap-south-1 --query "Functions[?contains(FunctionName,'warmpawz')].FunctionName" --output table

# APIs
aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?contains(Name,'warmpawz')].{Name:Name,ApiEndpoint:ApiEndpoint}" --output table

# S3 admin buckets
aws s3 ls | grep admin-frontend
```
