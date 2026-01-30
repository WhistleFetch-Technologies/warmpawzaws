# Manual NAT Instance Setup Guide

## Overview

This guide walks you through manually creating a NAT instance in your existing VPC to replace the NAT Gateway, saving ~$28.50/month (~89% cost reduction).

## Prerequisites

- AWS CLI configured with appropriate permissions
- Access to the dev VPC
- Understanding of your current VPC setup

## Quick Start

Run the automated script:

```bash
./scripts/create-nat-instance-manual.sh dev ap-south-1
```

The script will:
1. ✅ Find your VPC and public subnet
2. ✅ Create security group for NAT instance
3. ✅ Allocate Elastic IP
4. ✅ Create NAT instance (t3.nano)
5. ✅ Associate Elastic IP with instance
6. ✅ Update route tables to use NAT instance

## Manual Steps (If Script Fails)

### Step 1: Find Your VPC

```bash
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=tag:Name,Values=warmpawz-dev-vpc" \
  --query 'Vpcs[0].VpcId' \
  --output text \
  --region ap-south-1)

echo "VPC ID: $VPC_ID"
```

### Step 2: Find Public Subnet

```bash
PUBLIC_SUBNET_ID=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Type,Values=public" \
  --query 'Subnets[0].SubnetId' \
  --output text \
  --region ap-south-1)

echo "Public Subnet: $PUBLIC_SUBNET_ID"
```

### Step 3: Get NAT AMI

```bash
NAT_AMI=$(aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=amzn-ami-vpc-nat-*" "Name=virtualization-type,Values=hvm" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text \
  --region ap-south-1)

echo "NAT AMI: $NAT_AMI"
```

### Step 4: Create Security Group

```bash
NAT_SG_ID=$(aws ec2 create-security-group \
  --group-name "warmpawz-dev-nat-instance-sg" \
  --description "Security group for NAT instance" \
  --vpc-id $VPC_ID \
  --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=warmpawz-dev-nat-instance-sg},{Key=Environment,Value=dev}]" \
  --query 'GroupId' \
  --output text \
  --region ap-south-1)

# Allow all traffic from VPC
VPC_CIDR=$(aws ec2 describe-vpcs --vpc-ids $VPC_ID --query 'Vpcs[0].CidrBlock' --output text --region ap-south-1)

aws ec2 authorize-security-group-ingress \
  --group-id $NAT_SG_ID \
  --protocol tcp \
  --port 0-65535 \
  --cidr $VPC_CIDR \
  --region ap-south-1

aws ec2 authorize-security-group-ingress \
  --group-id $NAT_SG_ID \
  --protocol udp \
  --port 0-65535 \
  --cidr $VPC_CIDR \
  --region ap-south-1

# Allow all outbound
aws ec2 authorize-security-group-egress \
  --group-id $NAT_SG_ID \
  --protocol -1 \
  --port 0 \
  --cidr 0.0.0.0/0 \
  --region ap-south-1

echo "Security Group: $NAT_SG_ID"
```

### Step 5: Allocate Elastic IP

```bash
EIP_ALLOCATION_ID=$(aws ec2 allocate-address \
  --domain vpc \
  --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=warmpawz-dev-nat-instance-eip},{Key=Environment,Value=dev}]" \
  --query 'AllocationId' \
  --output text \
  --region ap-south-1)

echo "Elastic IP: $EIP_ALLOCATION_ID"
```

### Step 6: Create NAT Instance

```bash
NAT_INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $NAT_AMI \
  --instance-type t3.nano \
  --subnet-id $PUBLIC_SUBNET_ID \
  --associate-public-ip-address \
  --security-group-ids $NAT_SG_ID \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=warmpawz-dev-nat-instance},{Key=Environment,Value=dev},{Key=Purpose,Value=NAT}]" \
  --query 'Instances[0].InstanceId' \
  --output text \
  --region ap-south-1)

echo "NAT Instance: $NAT_INSTANCE_ID"

# Wait for instance to be running
aws ec2 wait instance-running --instance-ids $NAT_INSTANCE_ID --region ap-south-1

# CRITICAL: Disable source/dest check
aws ec2 modify-instance-attribute \
  --instance-id $NAT_INSTANCE_ID \
  --no-source-dest-check \
  --region ap-south-1

echo "✅ NAT Instance created and configured"
```

### Step 7: Associate Elastic IP

```bash
aws ec2 associate-address \
  --instance-id $NAT_INSTANCE_ID \
  --allocation-id $EIP_ALLOCATION_ID \
  --region ap-south-1

echo "✅ Elastic IP associated"
```

### Step 8: Update Route Tables

```bash
# Get private route tables
PRIVATE_RT_IDS=$(aws ec2 describe-route-tables \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Type,Values=private" \
  --query 'RouteTables[*].RouteTableId' \
  --output text \
  --region ap-south-1)

# Update each route table
for RT_ID in $PRIVATE_RT_IDS; do
  # Delete existing NAT Gateway route if exists
  aws ec2 delete-route \
    --route-table-id $RT_ID \
    --destination-cidr-block 0.0.0.0/0 \
    --region ap-south-1 2>/dev/null || true
  
  # Create route to NAT instance
  aws ec2 create-route \
    --route-table-id $RT_ID \
    --destination-cidr-block 0.0.0.0/0 \
    --instance-id $NAT_INSTANCE_ID \
    --region ap-south-1
  
  echo "✅ Updated route table: $RT_ID"
done
```

## Verification

### Check NAT Instance Status

```bash
aws ec2 describe-instances \
  --instance-ids $NAT_INSTANCE_ID \
  --query 'Reservations[0].Instances[0].[State.Name,PublicIpAddress,PrivateIpAddress]' \
  --output table \
  --region ap-south-1
```

### Test Connectivity

1. **From Lambda**: Test external API calls (e.g., Razorpay)
2. **Check CloudWatch Logs**: Verify no timeout errors
3. **Monitor NAT Instance**: Check CPU and network metrics

## Monitoring

### CloudWatch Alarms

Create alarms for:
- Instance status check failures
- High CPU utilization (>80%)
- Network throughput

```bash
# Example: CPU utilization alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "warmpawz-dev-nat-instance-high-cpu" \
  --alarm-description "Alert when NAT instance CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=InstanceId,Value=$NAT_INSTANCE_ID \
  --region ap-south-1
```

## Troubleshooting

### Issue: Lambda Cannot Reach Internet

**Check**:
1. NAT instance is running: `aws ec2 describe-instances --instance-ids $NAT_INSTANCE_ID`
2. Route tables point to NAT instance: `aws ec2 describe-route-tables --route-table-ids $RT_ID`
3. Security group allows traffic: `aws ec2 describe-security-groups --group-ids $NAT_SG_ID`
4. Source/dest check is disabled: `aws ec2 describe-instance-attribute --instance-id $NAT_INSTANCE_ID --attribute sourceDestCheck`

### Issue: High CPU Usage

**Solutions**:
1. Upgrade instance type: `t3.micro` or `t3.small`
2. Check for excessive traffic
3. Consider using NAT Gateway for high-traffic scenarios

### Issue: NAT Instance Stopped

**Solutions**:
1. Start instance: `aws ec2 start-instances --instance-ids $NAT_INSTANCE_ID`
2. Enable auto-recovery: Configure in EC2 Console
3. Set up CloudWatch alarm for instance status

## Cost Comparison

| Component | NAT Gateway | NAT Instance | Savings |
|-----------|------------|--------------|---------|
| Base Cost | $32/month | $3.50/month | $28.50 |
| Data Transfer | $0.045/GB | $0.01/GB | Varies |
| **Total** | **~$32/month** | **~$3.50/month** | **~89%** |

## Rollback Plan

If you need to rollback to NAT Gateway:

1. **Update Route Tables**: Point back to NAT Gateway
2. **Terminate NAT Instance**: `aws ec2 terminate-instances --instance-ids $NAT_INSTANCE_ID`
3. **Release Elastic IP**: `aws ec2 release-address --allocation-id $EIP_ALLOCATION_ID`
4. **Delete Security Group**: `aws ec2 delete-security-group --group-id $NAT_SG_ID`

## Related Documentation

- `docs/NAT_INSTANCE_IMPLEMENTATION.md` - Terraform implementation
- `docs/NAT_GATEWAY_ALTERNATIVES_ANALYSIS.md` - Cost analysis
- `scripts/create-nat-instance-manual.sh` - Automated setup script
