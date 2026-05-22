# Step 3 Plan Drift Audit

**Generated:** 2026-05-22  
**Plan file:** `infra/envs/dev/step3.tfplan`  
**Decoded JSON:** `docs/migration/step3-plan.json`

---

## Executive Summary

| Metric | Count |
|---|---|
| Total resource changes in step3.tfplan | 319 |
| no-op | 137 |
| create | 124 |
| update | 24 |
| delete | 34 |
| **DANGEROUS destroys (must be 0 before full apply)** | **32** |
| **Meaningful updates that should be deferred** | **22** |

**⛔ DO NOT run `terraform apply step3.tfplan` directly.** The full plan contains 32 dangerous destroys outside the API Gateway routes scope. Use `step3-scoped.tfplan` instead (see Part B).

---

## Part A — Full Plan Audit

### All CREATE Actions (124)

All creates are in scope for this migration — new API Gateway routes, domain names, CloudFront distributions, and the customer-java VPC link/integration.

Key creates:
- `module.api_gateway.aws_apigatewayv2_route.booking_java[*]` — 37 new booking routes (net-new)
- `module.api_gateway.aws_apigatewayv2_route.customer_java[*]` — 50 new customer routes (includes some net-new)
- `module.api_gateway.aws_apigatewayv2_vpc_link.customer_java[0]` — new VPC link for customer-java
- `module.api_gateway.aws_apigatewayv2_integration.customer_java[0]` — new HTTP_PROXY integration for customer-java
- `module.api_gateway.aws_apigatewayv2_integration.lambda["api-handler"]` — new Lambda integration
- `module.cloudfront.aws_cloudfront_distribution.frontend[*]` — CloudFront distributions (admin/customer/vendor)
- `module.api_gateway.aws_apigatewayv2_domain_name.main[0]`, `module.api_gateway.aws_apigatewayv2_api_mapping.main[0]`
- Route53 records, S3 security group ingress rule

### All DELETE Actions (34) — Classified

| Address | Category | Safe to apply in full plan? |
|---|---|---|
| `module.api_gateway.aws_apigatewayv2_route.booking_java["ANY /booking/{proxy+}"]` | ROUTE | ✅ Expected — old proxy catch-all being replaced by explicit routes |
| `module.api_gateway.aws_apigatewayv2_route.booking_java["ANY /bookings/{proxy+}"]` | ROUTE | ✅ Expected — old proxy catch-all being replaced by explicit routes |
| `aws_security_group.apigw_delivery_vpc_link[0]` | DELIVERY-TEARDOWN | ⚠️ Not for this step — delivery service decommission must be a separate intentional step |
| `aws_security_group_rule.rds_postgres_from_delivery_ecs[0]` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `aws_vpc_security_group_ingress_rule.secretsmanager_vpce_from_delivery_ecs["sg-029fd9f75cf25da6f"]` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.api_gateway.aws_apigatewayv2_integration.delivery_java[0]` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.api_gateway.aws_apigatewayv2_vpc_link.delivery_java[0]` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.api_gateway.null_resource.update_existing_api_cors[0]` | DRIFT | ⚠️ null_resource removed from config; harmless but non-route |
| `module.booking_service_ecs[0].aws_ecs_task_definition.booking` | **DANGEROUS** | ❌ Deletes the live booking ECS task definition (active service!) |
| `module.customer_service_ecs[0].aws_ecs_task_definition.customer` | **DANGEROUS** | ❌ Deletes the live customer ECS task definition (active service!) |
| `module.delivery_codebuild[0].aws_cloudwatch_log_group.codebuild` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_codebuild[0].aws_codebuild_project.delivery` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_codebuild[0].aws_iam_role.codebuild` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_codebuild[0].aws_iam_role_policy.codebuild_inline` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_service_ecs[0].aws_cloudwatch_log_group.ecs` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_service_ecs[0].aws_ecr_repository.delivery_service` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_service_ecs[0].aws_ecs_cluster.delivery` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_service_ecs[0].aws_ecs_service.delivery` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_service_ecs[0].aws_ecs_task_definition.delivery` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_service_ecs[0].aws_iam_role.ecs_execution` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_service_ecs[0].aws_iam_role.ecs_task` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_service_ecs[0].aws_iam_role_policy.ecs_execution_secrets` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_service_ecs[0].aws_iam_role_policy_attachment.ecs_execution_managed` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_service_ecs[0].aws_lb.internal` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_service_ecs[0].aws_lb_listener.http` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_service_ecs[0].aws_lb_target_group.delivery` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_service_ecs[0].aws_security_group.alb_internal` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_service_ecs[0].aws_security_group.ecs_tasks` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_service_ecs[0].aws_security_group_rule.alb_ingress_from_apigw_vpc_link[0]` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.delivery_service_ecs[0].aws_security_group_rule.ecs_tasks_ingress_from_alb` | DELIVERY-TEARDOWN | ⚠️ Not for this step |
| `module.dynamodb.aws_cloudwatch_metric_alarm.dynamodb_read_throttles["analytics_events"]` | **DANGEROUS** | ❌ Tied to DynamoDB table deletion below |
| `module.dynamodb.aws_cloudwatch_metric_alarm.dynamodb_write_throttles["analytics_events"]` | **DANGEROUS** | ❌ Tied to DynamoDB table deletion below |
| `module.dynamodb.aws_dynamodb_table.analytics_events` | **DANGEROUS** | ❌ Deletes a DynamoDB table — DATA LOSS |
| `module.secrets.aws_secretsmanager_secret_version.razorpay` | **DANGEROUS** | ❌ Deletes the active Razorpay secret version — payment outage |

**Summary: 2 ROUTE (safe), 19 DELIVERY-TEARDOWN (deferred to separate step), 1 DRIFT (harmless), 5 OUTRIGHT DANGEROUS (must not apply)**

---

### All UPDATE Actions (24) — Analysis

| Address | What Changes | Should Apply Now? |
|---|---|---|
| `module.api_gateway.aws_apigatewayv2_route.booking_java["POST /bookings/generate-otp"]` | `target`: `integrations/jrsc8v3` → `integrations/bsttuan` (OTP route target flip to Java) | ✅ IN SCOPED PLAN |
| `module.api_gateway.aws_apigatewayv2_route.booking_java["POST /bookings/verify-otp"]` | `target`: `integrations/jrsc8v3` → `integrations/bsttuan` (OTP route target flip to Java) | ✅ IN SCOPED PLAN |
| `module.api_gateway.aws_apigatewayv2_route.customer_java["GET /customer/by-phone"]` | `target`: `integrations/hv286ua` → computed (new customer-java integration) | ✅ IN SCOPED PLAN (expected — integration being created) |
| `module.api_gateway.aws_apigatewayv2_route.customer_java["GET /customer/pets"]` | `target`: `integrations/hv286ua` → computed (new customer-java integration) | ✅ IN SCOPED PLAN (expected) |
| `module.api_gateway.aws_apigatewayv2_route.customer_java["GET /customer/profile"]` | `target`: `integrations/hv286ua` → computed (new customer-java integration) | ✅ IN SCOPED PLAN (expected) |
| `module.api_gateway.aws_apigatewayv2_route.customer_java["POST /customer/profile"]` | `target`: `integrations/hv286ua` → computed (new customer-java integration) | ✅ IN SCOPED PLAN (expected) |
| `module.api_gateway.aws_cloudwatch_metric_alarm.api_4xx_errors` | `dimensions.ApiId`: `iixwc3fzfl` → `z0b3obweb6` (old API → new API ID) | ⏸️ DEFER — not route work |
| `module.api_gateway.aws_cloudwatch_metric_alarm.api_5xx_errors` | ApiId change + SNS topic change + evaluation_periods 1→2 | ⏸️ DEFER |
| `module.api_gateway.aws_cloudwatch_metric_alarm.api_latency` | `dimensions.ApiId`: `iixwc3fzfl` → `z0b3obweb6` | ⏸️ DEFER |
| `module.booking_service_ecs[0].aws_ecs_service.booking` | `task_definition` reference removed (linked to task def deletion) | ❌ BLOCK — do not apply with ECS task def delete |
| `module.cloudfront.aws_cloudwatch_metric_alarm.cloudfront_error_rate["admin"]` | `dimensions.DistributionId` removed | ⏸️ DEFER |
| `module.cloudfront.aws_cloudwatch_metric_alarm.cloudfront_error_rate["customer"]` | `dimensions.DistributionId` removed | ⏸️ DEFER |
| `module.cloudfront.aws_cloudwatch_metric_alarm.cloudfront_error_rate["vendor"]` | `dimensions.DistributionId` removed | ⏸️ DEFER |
| `module.cloudfront.aws_s3_bucket_policy.frontend["admin"]` | Policy cleared (20 CloudFront distribution SIDs → none) | ❌ BLOCK — would break admin frontend CDN access |
| `module.cloudfront.aws_s3_bucket_policy.frontend["customer"]` | Policy cleared (20 SIDs → none) | ❌ BLOCK — would break customer frontend CDN access |
| `module.cloudfront.aws_s3_bucket_policy.frontend["vendor"]` | Policy cleared (1 SID → none) | ❌ BLOCK — would break vendor frontend CDN access |
| `module.cognito.aws_iam_role_policy.authenticated` | `execute-api:Invoke` ARN: `iixwc3fzfl` → `z0b3obweb6` | ⏸️ DEFER — valid but not route work |
| `module.customer_service_ecs[0].aws_ecs_service.customer` | `task_definition` reference removed | ❌ BLOCK — do not apply with ECS task def delete |
| `module.lambda.aws_cloudwatch_metric_alarm.lambda_duration["api-handler"]` | threshold: 24000 → 48000ms | ⏸️ DEFER |
| `module.lambda.aws_iam_role_policy.lambda_custom` | Removed `PutSecretValue`/`CreateSecret` perms; added EventBridge rule ARN; removed `google-maps/api-key-*` | ❌ BLOCK — IAM narrowing needs deliberate review |
| `module.lambda.aws_lambda_function.functions["api-handler"]` | `BYPASS_24H_MEAL_VALIDATION` removed; `DELIVERY_SERVICE_BASE_URL` removed; code hash changed | ❌ BLOCK — Lambda code deployment needs its own step |
| `module.lambda.aws_lambda_function.migration_runner[0]` | `ALLOWED_ORIGINS` added; `SETTLEMENT_CALCULATE_CRON_RULE_NAME` added | ⏸️ DEFER |
| `module.s3.aws_s3_bucket_cors_configuration.user_uploads` | CORS origins expanded (more localhost ports + CloudFront URLs) | ⏸️ DEFER (low risk, own step) |
| `module.sns.aws_sns_topic.system_alerts` | `delivery_policy` JSON key reordering (cosmetic) | ⏸️ DEFER (cosmetic) |

**Meaningful updates to defer: 22 (all except the 6 route updates which are already in the scoped plan)**

---

## Root-Cause Suspicions for Drift

1. **`enable_delivery_stack = false` in current config** — The delivery service module was disabled/removed from variables, causing Terraform to plan deletion of all `module.delivery_service_ecs[0].*` and `module.delivery_codebuild[0].*` resources. These were previously created when `enable_delivery_stack = true`.

2. **ECS task definitions regenerated outside Terraform** — `module.booking_service_ecs[0].aws_ecs_task_definition.booking` and `module.customer_service_ecs[0].aws_ecs_task_definition.customer` are flagged for deletion because the tfvars changed the image URI, causing TF to want to create a new task definition revision and delete the old one. CI/CD deployments to ECS likely created additional revisions outside Terraform state.

3. **S3 bucket policies accumulated multiple CloudFront distribution ARNs via console** — The admin bucket policy had 20 CloudFront distribution SIDs — far more than Terraform manages. Multiple manual plan+apply cycles or console operations added them, creating drift. Terraform now wants to replace with just the canonical set.

4. **API Gateway ID migration (iixwc3fzfl → z0b3obweb6)** — The API Gateway was recreated or a new one (`z0b3obweb6`) was designated as the target. CloudWatch alarms and Cognito IAM policies still reference the old API ID `iixwc3fzfl`.

5. **Lambda code deployed directly outside Terraform** — The `api-handler` Lambda's `source_code_hash` in state (`VmSsqit7I+...`) differs from the local zip (`2u49YAzoKA67...`). This happens when `deploy-lambda-direct.sh` is run without a `terraform apply`. The env var removals (`BYPASS_24H_MEAL_VALIDATION`, `DELIVERY_SERVICE_BASE_URL`) reflect config cleanup in `main.tf` that hasn't been applied yet.

---

## Part B — Scoped Plan Results

**Plan file:** `infra/envs/dev/step3-scoped.tfplan`  
**Log:** `docs/migration/dev-tf-plan-step3-scoped.log`  
**JSON:** `docs/migration/step3-scoped-plan.json`

### Action Totals

| Category | Expected | Actual | Match? |
|---|---|---|---|
| imports | 6 | 6 | ✅ |
| creates (routes) | 89 | 89 | ✅ |
| creates (vpc_link + integration for customer_java) | 2 | 2 | ✅ |
| total creates | ~91 | 91 | ✅ |
| updates (OTP flips + 4 imported route updates) | 2–6 | 6 | ✅ |
| destroys (only booking proxy ANY routes) | 2 | 2 | ✅ |
| destroys of ANY non-route resource | 0 | **0** | ✅ |
| total non-no-op actions | 99–105 | 105 | ✅ |

### Spot Checks

| Route | Check | Before | After | Actions | Pass? |
|---|---|---|---|---|---|
| `POST /bookings/generate-otp` | OTP target flip | `integrations/jrsc8v3` | `integrations/bsttuan` | update | ✅ |
| `GET /customer/profile` | Imported route update | `integrations/hv286ua` | (computed — new customer_java integration) | update | ✅ |
| `ANY /bookings/{proxy+}` | Proxy route removal | — | — | delete | ✅ |

**Note on `GET /customer/profile` "after target = empty":** This is expected. The customer_java VPC link and integration are being *created* in this plan. At plan time, the new integration's ID is a computed (unknown) value; Terraform shows it as empty. After `apply`, the route will be correctly updated to point to the new integration. This is standard Terraform behaviour for create+update in a single apply.

---

## Conclusion

- **DANGEROUS destroys in full step3.tfplan:** 5 resources (2 ECS task defs, 1 DynamoDB table, 1 Razorpay secret version, 2 CW alarms tied to DynamoDB)
- **DELIVERY-TEARDOWN destroys:** 19 resources (acceptable once delivery decommission is intentional, but must be a separate step)
- **Meaningful deferred updates:** 22 (Lambda code, IAM policy, S3 bucket policies, ECS services, CloudWatch alarms)
- **The scoped plan `step3-scoped.tfplan` touches ZERO non-route resources with destructive actions**
- **READY_FOR_APPLY: YES** (scoped plan only)
