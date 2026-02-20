# Run Migration 559: Add specializations Column (PRODUCTION)

## Quick Start

### Option 1: AWS CloudShell (Recommended - Simplest)

1. **Open AWS CloudShell** in AWS Console (region: ap-south-1)
2. **Clone or upload the repository**:
   ```bash
   # If you have git access
   git clone <repo-url>
   cd warmpawzApp/warmpawzaws
   
   # OR upload the migration file manually
   # Use CloudShell's upload feature to upload the entire warmpawzApp/warmpawzaws directory
   ```

3. **Run the migration**:
   ```bash
   chmod +x scripts/run-migration-559-prod.sh
   ./scripts/run-migration-559-prod.sh
   ```

### Option 2: Direct Node.js Script (If CloudShell has VPC access)

```bash
cd warmpawzApp/warmpawzaws
ENVIRONMENT=prod node scripts/run-migration-rds-node.js 559_add_vendors_specializations_column.sql
```

### Option 3: EC2 Instance via Systems Manager

If CloudShell doesn't have VPC access:

1. **Find or create EC2 instance in VPC**:
   ```bash
   # List instances in VPC
   aws ec2 describe-instances \
     --region ap-south-1 \
     --filters "Name=vpc-id,Values=vpc-02a4893e5e582c4d8" \
     --query 'Reservations[*].Instances[*].{InstanceId:InstanceId,State:State.Name}'
   ```

2. **Connect via Session Manager**:
   ```bash
   aws ssm start-session --target <instance-id> --region ap-south-1
   ```

3. **Run migration from the instance**:
   ```bash
   cd /path/to/warmpawzApp/warmpawzaws
   ./scripts/run-migration-559-prod.sh
   ```

## What This Migration Does

- Adds `specializations` JSONB column to `vendors` table
- Creates GIN index for efficient querying
- Sets default value to `[]` (empty array)
- **Idempotent**: Safe to run multiple times

## Verification

After running, verify the column exists:

```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'vendors' AND column_name = 'specializations';
```

Expected result:
- `column_name`: `specializations`
- `data_type`: `jsonb`
- `column_default`: `'[]'::jsonb`

## Troubleshooting

### Connection Timeout
- **Cause**: RDS is in private subnets, not accessible from internet
- **Solution**: Run from AWS CloudShell or EC2 instance in the VPC

### Permission Denied
- **Cause**: AWS credentials don't have RDS/Secrets Manager access
- **Solution**: Ensure IAM user/role has:
  - `rds:DescribeDBClusters`
  - `secretsmanager:GetSecretValue`
  - Network access to RDS (via VPC)

### Migration File Not Found
- **Cause**: Wrong directory or file path
- **Solution**: Ensure you're in `warmpawzApp/warmpawzaws` directory

## Network Configuration

- **VPC**: `vpc-02a4893e5e582c4d8`
- **RDS Cluster**: `warmpawz-prod-cluster`
- **RDS Endpoint**: `warmpawz-prod-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com`
- **Security Group**: `sg-0bd51c91891ee040b`

## After Migration

1. ✅ Test API endpoint: `GET /vendor/facility/:vendorId`
2. ✅ Error should be resolved: `column "specializations" does not exist`
3. ✅ Column is available for vendor profile and service discovery
