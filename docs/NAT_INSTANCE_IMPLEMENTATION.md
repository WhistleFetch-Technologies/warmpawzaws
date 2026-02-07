# NAT Instance Implementation Guide

## Overview

This document describes the implementation of NAT Instance as a cost-optimized alternative to NAT Gateway for the dev environment.

## Cost Savings

- **NAT Gateway**: ~$32/month + $0.045/GB data transfer
- **NAT Instance** (t3.nano): ~$3.50/month + $0.01/GB data transfer
- **Savings**: ~$28.50/month (~89% reduction)

## Implementation Status

✅ **Completed**:
- Added `use_nat_instance` variable to VPC module
- Created NAT instance resource with t3.nano instance type
- Configured security group for NAT instance
- Updated route tables to use NAT instance
- Updated dev environment to use NAT instance

## Configuration Changes

### VPC Module (`infra/modules/vpc/`)

1. **Variables Added** (`variables.tf`):
   - `use_nat_instance`: Boolean to enable NAT instance
   - `nat_instance_type`: EC2 instance type (default: t3.nano)

2. **Resources Created** (`main.tf`):
   - `aws_instance.nat`: NAT instance (t3.nano)
   - `aws_security_group.nat_instance`: Security group for NAT instance
   - `aws_eip.nat_instance`: Elastic IP for NAT instance
   - `aws_eip_association.nat_instance`: Associates EIP with instance

3. **Route Tables Updated**:
   - Private route tables now route through NAT instance when `use_nat_instance = true`

### Dev Environment (`infra/envs/dev/main.tf`)

```hcl
module "vpc" {
  # ... other config ...
  enable_nat_gateway       = false  # Disabled when using NAT instance
  use_nat_instance         = true   # Enable NAT instance
  nat_instance_type        = "t3.nano"
  create_private_endpoints = true
  use_existing_vpc         = true
}
```

## Deployment Steps

### 1. Review Terraform Plan

```bash
cd infra/envs/dev
terraform init
terraform plan
```

### 2. Apply Changes

```bash
terraform apply
```

**Expected Changes**:
- Create NAT instance (t3.nano)
- Create security group for NAT instance
- Create Elastic IP for NAT instance
- Update route tables to use NAT instance
- **Note**: Existing NAT Gateway will remain (if using existing VPC), but route tables will use NAT instance

### 3. Verify NAT Instance

```bash
# Get NAT instance ID
NAT_INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=warmpawz-dev-nat-instance" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text \
  --region ap-south-1)

# Check instance status
aws ec2 describe-instances \
  --instance-ids $NAT_INSTANCE_ID \
  --query 'Reservations[0].Instances[0].[State.Name,PublicIpAddress,PrivateIpAddress]' \
  --output table \
  --region ap-south-1
```

### 4. Test Connectivity

```bash
# Test from Lambda (via API endpoint)
curl -X POST "https://dev.api.warmpawz.com/health"

# Check CloudWatch logs for Lambda function
aws logs tail /aws/lambda/warmpawz-dev-api-handler \
  --follow \
  --region ap-south-1
```

### 5. Monitor NAT Instance

```bash
# Check NAT instance metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name NetworkOut \
  --dimensions Name=InstanceId,Value=$NAT_INSTANCE_ID \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region ap-south-1
```

## Important Notes

### ⚠️ Limitations

1. **Single Point of Failure**: NAT instance is a single EC2 instance (unlike NAT Gateway which is managed)
2. **Manual Management**: Requires manual patching and monitoring
3. **Bandwidth**: t3.nano has up to 5 Gbps (vs NAT Gateway's 45 Gbps)
4. **Existing VPC**: If using existing VPC, route tables may need manual updates

### ✅ Best Practices

1. **Enable CloudWatch Alarms**: Monitor NAT instance health
2. **Auto-Recovery**: Enable EC2 instance auto-recovery
3. **Regular Backups**: Consider AMI snapshots
4. **Security Updates**: Keep NAT AMI updated

### 🔄 Rollback Plan

If issues occur, you can rollback to NAT Gateway:

```hcl
# In infra/envs/dev/main.tf
module "vpc" {
  # ... other config ...
  enable_nat_gateway       = true   # Re-enable NAT Gateway
  use_nat_instance         = false   # Disable NAT instance
  # ...
}
```

Then run:
```bash
terraform apply
```

## Monitoring

### CloudWatch Alarms

Create alarms for:
- NAT instance status check failures
- High CPU utilization
- Network throughput limits

### Cost Monitoring

Monitor costs via AWS Cost Explorer:
- Filter by service: EC2
- Filter by tag: `Purpose = NAT`
- Compare with previous NAT Gateway costs

## Troubleshooting

### Issue: Lambda cannot reach internet

**Symptoms**:
- Timeout errors when calling external APIs (Razorpay)
- Network connectivity errors

**Solutions**:
1. Check NAT instance status: `aws ec2 describe-instances --instance-ids $NAT_INSTANCE_ID`
2. Verify route table: Check that private subnets route `0.0.0.0/0` to NAT instance
3. Check security group: Ensure NAT instance security group allows traffic from VPC
4. Verify source/dest check: Must be disabled (`source_dest_check = false`)

### Issue: NAT instance high CPU

**Symptoms**:
- High CPU utilization (>80%)
- Slow internet connectivity

**Solutions**:
1. Upgrade instance type: Change `nat_instance_type` to `t3.micro` or `t3.small`
2. Check for excessive traffic: Review CloudWatch metrics
3. Consider using NAT Gateway for high-traffic scenarios

## Related Files

- `infra/modules/vpc/main.tf` - NAT instance configuration
- `infra/modules/vpc/variables.tf` - NAT instance variables
- `infra/envs/dev/main.tf` - Dev environment configuration
- `docs/NAT_GATEWAY_ALTERNATIVES_ANALYSIS.md` - Cost analysis

## Next Steps

1. **Deploy to Dev**: Apply Terraform changes
2. **Test Connectivity**: Verify Lambda can reach external APIs
3. **Monitor Costs**: Track monthly savings
4. **Consider Production**: Evaluate NAT instance for production (with HA setup)
