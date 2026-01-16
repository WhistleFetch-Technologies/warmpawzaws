#!/bin/bash
# Script to get existing AWS resource information

echo "🔍 Gathering Existing AWS Resources..."
echo "===================================="
echo ""

# RDS Cluster
echo "📊 RDS Cluster:"
aws rds describe-db-clusters \
  --db-cluster-identifier warmpawz-dev-cluster \
  --region ap-south-1 \
  --query 'DBClusters[0].{Endpoint:Endpoint,Port:Port,DatabaseName:DatabaseName,Status:Status}' \
  2>/dev/null || echo "  ⚠️  Cluster not found or access denied"

# RDS Secret
echo ""
echo "🔐 RDS Secret:"
aws secretsmanager list-secrets \
  --region ap-south-1 \
  --query 'SecretList[?starts_with(Name, `warmpawz-dev-rds`)].{Name:Name,ARN:ARN}' \
  2>/dev/null || echo "  ⚠️  Secret not found"

# S3 Buckets
echo ""
echo "🪣 S3 Buckets:"
aws s3 ls | grep warmpawz-dev || echo "  ⚠️  No buckets found"

# Lambda Functions
echo ""
echo "⚡ Lambda Functions:"
aws lambda list-functions \
  --region ap-south-1 \
  --query 'Functions[?contains(FunctionName, `warmpawz-dev`)].FunctionName' \
  --output table \
  2>/dev/null || echo "  ⚠️  Functions not found"

# API Gateway
echo ""
echo "🌐 API Gateway:"
aws apigatewayv2 get-apis \
  --region ap-south-1 \
  --query 'Items[?contains(Name, `warmpawz`)].{Name:Name,ApiId:ApiId,ApiEndpoint:ApiEndpoint}' \
  --output table \
  2>/dev/null || echo "  ⚠️  API Gateway not found"

# Cognito Pools
echo ""
echo "🔐 Cognito User Pools:"
aws cognito-idp list-user-pools \
  --max-results 10 \
  --region ap-south-1 \
  --query 'UserPools[?contains(Name, `warmpawz`) || contains(Name, `Warmpawz`)].{Name:Name,Id:Id}' \
  --output table \
  2>/dev/null || echo "  ⚠️  Pools not found"

echo ""
echo "✅ Resource gathering complete"
