#!/bin/bash
# Script to run list-solo-vendors-services.js with proper environment variables
# Update the ARNs below with your actual values from AWS Console

export AWS_REGION="ap-south-1"

# RDS Cluster ARN - Updated to use correct cluster identifier
export DB_CLUSTER_ARN="${DB_CLUSTER_ARN:-arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-dev-cluster}"

# Secrets Manager ARN - Found via find-db-secret-arn.js script
export DB_SECRET_ARN="${DB_SECRET_ARN:-arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI}"

echo "🔍 Running solo vendors query..."
echo "   Region: $AWS_REGION"
echo "   Cluster ARN: $DB_CLUSTER_ARN"
echo "   Secret ARN: $DB_SECRET_ARN"
echo ""

# Run the script
node scripts/list-solo-vendors-services.js
