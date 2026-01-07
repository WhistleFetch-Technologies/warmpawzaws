#!/bin/bash
# Bootstrap Script - ONE-TIME Import of Existing Resources
#
# PURPOSE:
#   Import existing AWS resources into Terraform state
#   This is a MANUAL, ONE-TIME operation for new environments or state recovery
#
# WHEN TO USE:
#   - Setting up a new environment for the first time
#   - Recovering from state corruption
#   - Migrating existing infrastructure to Terraform
#
# WHEN NOT TO USE:
#   - Normal CI/CD deployments (state should already be correct)
#   - Repeated deployments (terraform plan/apply should be idempotent)
#
# STRICT RULES:
#   ❌ DO NOT run this in automated CI/CD pipelines
#   ❌ DO NOT run this during terraform plan
#   ❌ DO NOT run this during terraform apply
#   ✅ Run ONCE manually before first terraform apply
#   ✅ Run ONLY when explicitly needed for state recovery

set -e

echo "============================================================"
echo "🚀 Terraform Bootstrap: Import Existing Resources"
echo "============================================================"
echo ""
echo "⚠️  WARNING: This script modifies Terraform state"
echo "   Only run this for:"
echo "   - First-time environment setup"
echo "   - State corruption recovery"
echo ""

# Ask for confirmation
read -p "Are you sure you want to continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Aborted"
  exit 1
fi

echo ""
echo "📦 Initializing Terraform..."
terraform init -backend-config=backend.hcl

echo ""
echo "🔍 Checking existing resources in AWS..."

# Import CloudFront OACs
echo ""
echo "📦 CloudFront Origin Access Controls..."
for APP in admin vendor customer; do
  OAC_ID=$(aws cloudfront list-origin-access-controls \
    --query "OriginAccessControlList.Items[?Name=='warmpawz-dev-${APP}-oac'].Id" \
    --output text 2>/dev/null || echo "")
  
  if [ -n "$OAC_ID" ] && [ "$OAC_ID" != "None" ]; then
    echo "   Importing ${APP} OAC: ${OAC_ID}"
    terraform import "module.cloudfront.aws_cloudfront_origin_access_control.frontend[\"${APP}\"]" "$OAC_ID" || echo "   ⚠️ Already imported or failed"
  else
    echo "   ℹ️  ${APP} OAC not found in AWS (will be created)"
  fi
done

# Import RDS resources
echo ""
echo "📦 RDS Database Resources..."

# DB Subnet Group
if aws rds describe-db-subnet-groups \
  --db-subnet-group-name warmpawz-dev-db-subnet-group \
  --region ap-south-1 2>/dev/null | grep -q "warmpawz-dev-db-subnet-group"; then
  echo "   Importing DB subnet group..."
  terraform import 'module.rds.aws_db_subnet_group.main' warmpawz-dev-db-subnet-group || echo "   ⚠️ Already imported"
else
  echo "   ℹ️  DB subnet group not found (will be created)"
fi

# RDS Security Group
RDS_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=warmpawz-dev-rds-*" \
  --region ap-south-1 \
  --query 'SecurityGroups[0].GroupId' \
  --output text 2>/dev/null || echo "")

if [ -n "$RDS_SG_ID" ] && [ "$RDS_SG_ID" != "None" ]; then
  echo "   Importing RDS security group: ${RDS_SG_ID}"
  terraform import 'module.rds.aws_security_group.rds' "$RDS_SG_ID" || echo "   ⚠️ Already imported"
else
  echo "   ℹ️  RDS security group not found (will be created)"
fi

# RDS Cluster
if aws rds describe-db-clusters \
  --db-cluster-identifier warmpawz-dev-cluster \
  --region ap-south-1 2>/dev/null | grep -q "warmpawz-dev-cluster"; then
  echo "   Importing RDS cluster..."
  terraform import 'module.rds.aws_rds_cluster.main' warmpawz-dev-cluster || echo "   ⚠️ Already imported"
  
  # RDS Instance
  INSTANCE_ID=$(aws rds describe-db-instances \
    --region ap-south-1 \
    --query "DBInstances[?DBClusterIdentifier=='warmpawz-dev-cluster'].DBInstanceIdentifier" \
    --output text 2>/dev/null | head -1)
  
  if [ -n "$INSTANCE_ID" ] && [ "$INSTANCE_ID" != "None" ]; then
    echo "   Importing RDS instance: ${INSTANCE_ID}"
    terraform import 'module.rds.aws_rds_cluster_instance.main[0]' "$INSTANCE_ID" || echo "   ⚠️ Already imported"
  fi
else
  echo "   ℹ️  RDS cluster not found (will be created)"
fi

echo ""
echo "============================================================"
echo "✅ Bootstrap import completed"
echo "============================================================"
echo ""
echo "Next steps:"
echo "  1. Run: terraform plan"
echo "  2. Review the plan carefully"
echo "  3. Run: terraform apply"
echo ""
echo "Note: S3 buckets use data sources (no imports needed)"
echo "Note: Lambda aliases removed from Terraform (no imports needed)"
echo ""

