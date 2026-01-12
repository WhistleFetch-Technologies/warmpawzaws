# 🔍 CloudWatch Error Tracking Guide - India Data Residency Compliant

**Date:** January 2, 2026  
**Status:** ✅ **Primary Solution for India**  
**Region:** ap-south-1 (Mumbai)

---

## 🎯 OVERVIEW

Since Sentry doesn't support India data residency requirements, **CloudWatch is our primary error tracking solution**. This guide shows how to use CloudWatch for comprehensive error tracking, monitoring, and alerting.

### ✅ Benefits

- **India Data Residency Compliant** - All data stays in ap-south-1
- **No External Dependencies** - Fully AWS-native
- **Cost-Effective** - Pay only for what you use
- **Integrated** - Works seamlessly with Lambda, API Gateway, etc.
- **Powerful Queries** - CloudWatch Logs Insights for analysis

---

## 🚀 QUICK START

### Step 1: Verify Error Tracking is Active

The error tracking utility is already integrated and works in **CloudWatch-only mode** by default. No Sentry DSN needed!

```typescript
// Already configured in handler/index.ts
import { initializeErrorTracking, getErrorTrackingConfig } from '../utils/error-tracking';

const config = getErrorTrackingConfig();
initializeErrorTracking(config);
```

### Step 2: Errors Are Automatically Logged

All errors are automatically:
- ✅ Logged to CloudWatch Logs (structured JSON)
- ✅ Published as CloudWatch Metrics
- ✅ Available for CloudWatch Logs Insights queries

---

## 📊 CLOUDWATCH LOGS STRUCTURE

Errors are logged as structured JSON for easy querying:

```json
{
  "level": "ERROR",
  "errorId": "err_1234567890_abc123",
  "error": {
    "name": "TypeError",
    "message": "Cannot read property 'x' of undefined",
    "stack": "TypeError: Cannot read property...",
    "type": "TypeError"
  },
  "context": {
    "requestId": "req-123",
    "path": "/api/bookings",
    "method": "POST",
    "userId": "user-123"
  },
  "timestamp": "2026-01-02T10:30:00.000Z",
  "environment": "production",
  "_metadata": {
    "errorType": "TypeError",
    "severity": "error",
    "hasStack": true,
    "contextKeys": "requestId,path,method,userId"
  }
}
```

---

## 🔍 CLOUDWATCH LOGS INSIGHTS QUERIES

### Query 1: All Errors in Last Hour

```sql
fields @timestamp, error.name, error.message, context.path, context.method
| filter level = "ERROR"
| sort @timestamp desc
| limit 100
```

### Query 2: Error Count by Type

```sql
fields error.type
| filter level = "ERROR"
| stats count() as errorCount by error.type
| sort errorCount desc
```

### Query 3: Errors by Endpoint

```sql
fields context.path, error.message
| filter level = "ERROR"
| stats count() as errorCount by context.path
| sort errorCount desc
```

### Query 4: Errors by User

```sql
fields context.userId, error.message, @timestamp
| filter level = "ERROR" and ispresent(context.userId)
| sort @timestamp desc
| limit 50
```

### Query 5: Recent Errors with Stack Traces

```sql
fields @timestamp, error.name, error.message, error.stack, context.requestId
| filter level = "ERROR"
| sort @timestamp desc
| limit 20
```

### Query 6: Error Rate Over Time

```sql
fields @timestamp
| filter level = "ERROR"
| stats count() as errorCount by bin(5m)
| sort @timestamp asc
```

---

## 📈 CLOUDWATCH METRICS

Errors are automatically published as CloudWatch Metrics:

**Namespace:** `Warmpawz/Errors`

**Metrics:**
- `ErrorCount` - Number of errors
  - Dimensions: `Environment`, `ErrorType`, `Severity`

**Example:**
```typescript
// Automatically published when errors occur
Metric: ErrorCount
Value: 1
Dimensions:
  - Environment: production
  - ErrorType: TypeError
  - Severity: error
```

---

## 🚨 CLOUDWATCH ALARMS

### Alarm 1: High Error Rate

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name warmpawz-high-error-rate \
  --alarm-description "Alert when error rate exceeds threshold" \
  --metric-name ErrorCount \
  --namespace Warmpawz/Errors \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:ap-south-1:ACCOUNT:alerts
```

### Alarm 2: Specific Error Type

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name warmpawz-database-errors \
  --alarm-description "Alert on database connection errors" \
  --metric-name ErrorCount \
  --namespace Warmpawz/Errors \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=ErrorType,Value=DatabaseError \
  --alarm-actions arn:aws:sns:ap-south-1:ACCOUNT:alerts
```

---

## 📊 CLOUDWATCH DASHBOARD

### Create Dashboard for Error Monitoring

```bash
aws cloudwatch put-dashboard \
  --dashboard-name Warmpawz-Error-Tracking \
  --dashboard-body file://error-dashboard.json
```

**Dashboard Widgets:**
1. **Error Count Over Time** - Line chart
2. **Errors by Type** - Pie chart
3. **Top Error Messages** - Table
4. **Errors by Endpoint** - Bar chart
5. **Recent Errors** - Logs widget

---

## 🔧 CONFIGURATION

### Environment Variables

```bash
# CloudWatch is always enabled (no config needed)
# Optional: Customize namespace
CLOUDWATCH_METRICS_NAMESPACE=Warmpawz/Errors

# Optional: Disable metrics (logs still work)
USE_CLOUDWATCH_METRICS=false

# Sentry is optional (leave unset for India compliance)
# SENTRY_DSN=  # Don't set this for India
```

### Lambda IAM Permissions

Ensure Lambda has CloudWatch permissions:

```json
{
  "Effect": "Allow",
  "Action": [
    "logs:CreateLogGroup",
    "logs:CreateLogStream",
    "logs:PutLogEvents",
    "cloudwatch:PutMetricData"
  ],
  "Resource": "*"
}
```

---

## 📋 USAGE EXAMPLES

### Example 1: Capture Error

```typescript
import { captureException } from '../utils/error-tracking';

try {
  // Your code
} catch (error) {
  captureException(error, {
    requestId: context.awsRequestId,
    path: event.rawPath,
    method: event.requestContext?.http?.method,
    userId: user?.id,
  });
  throw error;
}
```

### Example 2: Capture Warning

```typescript
import { captureMessage } from '../utils/error-tracking';

if (retryCount > 3) {
  captureMessage('High retry count detected', 'warning', {
    endpoint: '/api/bookings',
    retryCount,
  });
}
```

### Example 3: Add Context

```typescript
import { setUserContext, addBreadcrumb } from '../utils/error-tracking';

// Set user context
setUserContext(user.id, user.role, {
  email: user.email,
});

// Add breadcrumb
addBreadcrumb('Payment processing started', 'payment', 'info', {
  amount: 1000,
  currency: 'INR',
});
```

---

## 🔍 MONITORING & ANALYSIS

### View Logs in CloudWatch Console

1. Go to **CloudWatch Console**
2. Navigate to **Logs** → **Log groups**
3. Find: `/aws/lambda/warmpawz-{environment}-api-handler`
4. Click **View logs in Logs Insights**

### View Metrics

1. Go to **CloudWatch Console**
2. Navigate to **Metrics** → **All metrics**
3. Find: `Warmpawz/Errors`
4. Select `ErrorCount` metric

### Set Up Alerts

1. Go to **CloudWatch Console**
2. Navigate to **Alarms** → **Create alarm**
3. Select `ErrorCount` metric
4. Configure threshold and SNS topic

---

## 💰 COST ESTIMATION

### CloudWatch Logs
- **Ingestion:** $0.50 per GB
- **Storage:** $0.03 per GB/month
- **Queries:** $0.005 per GB scanned

**Estimated Monthly Cost:**
- 10 GB logs/day = ~$150/month (ingestion) + ~$9/month (storage)
- With 7-day retention: ~$159/month

### CloudWatch Metrics
- **Custom Metrics:** $0.30 per metric/month
- **Alarms:** $0.10 per alarm/month

**Estimated Monthly Cost:**
- 5 custom metrics = $1.50/month
- 3 alarms = $0.30/month

**Total:** ~$160/month (scalable with usage)

---

## ✅ BEST PRACTICES

### 1. Structured Logging
Always use structured JSON logging (already implemented):
```typescript
// ✅ Good - Structured
captureException(error, { requestId, path, method });

// ❌ Bad - Unstructured
console.error('Error:', error);
```

### 2. Error Context
Include relevant context:
```typescript
captureException(error, {
  requestId,
  path,
  method,
  userId,
  requestBody: sanitize(body), // Remove sensitive data
});
```

### 3. Log Retention
Set appropriate retention (7-30 days):
```bash
aws logs put-retention-policy \
  --log-group-name /aws/lambda/warmpawz-prod-api-handler \
  --retention-in-days 7
```

### 4. Query Optimization
Use filters in queries to reduce costs:
```sql
-- ✅ Good - Filtered
fields @timestamp, error.message
| filter level = "ERROR" and error.type = "DatabaseError"
| limit 100

-- ❌ Bad - No filter (scans all logs)
fields @timestamp, error.message
| limit 100
```

---

## 🆚 CLOUDWATCH vs SENTRY

| Feature | CloudWatch | Sentry |
|---------|-----------|--------|
| **India Data Residency** | ✅ Yes | ❌ No |
| **Cost** | Pay per use | Subscription |
| **Setup** | ✅ Already configured | Requires DSN |
| **Logs** | ✅ Native | Limited |
| **Metrics** | ✅ Native | Limited |
| **Alarms** | ✅ Native | Limited |
| **Query Language** | CloudWatch Logs Insights | Sentry UI |
| **Dashboards** | ✅ Native | ✅ Native |

**Verdict:** CloudWatch is the better choice for India!

---

## 📚 ADDITIONAL RESOURCES

- **CloudWatch Logs Insights:** https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html
- **CloudWatch Metrics:** https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/working_with_metrics.html
- **CloudWatch Alarms:** https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html
- **Lambda Logging:** https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatchlogs.html

---

## ✅ SUMMARY

**CloudWatch is your primary error tracking solution:**
- ✅ India data residency compliant
- ✅ Already integrated and working
- ✅ No Sentry DSN needed
- ✅ Comprehensive logging and metrics
- ✅ Powerful query capabilities
- ✅ Native AWS integration

**No action required** - it's already working! 🎉

---

**Status:** ✅ **READY FOR PRODUCTION**  
**Region:** ap-south-1 (Mumbai)  
**Compliance:** ✅ **India Data Residency Compliant**
