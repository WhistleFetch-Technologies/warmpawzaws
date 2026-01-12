# CloudWatch Error Tracking Setup Guide

**Date:** 2026-01-28  
**Region:** ap-south-1 (India)  
**Compliance:** India data residency compliant

---

## ✅ Current Status

**CloudWatch Integration:** ✅ **Already Implemented**

The codebase already has CloudWatch error tracking integrated:
- ✅ `@aws-sdk/client-cloudwatch` installed
- ✅ CloudWatch client initialized in `error-tracking.ts`
- ✅ Structured JSON logging to CloudWatch Logs
- ✅ CloudWatch Metrics support for error rates
- ✅ CloudWatch Logs Insights compatible

**No Sentry Required:** CloudWatch is the primary solution (India data residency compliant)

---

## 📋 Setup Steps

### 1. Verify CloudWatch Integration (Already Done)

**File:** `backend/lambda/src/utils/error-tracking.ts`

**Current Implementation:**
```typescript
// CloudWatch client already initialized
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

// CloudWatch metrics support
- Error counts
- Warning counts
- Info counts
- Custom metrics
```

**Status:** ✅ Code ready, no changes needed

---

### 2. Configure CloudWatch Logs Retention

**Action:** Set log retention period in CDK or AWS Console

**Recommended Retention:**
- **Dev:** 7-14 days
- **Stage:** 30 days
- **Prod:** 90 days (or longer for compliance)

**CDK Configuration:**
```typescript
// In lambda-stack.ts, add log retention
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

// For each Lambda function
logRetention: RetentionDays.ONE_MONTH, // or THREE_MONTHS for prod
```

**Manual Configuration:**
1. Go to AWS Console → CloudWatch → Log groups
2. Find log groups: `/aws/lambda/warmpawz-*-${environment}`
3. Set retention period for each log group

---

### 3. Create CloudWatch Alarms

**Purpose:** Get notified when errors exceed thresholds

**Recommended Alarms:**

#### Alarm 1: High Error Rate
```yaml
Alarm Name: warmpawz-{environment}-high-error-rate
Metric: Error count
Threshold: > 10 errors in 5 minutes
Action: SNS notification
```

#### Alarm 2: Lambda Function Errors
```yaml
Alarm Name: warmpawz-{environment}-lambda-errors
Metric: Lambda Errors
Threshold: > 5 errors in 5 minutes
Action: SNS notification
```

#### Alarm 3: Lambda Duration
```yaml
Alarm Name: warmpawz-{environment}-lambda-duration
Metric: Lambda Duration
Threshold: > 25 seconds (80% of timeout)
Action: SNS notification
```

**CDK Configuration:**
```typescript
// Create alarms in monitoring-stack.ts or lambda-stack.ts
import { Alarm, Metric, ComparisonOperator } from 'aws-cdk-lib/aws-cloudwatch';

// Error rate alarm
const errorAlarm = new Alarm(this, 'HighErrorRate', {
  metric: apiFunction.metricErrors(),
  threshold: 10,
  evaluationPeriods: 1,
  comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
});
```

**Manual Configuration:**
1. Go to AWS Console → CloudWatch → Alarms
2. Create alarm → Select metric → Lambda → Errors
3. Set threshold and SNS notification

---

### 4. Create CloudWatch Dashboards

**Purpose:** Visual monitoring of system health

**Recommended Dashboards:**

#### Dashboard 1: Error Monitoring
- Error count (last 1 hour)
- Error rate trend (last 24 hours)
- Top error types
- Lambda function errors by function

#### Dashboard 2: Performance Monitoring
- Lambda duration
- Lambda invocations
- Lambda throttles
- API Gateway latency

#### Dashboard 3: Business Metrics
- API request count
- Success rate
- Payment success rate
- Booking creation rate

**CDK Configuration:**
```typescript
import { Dashboard, GraphWidget, Metric } from 'aws-cdk-lib/aws-cloudwatch';

const dashboard = new Dashboard(this, 'WarmpawzMonitoring', {
  dashboardName: `warmpawz-${environment}-monitoring`,
});

dashboard.addWidgets(
  new GraphWidget({
    title: 'Error Rate',
    left: [apiFunction.metricErrors()],
  }),
  new GraphWidget({
    title: 'Lambda Duration',
    left: [apiFunction.metricDuration()],
  }),
);
```

**Manual Configuration:**
1. Go to AWS Console → CloudWatch → Dashboards
2. Create dashboard → Add widgets
3. Select metrics and configure graphs

---

### 5. Configure CloudWatch Logs Insights Queries

**Purpose:** Query and analyze logs efficiently

**Pre-configured Queries:**

#### Query 1: Error Analysis
```
fields @timestamp, @message, level, error.message, error.stack
| filter level = "ERROR"
| sort @timestamp desc
| limit 100
```

#### Query 2: API Errors by Endpoint
```
fields @timestamp, endpoint, statusCode, error.message
| filter level = "ERROR" and statusCode >= 400
| stats count() by endpoint
| sort count desc
```

#### Query 3: Payment Errors
```
fields @timestamp, @message, error.message
| filter @message like /payment/ and level = "ERROR"
| sort @timestamp desc
| limit 50
```

**Setup:**
1. Go to AWS Console → CloudWatch → Logs Insights
2. Select log group: `/aws/lambda/warmpawz-api-${environment}`
3. Save queries for reuse

---

### 6. Test Error Tracking

**Test Script:**
```bash
# Trigger an error to test tracking
curl -X POST https://api.warmpawz.com/test-error \
  -H "Authorization: Bearer $TOKEN"

# Check CloudWatch Logs
aws logs tail /aws/lambda/warmpawz-api-dev --follow

# Check CloudWatch Metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=warmpawz-api-dev \
  --start-time 2026-01-28T00:00:00Z \
  --end-time 2026-01-28T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

---

## 📊 CloudWatch Features Used

### ✅ Already Implemented

1. **CloudWatch Logs**
   - ✅ Automatic logging from Lambda
   - ✅ Structured JSON format
   - ✅ Request ID tracking
   - ✅ Error stack traces

2. **CloudWatch Metrics**
   - ✅ Error counts
   - ✅ Warning counts
   - ✅ Custom business metrics
   - ✅ Lambda function metrics (automatic)

3. **Error Tracking Utility**
   - ✅ `trackError()` function
   - ✅ `trackWarning()` function
   - ✅ `trackInfo()` function
   - ✅ Automatic CloudWatch metric publishing

### ⚠️ Need Configuration

1. **CloudWatch Alarms**
   - ⚠️ Error rate alarms
   - ⚠️ Lambda duration alarms
   - ⚠️ Lambda throttle alarms

2. **CloudWatch Dashboards**
   - ⚠️ Error monitoring dashboard
   - ⚠️ Performance dashboard
   - ⚠️ Business metrics dashboard

3. **CloudWatch Logs Insights**
   - ⚠️ Saved queries
   - ⚠️ Query automation

---

## 🔧 Configuration Files

### CDK Stack Enhancement

**File:** `infrastructure/cdk/lib/monitoring-stack.ts` (create if doesn't exist)

```typescript
import { Stack, StackProps } from 'aws-cdk-lib';
import { Dashboard, Alarm, Metric, ComparisonOperator } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsTopic } from 'aws-cdk-lib/aws-sns';

export class MonitoringStack extends Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const environment = props.environment;
    const apiFunction = props.apiFunction;

    // Create dashboard
    const dashboard = new Dashboard(this, 'WarmpawzDashboard', {
      dashboardName: `warmpawz-${environment}-monitoring`,
    });

    // Add error rate alarm
    const errorAlarm = new Alarm(this, 'ErrorRateAlarm', {
      alarmName: `warmpawz-${environment}-error-rate`,
      metric: apiFunction.metricErrors(),
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    // Add SNS notification
    errorAlarm.addAlarmAction(new SnsAction(props.alertTopic));
  }
}
```

---

## 📈 Monitoring Best Practices

### 1. Log Levels
- **ERROR:** System errors, exceptions, failures
- **WARN:** Recoverable issues, deprecations
- **INFO:** Important events, state changes
- **DEBUG:** Detailed debugging (dev only)

### 2. Structured Logging
```typescript
// Good: Structured JSON
console.log(JSON.stringify({
  level: 'ERROR',
  message: 'Payment failed',
  requestId: context.requestId,
  userId: userId,
  error: {
    message: error.message,
    stack: error.stack,
  },
}));

// Bad: Plain text
console.log('Payment failed');
```

### 3. Metric Naming
- Use consistent namespace: `Warmpawz/{Service}/{Metric}`
- Examples:
  - `Warmpawz/API/RequestCount`
  - `Warmpawz/Payment/SuccessRate`
  - `Warmpawz/Booking/CreationRate`

---

## 🚨 Alert Configuration

### Recommended Alerts

1. **Critical Errors**
   - Threshold: > 20 errors in 5 minutes
   - Action: Immediate SNS notification
   - Recipients: On-call engineer

2. **High Error Rate**
   - Threshold: > 10 errors in 5 minutes
   - Action: SNS notification
   - Recipients: Engineering team

3. **Lambda Timeout Risk**
   - Threshold: Duration > 25 seconds (80% of 30s timeout)
   - Action: SNS notification
   - Recipients: Engineering team

4. **Lambda Throttles**
   - Threshold: > 5 throttles in 5 minutes
   - Action: SNS notification
   - Recipients: DevOps team

---

## ✅ Verification Checklist

- [ ] CloudWatch Logs retention configured
- [ ] CloudWatch Alarms created
- [ ] CloudWatch Dashboards created
- [ ] CloudWatch Logs Insights queries saved
- [ ] Error tracking tested in dev environment
- [ ] Alerts configured and tested
- [ ] Dashboard access granted to team

---

## 📚 Additional Resources

- [AWS CloudWatch Logs Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/)
- [AWS CloudWatch Metrics Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/)
- [AWS CloudWatch Alarms Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)
- [CloudWatch Logs Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)

---

## 🎯 Summary

**Status:** ✅ **CloudWatch Already Integrated**

**Next Steps:**
1. Configure log retention (5 minutes)
2. Create CloudWatch alarms (30 minutes)
3. Create CloudWatch dashboards (1 hour)
4. Test error tracking (30 minutes)
5. Configure alerts (30 minutes)

**Total Time:** 2-3 hours

**No External Services Required:** CloudWatch is AWS-native and supports India region (ap-south-1)

---

**Last Updated:** 2026-01-28  
**Region:** ap-south-1 (India)  
**Compliance:** ✅ India data residency compliant
