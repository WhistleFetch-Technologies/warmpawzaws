# Orphan Resources From Step 4 — Cleanup Pending

Created: 2026-05-22
Origin commit: 2ce1a207d
Soak window: ends 2026-05-23 ~17:30 IST (24h after flip)

## Resources

| Type | AWS ID | Origin | Last verified zero traffic | Cleanup command (run AFTER soak) |
|---|---|---|---|---|
| aws_apigatewayv2_integration | hv286ua | Pre-Terraform manual creation — used VPC link `7n4bl0` (old customer-java link, untagged, 2026-05-21) | 2026-05-22 (0 routes targeting this integration) | `aws apigatewayv2 delete-integration --api-id z0b3obweb6 --integration-id hv286ua --region ap-south-1` |
| aws_apigatewayv2_vpc_link | 7n4bl0 | Linked to hv286ua — name `warmpawz-dev-customer-java`, created 2026-05-21, no Terraform tags. **NOT** `mvxmmr` (the Terraform-managed VPC link used by active integration 17hs4nn). | 2026-05-22 (0 integrations using it after hv286ua delete) | `aws apigatewayv2 delete-vpc-link --vpc-link-id 7n4bl0 --region ap-south-1` |

> **Active (keep):** VPC link `mvxmmr` (`warmpawz-dev-customer-java`, created 2026-05-22, Terraform tags present) → used by integration `17hs4nn` → routes to `warmpawz-dev-customer-i` ALB.

## Already-deleted as part of Step 4 (informational, no action needed)

| RouteId | Reason |
|---|---|
| 4dqqojb | Orphan `{proxy+}` from old API GW migration |
| juf5bo9 | Orphan `{proxy+}` |
| nkx7zwf | Orphan `{proxy+}` |
| duv94bo | Orphan `{proxy+}` |
| i5cqnue | Orphan `{proxy+}` |
| qpcqtkq | Orphan `{proxy+}` |
| xar81cq | Orphan `{proxy+}` |

## Pre-deletion checklist (Step 6, after 24h soak)

- [ ] CloudWatch metric `Count` on integration hv286ua = 0 for the past 24h
- [ ] `aws apigatewayv2 get-routes --api-id z0b3obweb6 --region ap-south-1` returns 0 routes with Target `integrations/hv286ua`
- [ ] Terraform state does NOT reference hv286ua (`terraform state list | grep hv286ua` → empty)
- [ ] Delete integration first: `aws apigatewayv2 delete-integration --api-id z0b3obweb6 --integration-id hv286ua --region ap-south-1`
- [ ] Then delete VPC link: `aws apigatewayv2 delete-vpc-link --vpc-link-id 7n4bl0 --region ap-south-1`
- [ ] Verify VPC link gone: `aws apigatewayv2 get-vpc-links --region ap-south-1 --query "Items[?VpcLinkId=='7n4bl0']"`
