# Production Migration Solution: Adding specializations Column

## Problem
- **Error**: `column "specializations" of relation "vendors" does not exist`
- **Root Cause**: Migration 402 (which adds this column) hasn't been run on production
- **Network Issue**: RDS cluster is in private subnets, not directly accessible from internet

## Migration File Created
✅ `db/migrations/559_add_vendors_specializations_column.sql`

## Solution Options

### Option 1: AWS CloudShell (Recommended if VPC access configured)

1. Open AWS CloudShell in the AWS Console
2. Clone/download the migration file
3. Run:
```bash
cd warmpawzApp/warmpawzaws
ENVIRONMENT=prod node scripts/run-migration-rds-node.js 559_add_vendors_specializations_column.sql
```

### Option 2: AWS Systems Manager Session Manager

If you have an EC2 instance in the production VPC with SSM agent:

1. Connect via Session Manager:
```bash
aws ssm start-session --target <instance-id> --region ap-south-1
```

2. Once connected, run:
```bash
cd /path/to/warmpawzApp/warmpawzaws
ENVIRONMENT=prod node scripts/run-migration-rds-node.js 559_add_vendors_specializations_column.sql
```

### Option 3: Create Temporary EC2 Instance

1. Launch a small EC2 instance (t3.micro) in the production VPC
2. Ensure it has:
   - Systems Manager agent (default on Amazon Linux 2)
   - Security group that allows outbound to RDS
   - IAM role with RDS and Secrets Manager access
3. Connect via Session Manager and run the migration
4. Terminate the instance after migration

### Option 4: Lambda Migration Runner (If exists)

If a Lambda migration runner exists for production:

1. Invoke the Lambda with the migration file
2. Lambda runs from within VPC and can access RDS

## Network Configuration

- **VPC**: `vpc-02a4893e5e582c4d8`
- **RDS Security Group**: `sg-0bd51c91891ee040b`
- **RDS Endpoint**: `warmpawz-prod-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com`
- **RDS Proxy**: `warmpawz-prod-proxy.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com` (also in private subnet)

## Verification

After running the migration, verify:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vendors' AND column_name = 'specializations';
```

Should return:
- `column_name`: `specializations`
- `data_type`: `jsonb`

## Next Steps

1. Choose one of the options above
2. Run the migration
3. Verify the column exists
4. Test the API endpoint: `GET /vendor/facility/:vendorId`
