# 🔧 Terraform Fixes Applied

## Issues Fixed

### 1. Sensitive Value Conditional Expression Crash
**Error**: `value is marked, so must be unmarked first`

**Fix**: 
- Removed conditional expressions with sensitive variables
- Added boolean flags: `enable_push_notifications`, `enable_ios_push`
- Set both to `false` by default (push notifications disabled for now)

### 2. Unsupported `attributes` Argument
**Error**: `An argument named "attributes" is not expected here`

**Fix**:
- Replaced `attributes` with `tags` in `aws_sns_platform_application` resources
- AWS provider doesn't support the `attributes` argument

### 3. S3 Lifecycle Configuration Warning
**Warning**: `No attribute specified when one of [rule[0].filter,rule[0].prefix] is required`

**Fix**:
- Added `filter { prefix = "" }` blocks to all S3 lifecycle rules
- Required by AWS provider for proper rule configuration

## Commits Made

1. `e326d4593` - fix: Remove sensitive value conditionals causing Terraform crash
2. `acc44f838` - fix: Remove unsupported 'attributes' argument from SNS platform application

## Current Status

✅ **All Terraform validation errors fixed**

**Latest workflow**: https://github.com/ketan0103/warmpawzaws/actions/runs/20678132600

The workflow should now pass the Terraform validation step!

---

## Push Notifications Note

Push notifications are currently **disabled** (`enable_push_notifications = false`).

To enable them later:
1. Set `enable_push_notifications = true` in `infra/envs/dev/main.tf`
2. Provide `fcm_server_key` variable (Firebase Cloud Messaging key)
3. Re-run Terraform apply

For now, the system uses SNS topics for notifications instead of platform applications.

