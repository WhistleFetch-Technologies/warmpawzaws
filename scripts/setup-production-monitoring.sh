#!/bin/bash
# ============================================================================
# PRODUCTION MONITORING SETUP
# ============================================================================
# Sets up CloudWatch alarms, dashboards, and monitoring for production

set -e

REGION="ap-south-1"
ENVIRONMENT="dev"
ALARM_EMAIL="alerts@warmpawz.com"

echo "🚀 Setting up Production Monitoring..."

# 1. Create SNS topic for alarms
echo "📧 Creating alarm notification topic..."
ALARM_TOPIC_ARN=$(aws sns create-topic \
  --name warmpawz-${ENVIRONMENT}-production-alarms \
  --region ${REGION} \
  --output text --query 'TopicArn' 2>/dev/null || \
  aws sns list-topics --region ${REGION} --query "Topics[?contains(TopicArn, 'warmpawz-${ENVIRONMENT}-production-alarms')].TopicArn" --output text)

echo "✅ Alarm topic: ${ALARM_TOPIC_ARN}"

# Subscribe email to alarm topic
aws sns subscribe \
  --topic-arn ${ALARM_TOPIC_ARN} \
  --protocol email \
  --notification-endpoint ${ALARM_EMAIL} \
  --region ${REGION} 2>/dev/null || echo "Email subscription already exists"

# 2. Create Lambda error alarms
echo "⚡ Creating Lambda error alarms..."
aws cloudwatch put-metric-alarm \
  --alarm-name "warmpawz-${ENVIRONMENT}-lambda-errors" \
  --alarm-description "Alert on Lambda function errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=FunctionName,Value=warmpawz-${ENVIRONMENT}-api-handler \
  --alarm-actions ${ALARM_TOPIC_ARN} \
  --region ${REGION}

echo "✅ Lambda error alarm created"

# 3. Create Lambda duration alarms
aws cloudwatch put-metric-alarm \
  --alarm-name "warmpawz-${ENVIRONMENT}-lambda-duration" \
  --alarm-description "Alert on Lambda function slow responses" \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --threshold 5000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=FunctionName,Value=warmpawz-${ENVIRONMENT}-api-handler \
  --alarm-actions ${ALARM_TOPIC_ARN} \
  --region ${REGION}

echo "✅ Lambda duration alarm created"

# 4. Create RDS CPU alarms
echo "💾 Creating RDS alarms..."
aws cloudwatch put-metric-alarm \
  --alarm-name "warmpawz-${ENVIRONMENT}-rds-cpu" \
  --alarm-description "Alert on high RDS CPU utilization" \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=DBClusterIdentifier,Value=warmpawz-${ENVIRONMENT}-cluster \
  --alarm-actions ${ALARM_TOPIC_ARN} \
  --region ${REGION}

echo "✅ RDS CPU alarm created"

# 5. Create RDS connection alarms
aws cloudwatch put-metric-alarm \
  --alarm-name "warmpawz-${ENVIRONMENT}-rds-connections" \
  --alarm-description "Alert on high RDS database connections" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=DBClusterIdentifier,Value=warmpawz-${ENVIRONMENT}-cluster \
  --alarm-actions ${ALARM_TOPIC_ARN} \
  --region ${REGION}

echo "✅ RDS connection alarm created"

# 6. Create API Gateway 4xx/5xx alarms
echo "🌐 Creating API Gateway alarms..."
aws cloudwatch put-metric-alarm \
  --alarm-name "warmpawz-${ENVIRONMENT}-api-5xx-errors" \
  --alarm-description "Alert on API Gateway 5xx errors" \
  --metric-name 5XXError \
  --namespace AWS/ApiGateway \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=ApiName,Value=warmpawz-${ENVIRONMENT}-api \
  --alarm-actions ${ALARM_TOPIC_ARN} \
  --region ${REGION}

echo "✅ API Gateway error alarm created"

# 7. Create CloudWatch Dashboard
echo "📊 Creating CloudWatch dashboard..."
cat > /tmp/dashboard-config.json <<EOF
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Invocations", {"stat": "Sum"}],
          [".", "Errors"],
          [".", "Duration", {"stat": "Average"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "${REGION}",
        "title": "Lambda Metrics"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/RDS", "CPUUtilization", {"stat": "Average"}],
          [".", "DatabaseConnections"],
          [".", "ReadLatency"],
          [".", "WriteLatency"]
        ],
        "period": 300,
        "stat": "Average",
        "region": "${REGION}",
        "title": "RDS Metrics"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApiGateway", "Count", {"stat": "Sum"}],
          [".", "4XXError"],
          [".", "5XXError"],
          [".", "Latency", {"stat": "Average"}]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "${REGION}",
        "title": "API Gateway Metrics"
      }
    }
  ]
}
EOF

aws cloudwatch put-dashboard \
  --dashboard-name "warmpawz-${ENVIRONMENT}-production" \
  --dashboard-body file:///tmp/dashboard-config.json \
  --region ${REGION}

echo "✅ CloudWatch dashboard created"

echo ""
echo "✅ Production monitoring setup complete!"
echo ""
echo "📊 Dashboard URL:"
echo "https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=warmpawz-${ENVIRONMENT}-production"
echo ""
echo "⚠️  IMPORTANT: Check your email (${ALARM_EMAIL}) to confirm SNS subscription!"
