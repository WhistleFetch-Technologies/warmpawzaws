# 📊 CLOUDWATCH MONITORING GUIDE

Comprehensive guide for monitoring the Warmpawz platform using AWS CloudWatch.

---

## 🎯 MONITORING STRATEGY

### **Three-Layer Monitoring**

1. **Infrastructure Layer**: AWS resources (Lambda, API Gateway, RDS)
2. **Application Layer**: Business metrics (bookings, payments, signups)
3. **User Experience Layer**: Latency, errors, availability

---

## 🚀 QUICK START

### **1. Deploy Monitoring Stack**

```bash
cd infrastructure/cdk

# Deploy monitoring stack
npm run cdk deploy MonitoringStack

# This creates:
# - CloudWatch Dashboard
# - 15+ CloudWatch Alarms
# - SNS Topic for notifications
# - Log Insights queries
```

### **2. Access Dashboard**

After deployment, you'll get a URL:
```
Dashboard URL: https://console.aws.amazon.com/cloudwatch/home?region=ap-south-1#dashboards:name=Warmpawz-production
```

**Bookmark this URL** for quick access.

### **3. Configure Notifications**

```bash
# Confirm SNS subscription (check your email)
# Look for: "AWS Notification - Subscription Confirmation"
# Click the confirmation link

# Test alarm notification
aws cloudwatch set-alarm-state \
  --alarm-name production-api-5xx-errors \
  --state-value ALARM \
  --state-reason "Testing alarm notification"
```

---

## 📊 DASHBOARD OVERVIEW

The CloudWatch Dashboard has 6 main sections:

### **1. API Gateway Metrics**

| Widget | What It Shows | Good | Warning | Critical |
|--------|---------------|------|---------|----------|
| **Requests** | Total API requests | Steady growth | Sudden drop | Zero traffic |
| **Errors** | 4xx and 5xx errors | < 1% | 1-5% | > 5% |
| **Latency** | Response time (ms) | < 200ms | 200-500ms | > 500ms |

### **2. Lambda Metrics** (per function)

| Widget | What It Shows | Good | Warning | Critical |
|--------|---------------|------|---------|----------|
| **Invocations** | Function executions | Matches API traffic | - | Throttling |
| **Errors** | Function failures | < 0.1% | 0.1-1% | > 1% |
| **Duration** | Execution time | < 1s | 1-3s | > 3s |
| **Throttles** | Concurrency limits hit | 0 | 1-5 | > 5 |

### **3. RDS Metrics**

| Widget | What It Shows | Good | Warning | Critical |
|--------|---------------|------|---------|----------|
| **CPU Utilization** | Database CPU usage | < 50% | 50-80% | > 80% |
| **Connections** | Active DB connections | < 50 | 50-80 | > 80 |
| **Free Storage** | Available disk space | > 20GB | 10-20GB | < 10GB |

### **4. Business Metrics**

| Widget | What It Shows | Purpose |
|--------|---------------|---------|
| **Bookings Created** | Hourly booking count | Track platform usage |
| **Successful Payments** | Payment completions | Monitor revenue flow |
| **Vendor Signups** | New vendor registrations | Track growth |

---

## 🚨 ALARMS CONFIGURATION

### **Critical Alarms** (Immediate Action Required)

| Alarm Name | Threshold | Action |
|------------|-----------|--------|
| `production-api-5xx-errors` | > 10 errors in 10 min | Check Lambda logs, database health |
| `production-rds-high-cpu` | > 80% for 15 min | Scale RDS instance, optimize queries |
| `production-rds-low-storage` | < 10GB free | Increase RDS storage immediately |
| `production-*-throttles` | > 1 throttle | Increase Lambda concurrency |

### **Warning Alarms** (Monitor Closely)

| Alarm Name | Threshold | Action |
|------------|-----------|--------|
| `production-api-high-latency` | > 1s for 15 min | Check slow queries, add caching |
| `production-*-errors` | > 5 errors in 10 min | Review error logs, fix bugs |
| `production-rds-high-connections` | > 80 connections | Check connection pool, add replica |

---

## 📈 DAILY MONITORING CHECKLIST

### **Every Morning** (5 minutes)

- [ ] Check CloudWatch Dashboard
- [ ] Review any alarm notifications from overnight
- [ ] Check business metrics (bookings, payments)
- [ ] Verify no errors in Log Insights

### **Quick Dashboard Check**

```bash
# Get alarm summary
aws cloudwatch describe-alarms \
  --state-value ALARM \
  --query 'MetricAlarms[*].[AlarmName,StateReason]' \
  --output table

# No output = All good! ✅
```

---

## 🔍 LOG INSIGHTS QUERIES

### **1. Recent Errors**

```
fields @timestamp, @message, level, error
| filter level = "ERROR"
| sort @timestamp desc
| limit 100
```

**When to Use**: Daily error review, debugging issues

### **2. Slow Queries**

```
fields @timestamp, @message, duration
| filter duration > 1000
| sort duration desc
| limit 50
```

**When to Use**: Performance optimization, identifying bottlenecks

### **3. Top Endpoints by Request Count**

```
fields endpoint, count(*) as request_count
| stats count(*) by endpoint
| sort request_count desc
| limit 10
```

**When to Use**: Understanding traffic patterns

### **4. Failed Bookings**

```
fields @timestamp, bookingId, error
| filter @message like /booking.*failed/
| sort @timestamp desc
| limit 50
```

**When to Use**: Investigating booking issues

### **5. Payment Failures**

```
fields @timestamp, paymentId, razorpayError
| filter status = "failed"
| sort @timestamp desc
| limit 50
```

**When to Use**: Payment gateway troubleshooting

---

## 🚨 INCIDENT RESPONSE PLAYBOOK

### **Scenario 1: High 5XX Error Rate**

**Alarm**: `production-api-5xx-errors`

**Step 1**: Check Lambda logs
```bash
aws logs tail /aws/lambda/warmpawz-api --follow --filter-pattern "ERROR"
```

**Step 2**: Check RDS status
```bash
aws rds describe-db-instances --db-instance-identifier warmpawz-prod \
  --query 'DBInstances[0].[DBInstanceStatus,PendingModifiedValues]'
```

**Step 3**: Check recent deployments
```bash
git log --since="1 hour ago" --oneline
```

**Step 4**: Rollback if needed
```bash
git revert HEAD
npm run cdk deploy --all
```

### **Scenario 2: High Latency (> 1s)**

**Alarm**: `production-api-high-latency`

**Step 1**: Identify slow endpoints
```bash
# Run Log Insights "Slow Queries" query
# Sort by duration descending
```

**Step 2**: Check database performance
```bash
# Connect to RDS
psql -h warmpawz-prod.xxxxx.rds.amazonaws.com -U admin -d warmpawz_prod

# Check slow queries
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Step 3**: Add missing indexes
```sql
-- Example: If searching by city is slow
CREATE INDEX CONCURRENTLY idx_vendors_city ON vendors(city);
```

### **Scenario 3: Database Connection Pool Exhausted**

**Alarm**: `production-rds-high-connections`

**Step 1**: Check current connections
```sql
SELECT count(*), state, query
FROM pg_stat_activity
GROUP BY state, query
ORDER BY count DESC;
```

**Step 2**: Kill idle connections
```sql
-- Find connections idle for > 10 minutes
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < NOW() - INTERVAL '10 minutes';
```

**Step 3**: Increase connection limit (temporary)
```bash
aws rds modify-db-parameter-group \
  --db-parameter-group-name warmpawz-prod \
  --parameters "ParameterName=max_connections,ParameterValue=200,ApplyMethod=immediate"
```

**Step 4**: Fix Lambda connection pooling (permanent)
```typescript
// In backend/lambda/src/database/rds-connection.ts
const pool = new Pool({
  max: 10, // Limit per Lambda instance
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### **Scenario 4: Lambda Throttling**

**Alarm**: `production-*-throttles`

**Step 1**: Check current concurrency
```bash
aws lambda get-function-concurrency \
  --function-name warmpawz-api
```

**Step 2**: Increase reserved concurrency
```bash
aws lambda put-function-concurrency \
  --function-name warmpawz-api \
  --reserved-concurrent-executions 100
```

**Step 3**: Request AWS account limit increase
```bash
# Go to AWS Service Quotas console
# Request increase for:
# - Concurrent executions (default 1000)
```

---

## 📊 CUSTOM METRICS (OPTIONAL)

### **Publishing Business Metrics from Lambda**

```typescript
// In backend/lambda/src/utils/cloudwatch-metrics.ts
import { CloudWatch } from 'aws-sdk';

const cloudwatch = new CloudWatch();

export async function publishBookingCreated(bookingId: string) {
  await cloudwatch.putMetricData({
    Namespace: 'Warmpawz/Business',
    MetricData: [
      {
        MetricName: 'BookingsCreated',
        Value: 1,
        Unit: 'Count',
        Timestamp: new Date(),
        Dimensions: [
          { Name: 'Environment', Value: process.env.ENVIRONMENT },
        ],
      },
    ],
  }).promise();
}

export async function publishPaymentSuccess(amount: number) {
  await cloudwatch.putMetricData({
    Namespace: 'Warmpawz/Business',
    MetricData: [
      {
        MetricName: 'PaymentsSuccessful',
        Value: 1,
        Unit: 'Count',
        Timestamp: new Date(),
      },
      {
        MetricName: 'RevenueGenerated',
        Value: amount,
        Unit: 'None',
        Timestamp: new Date(),
      },
    ],
  }).promise();
}

// Usage in booking handler:
await publishBookingCreated(booking.id);
```

---

## 💰 COST OPTIMIZATION

### **CloudWatch Costs**

| Resource | Monthly Cost (Est.) | How to Reduce |
|----------|---------------------|---------------|
| Dashboard | $3/month | Combine widgets |
| Alarms | $0.10/alarm (~$2 total) | Remove redundant alarms |
| Logs | $0.50/GB + $0.005/query | Set retention to 7 days |
| Metrics | $0.30/custom metric | Publish only critical metrics |

**Total**: ~$10-20/month (acceptable for production monitoring)

### **Log Retention Policy**

```bash
# Set log retention to 7 days (reduces costs)
aws logs put-retention-policy \
  --log-group-name /aws/lambda/warmpawz-api \
  --retention-in-days 7
```

---

## 📚 ADDITIONAL RESOURCES

- **CloudWatch Dashboard Guide**: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Dashboards.html
- **CloudWatch Alarms Best Practices**: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Best_Practice_Recommended_Alarms_AWS_Services.html
- **Log Insights Query Syntax**: https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html
- **AWS Well-Architected**: https://wa.aws.amazon.com/wat.pillar.reliability.en.html

---

**Last Updated**: January 2, 2026  
**Next Review**: Weekly (production), Monthly (staging/dev)

