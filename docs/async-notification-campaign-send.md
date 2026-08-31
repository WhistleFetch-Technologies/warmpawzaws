# Async notification campaign send (cost-flat)

## Problem
`POST /admin/notifications/campaigns/:id/send` ran FCM fan-out synchronously inside API Gateway’s ~30s limit → 503.

## Approach (no EventBridge / no cron)
1. `/send` resolves fresh-FCM audience, inserts `PENDING` deliveries, sets `QUEUED`→`SENDING`, returns **202**.
2. `Lambda.invoke` (`InvocationType: Event`) on the **same** API handler with `{ job: "notification-campaign-delivery", campaignId, hop }`.
3. Worker claims ≤40 `PENDING` rows (`FOR UPDATE SKIP LOCKED`), delivers via existing `dispatchCampaignNotification` (unchanged FCM/APNs), max **2 attempts**.
4. If more `PENDING` remain → **one** self-invoke with `hop + 1`. Idle → **zero** extra invocations.
5. **Hard cap:** `MAX_CAMPAIGN_CHAIN_HOPS` = ceil(5000/40)+10 = **135** hops per campaign. Further self-invokes are refused; leftover `PENDING` rows fail as `chain_hop_cap`.

## Explicit non-goals
- No new EventBridge schedules
- No changes to push-bootstrap / register-device / firebase-client send shape
- Notification cron endpoints remain disabled (`NOTIFICATION_CRON_ENDPOINTS_DISABLED`)

## Deploy order
1. Migration `1092_campaign_delivery_attempt.sql` (dev then prod)
2. Lambda API handler
3. Admin web (success copy only)

## IAM
Function role needs `lambda:InvokeFunction` on itself (same function name). Confirm before prod if not already present.

Example policy statement:

```json
{
  "Effect": "Allow",
  "Action": "lambda:InvokeFunction",
  "Resource": "arn:aws:lambda:ap-south-1:ACCOUNT:function:warmpawz-*-api-handler"
}
```

Without this, enqueue still returns 202 and PENDING rows exist, but worker chain cannot start — check CloudWatch for `AccessDeniedException` on Invoke.
