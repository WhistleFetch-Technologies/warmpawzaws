# Official CloudFront URLs (Only These for Web Components)

**These are the only official and permanent CloudFront URLs** for Admin, Vendor, and Customer. Use no other CloudFront URLs for these components.

| Component | Official & permanent CloudFront URL | Distribution ID |
|-----------|-------------------------------------|------------------|
| **Admin** | https://dfof7mguaa0a5.cloudfront.net | E1WPXL8WBOWOE8 |
| **Vendor** | https://d1s6ykkj381k58.cloudfront.net | E95171GX1I6HN |
| **Customer** | https://d2aoyjj8ine0wk.cloudfront.net | E2RDORGXSWJJ87 |

- **Lambda CORS** (`backend/lambda/src/handler/index.ts`): `allowedOrigins` includes only these three CloudFront URLs (plus localhost and optional custom domains).
- **Deploy scripts**:  
  - `scripts/deploy-admin-web.sh` → Admin URL above  
  - `scripts/deploy-vendor-web.sh` → Vendor URL above  
  - `scripts/deploy-customer-web.sh` → Customer URL above  
- **Customer app API**: For UAT (phone-based login), run `USE_SERVERLESS_API=1 ./scripts/deploy-customer-web.sh` to use the serverless API (z0b3obweb6) which supports UAT tokens. The CDK API (rrg9107m3d) uses Cognito-only and returns 401 for UAT.
- **API Gateway CORS**: Run `scripts/fix-cors-api-gateway.sh` to set AllowOrigins to these three (and localhost/custom domains). No other CloudFront origins should be used for these components.
