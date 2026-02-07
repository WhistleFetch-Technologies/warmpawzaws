# NAT Gateway Configuration for Razorpay API Access

## Problem

Lambda functions in private subnets are timing out when trying to communicate with Razorpay API (`api.razorpay.com`). This is caused by missing or incorrect NAT Gateway routing configuration.

## Root Cause

When Lambda functions are deployed in private subnets (which is the case for accessing RDS), they require a NAT Gateway to access the internet. If the route tables for private subnets are not properly configured to route `0.0.0.0/0` through the NAT Gateway, Lambda cannot reach external APIs like Razorpay.

## Symptoms

- Razorpay API calls timing out
- Error messages like "Payment gateway request timed out"
- Network connectivity errors when calling `api.razorpay.com`
- Lambda functions can access RDS but not external APIs

## Solution

### 1. Verify NAT Gateway Exists

```bash
# Run the diagnostic script
./scripts/diagnose-nat-gateway.sh dev ap-south-1

# Or manually check
aws ec2 describe-nat-gateways \
  --filter "Name=vpc-id,Values=<VPC_ID>" \
  --region ap-south-1
```

### 2. Verify Route Table Configuration

Private subnets used by Lambda must have route tables that route `0.0.0.0/0` through the NAT Gateway:

```bash
# Get subnet IDs used by Lambda (from SSM or serverless.yml)
SUBNET_ID1=$(aws ssm get-parameter --name "/warmpawz/dev/vpc/subnetId1" --query 'Parameter.Value' --output text)
SUBNET_ID2=$(aws ssm get-parameter --name "/warmpawz/dev/vpc/subnetId2" --query 'Parameter.Value' --output text)

# Check route tables for each subnet
aws ec2 describe-route-tables \
  --filters "Name=association.subnet-id,Values=$SUBNET_ID1" \
  --region ap-south-1

# Verify route table has route: 0.0.0.0/0 -> nat-gateway-id
```

### 3. Fix Route Table (if needed)

If route table is missing NAT Gateway route:

```bash
# Get NAT Gateway ID
NAT_GW_ID=$(aws ec2 describe-nat-gateways \
  --filter "Name=vpc-id,Values=<VPC_ID>" "Name=state,Values=available" \
  --query 'NatGateways[0].NatGatewayId' \
  --output text)

# Get Route Table ID for private subnet
RT_ID=$(aws ec2 describe-route-tables \
  --filters "Name=association.subnet-id,Values=<PRIVATE_SUBNET_ID>" \
  --query 'RouteTables[0].RouteTableId' \
  --output text)

# Add route through NAT Gateway
aws ec2 create-route \
  --route-table-id $RT_ID \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id $NAT_GW_ID \
  --region ap-south-1
```

### 4. Verify Security Group

Lambda security group must allow HTTPS outbound:

```bash
# Check Lambda security group
SG_ID=$(aws ssm get-parameter --name "/warmpawz/dev/vpc/securityGroupId" --query 'Parameter.Value' --output text)

aws ec2 describe-security-groups \
  --group-ids $SG_ID \
  --region ap-south-1 \
  --query 'SecurityGroups[0].IpPermissionsEgress'
```

The security group should have an egress rule allowing:
- Protocol: `-1` (all) or `tcp`
- Port: `443` or `0-65535`
- Destination: `0.0.0.0/0`

### 5. Enable VPC Endpoints (Recommended)

VPC endpoints for Secrets Manager reduce NAT Gateway dependency and improve security:

The infrastructure code has been updated to create VPC endpoints even when using an existing VPC. To apply:

```bash
cd infra/envs/dev
terraform plan
terraform apply
```

This will create:
- VPC Endpoint for Secrets Manager (reduces NAT dependency for config loading)
- VPC Endpoint for SNS (if needed)
- VPC Endpoint for SQS (if needed)

## Verification

After fixing the route tables, test Razorpay connectivity:

```bash
# Test from Lambda (via API endpoint)
curl -X POST "https://<API_GATEWAY_URL>/razorpay/create-order" \
  -H "Content-Type: application/json" \
  -d '{"bookingId": "test", "amount": 100}'
```

Check CloudWatch logs for Lambda function to see if requests are successful.

## Infrastructure Changes Made

1. **VPC Endpoints**: Updated `infra/modules/vpc/main.tf` to create VPC endpoints even when using existing VPC
2. **Dev Environment**: Enabled `create_private_endpoints = true` in `infra/envs/dev/main.tf`
3. **Error Handling**: Enhanced Razorpay client error messages to detect network issues
4. **Diagnostic Script**: Created `scripts/diagnose-nat-gateway.sh` to help diagnose routing issues

## Important Notes

- **NAT Gateway is still required** for Razorpay API access (api.razorpay.com) even with VPC endpoints
- VPC endpoints only help with AWS services (Secrets Manager, SNS, SQS)
- Route tables must be manually configured if using existing VPC (Terraform can't modify them)
- Security groups must allow HTTPS outbound (port 443)

## Troubleshooting

If issues persist after fixing route tables:

1. **Check NAT Gateway Status**: Ensure NAT Gateway is in "available" state
2. **Check Route Table Associations**: Verify private subnets are associated with correct route tables
3. **Test DNS Resolution**: Lambda should be able to resolve `api.razorpay.com`
4. **Check CloudWatch Logs**: Look for network timeout errors in Lambda logs
5. **Verify Subnet IDs**: Ensure Lambda is using the correct private subnet IDs from SSM

## Related Files

- `infra/modules/vpc/main.tf` - VPC and NAT Gateway configuration
- `infra/envs/dev/main.tf` - Environment-specific VPC settings
- `backend/lambda/serverless.yml` - Lambda VPC configuration
- `backend/lambda/src/utils/razorpay-client.ts` - Razorpay API client with error handling
- `scripts/diagnose-nat-gateway.sh` - Diagnostic script
