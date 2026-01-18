# Google Maps API Key - AWS Secrets Manager Migration

## Overview

The Google Maps API key has been migrated from the database (`platform_settings` table) to **AWS Secrets Manager** for improved security and compliance.

## Changes Made

### 1. New Secrets Manager Utility (`backend/lambda/src/utils/secrets-manager.ts`)
- Created reusable utility functions for Secrets Manager operations
- Functions: `getSecret()`, `getSecretJson()`, `putSecret()`, `putSecretJson()`
- Follows naming convention: `warmpawz/{stage}/google-maps/api-key`

### 2. Updated Admin Integration Endpoints
- **GET `/admin/integrations/google-maps`**: Now retrieves API key from Secrets Manager
- **PUT `/admin/integrations/google-maps`**: Stores API key in Secrets Manager (enabled status still in DB)
- **GET `/config/google-maps-key`**: Public endpoint retrieves from Secrets Manager

### 3. Updated IAM Permissions
- Added `secretsmanager:PutSecretValue`
- Added `secretsmanager:CreateSecret`
- Added `secretsmanager:DescribeSecret`
- All permissions scoped to: `arn:aws:secretsmanager:ap-south-1:*:secret:warmpawz/dev/*`

### 4. Setup Script
- Created `scripts/setup-google-maps-secret.sh` for easy secret creation/update

## Secret Name Format

```
warmpawz/{stage}/google-maps/api-key
```

Examples:
- Dev: `warmpawz/dev/google-maps/api-key`
- Prod: `warmpawz/prod/google-maps/api-key`

## Setup Instructions

### Option 1: Using the Setup Script (Recommended)

```bash
# Set the API key directly
./scripts/setup-google-maps-secret.sh AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx dev

# Or run interactively (will prompt for API key)
./scripts/setup-google-maps-secret.sh "" dev
```

### Option 2: Using AWS CLI Directly

```bash
# Create the secret
aws secretsmanager create-secret \
  --name "warmpawz/dev/google-maps/api-key" \
  --secret-string "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  --description "Google Maps API Key for Warmpawz dev environment" \
  --region ap-south-1

# Or update existing secret
aws secretsmanager put-secret-value \
  --secret-id "warmpawz/dev/google-maps/api-key" \
  --secret-string "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  --region ap-south-1
```

### Option 3: Using AWS Console

1. Go to AWS Secrets Manager Console
2. Click "Store a new secret"
3. Select "Other type of secret"
4. Choose "Plaintext" and enter your API key
5. Name: `warmpawz/dev/google-maps/api-key`
6. Description: "Google Maps API Key for Warmpawz dev environment"
7. Click "Store"

## Migration from Database

If you have an existing API key in the database, you can migrate it:

```bash
# 1. Get the API key from database (via admin API or direct SQL)
# 2. Store it in Secrets Manager using the setup script
./scripts/setup-google-maps-secret.sh <your-api-key> dev
```

## API Endpoints

### Get Google Maps Config (Admin)
```
GET /admin/integrations/google-maps
Response: {
  "success": true,
  "config": {
    "enabled": true,
    "apiKey": "AIzaSyB..."
  }
}
```

### Update Google Maps Config (Admin)
```
PUT /admin/integrations/google-maps
Body: {
  "apiKey": "AIzaSyB...",
  "enabled": true
}
Response: {
  "success": true,
  "message": "Google Maps configuration updated"
}
```

### Get API Key (Public - Frontend)
```
GET /config/google-maps-key
Response: {
  "apiKey": "AIzaSyB..."
}
```

## Security Benefits

1. **Encryption at Rest**: Secrets Manager encrypts secrets using AWS KMS
2. **Access Control**: IAM policies control who can read/write secrets
3. **Audit Trail**: CloudTrail logs all secret access
4. **Rotation Support**: Can enable automatic secret rotation
5. **No Database Storage**: Sensitive keys no longer stored in database

## Testing

After setting up the secret, test the endpoint:

```bash
curl https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/config/google-maps-key
```

Expected response:
```json
{
  "apiKey": "AIzaSyB..."
}
```

## Troubleshooting

### Error: "Secret not found"
- Ensure the secret name matches: `warmpawz/{stage}/google-maps/api-key`
- Check that the stage matches your environment (dev/prod)

### Error: "Access Denied"
- Verify Lambda IAM role has Secrets Manager permissions
- Check that the secret ARN matches the IAM policy resource pattern

### Error: "Invalid API key format"
- Ensure the API key starts with `AIza`
- Verify it's not a project number (all digits)

## Notes

- The `enabled` status is still stored in the database (non-sensitive)
- Only the API key itself is stored in Secrets Manager
- The secret is automatically retrieved on each request (no caching)
- For production, consider enabling secret rotation
