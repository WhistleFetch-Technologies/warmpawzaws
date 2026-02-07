# Architecture Decision: Remove Lambda Alias Management from Terraform

## Date
2026-01-05

## Status
**IMPLEMENTED** - Lambda aliases removed from Terraform management

## Context

After 157+ failed deployment attempts, we identified that managing Lambda aliases in Terraform caused:

1. **ResourceConflictException** - Every deployment failed trying to recreate existing aliases
2. **Non-idempotent deployments** - `terraform apply` could not be run multiple times safely
3. **State drift** - Terraform state became inconsistent with AWS reality
4. **Complex import logic** - Required increasingly complex workarounds that still failed

### Root Cause Analysis

```terraform
# PROBLEM: This resource tried to CREATE an alias on every apply
resource "aws_lambda_alias" "live" {
  name             = "live"
  function_name    = aws_lambda_function.functions[each.key].function_name
  function_version = aws_lambda_function.functions[each.key].version
  
  lifecycle {
    ignore_changes = all  # Even this didn't fix the issue
  }
}
```

**Why it failed:**
- Lambda aliases are **stable resources** (name never changes)
- Terraform tried to CREATE, not UPDATE
- Import logic became increasingly complex but still failed
- The alias was **not actually needed** for API Gateway integration

### API Gateway Discovery

Investigation revealed API Gateway does NOT require Lambda aliases:

```terraform
# infra/modules/api-gateway/main.tf line 104
resource "aws_lambda_permission" "api_gateway" {
  function_name = each.value.function_name  # ← Uses function name directly
  # NOT using alias!
}

# infra/modules/api-gateway/main.tf line 90
resource "aws_apigatewayv2_integration" "lambda" {
  integration_uri = each.value.invoke_arn  # ← Uses invoke ARN directly
  # NOT using alias ARN!
}
```

**Conclusion:** Lambda aliases were adding complexity without providing value.

## Decision

**Remove Lambda alias management from Terraform entirely.**

### What Changed

1. **Removed resources:**
   - `aws_lambda_alias.live` resource (infra/modules/lambda/main.tf)
   - `lambda_alias_arns` output (infra/modules/lambda/outputs.tf)

2. **Removed import logic:**
   - All alias import code from `.github/workflows/dev.yml`
   - All alias state manipulation attempts

3. **Added state cleanup:**
   - One-time step to remove aliases from Terraform state
   - Idempotent (safe to run multiple times)
   - Non-destructive (alias remains in AWS)

### What Remains

- Lambda aliases **remain in AWS** (not deleted)
- API Gateway continues to work (never needed aliases)
- Lambda functions still managed by Terraform
- Lambda permissions still managed by Terraform

## Consequences

### Positive

✅ **Idempotent deployments** - `terraform apply` can run multiple times safely
✅ **No ResourceConflictException** - Alias conflicts eliminated permanently
✅ **Simpler CI/CD** - No complex import logic needed
✅ **Faster deployments** - Less state manipulation overhead
✅ **Clear separation** - Terraform manages what it creates, ignores stable resources

### Negative

⚠️ **Manual alias management** - If aliases need updates, must be done via AWS CLI/Console
⚠️ **No version tracking** - Alias versions not tracked in Terraform (use tags instead)

### Neutral

ℹ️ **Existing aliases unaffected** - Remain in AWS, just not managed by Terraform
ℹ️ **Blue/green deployments** - Can still be done manually or via external tools

## Alternatives Considered

1. **Import aliases on every deployment**
   - ❌ Tried 157+ times, never worked reliably
   - ❌ Added complexity and failure points
   - ❌ Not truly idempotent

2. **Use lifecycle ignore_changes**
   - ❌ Didn't prevent CREATE attempts
   - ❌ State still became inconsistent
   - ❌ ResourceConflictException still occurred

3. **External data source for aliases**
   - ⚠️ Adds read-only reference but doesn't solve management issue
   - ⚠️ Still requires initial import
   - ⚠️ Doesn't prevent conflicts

4. **Remove and recreate aliases** (CHOSEN)
   - ✅ Simple and clear
   - ✅ Follows "Terraform manages what it creates" principle
   - ✅ API Gateway doesn't need aliases
   - ✅ Deployments are idempotent

## Implementation

### Files Changed

```
infra/modules/lambda/main.tf         - Removed aws_lambda_alias resource
infra/modules/lambda/outputs.tf      - Removed lambda_alias_arns output
.github/workflows/dev.yml            - Removed import logic, added state cleanup
```

### Migration Path

1. **First deployment after this change:**
   - Terraform state cleanup runs automatically
   - Alias removed from state (stays in AWS)
   - Terraform plan shows NO changes to aliases

2. **Subsequent deployments:**
   - Terraform ignores aliases completely
   - No conflicts, no errors
   - Fully idempotent

### Rollback Plan

If aliases need to be managed by Terraform again:

1. Restore `aws_lambda_alias` resource
2. Import aliases into state: `terraform import 'module.lambda.aws_lambda_alias.live["api-handler"]' 'warmpawz-dev-api-handler:live'`
3. Remove state cleanup step from workflow

## Verification

After deployment, verify:

```bash
# Terraform should ignore aliases
cd infra/envs/dev
terraform plan  # Should show NO alias changes

# Alias still exists in AWS
aws lambda get-alias --function-name warmpawz-dev-api-handler --name live

# API Gateway still works
curl https://api.warmpawz.com/health
```

## References

- GitHub Actions workflow: `.github/workflows/dev.yml`
- Lambda module: `infra/modules/lambda/main.tf`
- API Gateway integration: `infra/modules/api-gateway/main.tf` lines 90, 104
- Failed deployment attempts: 157+ (see GitHub Actions history)

## Lessons Learned

1. **Don't manage stable resources in Terraform** - Resources that rarely change are better managed manually
2. **Understand dependencies** - We assumed API Gateway needed aliases, but it didn't
3. **Simplicity over complexity** - Removing code is often the best fix
4. **Idempotency is critical** - Deployments must be safely repeatable
5. **State consistency matters** - Terraform state must match reality

---

**Approved by:** DevOps Team
**Implemented:** 2026-01-05
**Next Review:** When blue/green deployment requirements change

