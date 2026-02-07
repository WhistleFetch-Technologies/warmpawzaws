# Next Steps - Razorpay NAT Gateway Fix

## ✅ Completed Actions

1. **Diagnostics Run**: Identified NAT Gateway and routing configuration
2. **Security Groups Fixed**: All Lambda security groups now allow HTTPS outbound
3. **VPC Endpoints Verified**: Secrets Manager endpoint exists and is available

## 🧪 Immediate Next Steps

### Step 1: Test Razorpay Connectivity

Run the connectivity test script:

```bash
./scripts/test-razorpay-connectivity.sh dev ap-south-1
```

This will:
- Test API Gateway health
- Attempt a Razorpay API call (should not timeout)
- Check Lambda logs for network errors
- Provide a pass/fail result

**Expected Result**: 
- ✅ Network connectivity OK (may return 400/401/503 but NOT timeout)
- ❌ If timeout occurs, there's still a routing issue

### Step 2: Check CloudWatch Logs

Monitor Lambda function logs for Razorpay API calls:

```bash
# Get Lambda function name
LAMBDA_FUNC=$(aws lambda list-functions --region ap-south-1 \
  --query "Functions[?contains(FunctionName, 'warmpawz-dev-api')].FunctionName" \
  --output text | head -1)

# View recent logs
aws logs tail "/aws/lambda/$LAMBDA_FUNC" --follow --region ap-south-1
```

Look for:
- ✅ Successful API calls to `api.razorpay.com`
- ❌ Timeout errors
- ❌ Network connectivity errors
- ❌ "ECONNREFUSED" or "ENOTFOUND" errors

### Step 3: Test with Real Payment Flow

1. **Create a test booking** through the application
2. **Initiate payment** for the booking
3. **Monitor the flow**:
   - Check if Razorpay order is created
   - Verify no timeout errors
   - Confirm payment gateway responds

## 🔍 If Issues Persist

### Verify Lambda VPC Configuration

Check which subnets Lambda is using:

```bash
LAMBDA_FUNC="warmpawz-dev-api-handler"  # Update with actual function name
aws lambda get-function \
  --function-name "$LAMBDA_FUNC" \
  --region ap-south-1 \
  --query 'Configuration.VpcConfig' \
  --output json
```

**Critical Check**: Ensure Lambda is in **private subnets** that route through NAT Gateway.

### Verify Route Tables

For each subnet Lambda uses, verify routing:

```bash
SUBNET_ID="subnet-0351dcfcb7fddfc5d"  # Replace with actual subnet ID

# Get route table
RT_ID=$(aws ec2 describe-route-tables \
  --filters "Name=association.subnet-id,Values=$SUBNET_ID" \
  --region ap-south-1 \
  --query 'RouteTables[0].RouteTableId' \
  --output text)

# Check routes
aws ec2 describe-route-tables \
  --route-table-ids $RT_ID \
  --region ap-south-1 \
  --query 'RouteTables[0].Routes[?DestinationCidrBlock==`0.0.0.0/0`]' \
  --output json
```

**Expected**: Route to NAT Gateway (not Internet Gateway for private subnets)

### Verify NAT Gateway Status

```bash
VPC_ID="vpc-02a4893e5e582c4d8"  # Your VPC ID

aws ec2 describe-nat-gateways \
  --filter "Name=vpc-id,Values=$VPC_ID" "Name=state,Values=available" \
  --region ap-south-1 \
  --query 'NatGateways[*].[NatGatewayId,State,SubnetId]' \
  --output table
```

**Expected**: At least one NAT Gateway in "available" state

### Check Security Group Egress Rules

```bash
SG_ID="sg-04f3c12d9c3f4fb64"  # Replace with actual security group ID

aws ec2 describe-security-groups \
  --group-ids $SG_ID \
  --region ap-south-1 \
  --query 'SecurityGroups[0].IpPermissionsEgress' \
  --output json
```

**Expected**: Rule allowing all outbound (protocol: -1, CIDR: 0.0.0.0/0)

## 📊 Monitoring

### Set Up CloudWatch Alarms

Monitor for timeout errors:

```bash
LAMBDA_FUNC="warmpawz-dev-api-handler"

aws cloudwatch put-metric-alarm \
  --alarm-name "razorpay-timeout-$ENVIRONMENT" \
  --alarm-description "Alert on Razorpay API timeouts" \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --threshold 25000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=FunctionName,Value=$LAMBDA_FUNC \
  --region ap-south-1
```

### Check API Gateway Metrics

Monitor API Gateway for 504 (Gateway Timeout) errors:

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name 5XXError \
  --dimensions Name=ApiName,Value=warmpawz-api \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region ap-south-1
```

## 🚀 Production Readiness Checklist

Before deploying to production:

- [ ] Connectivity test passes
- [ ] No timeout errors in CloudWatch logs
- [ ] Route tables verified for all Lambda subnets
- [ ] NAT Gateway in high availability (multiple AZs)
- [ ] Security groups allow HTTPS outbound
- [ ] VPC endpoints configured for AWS services
- [ ] CloudWatch alarms configured
- [ ] Load testing completed with real payment flows

## 📝 Scripts Available

All scripts are in the `scripts/` folder:

1. **`diagnose-nat-gateway.sh`** - Full network diagnostics
2. **`fix-lambda-security-groups.sh`** - Fix security group egress rules
3. **`fix-razorpay-nat-issue.sh`** - Complete fix (runs all steps)
4. **`test-razorpay-connectivity.sh`** - Test connectivity (NEW)

## 🆘 Troubleshooting

### Issue: Still Getting Timeouts

1. **Check Lambda Cold Start**: First invocation may timeout due to VPC cold start
2. **Verify Subnet Selection**: Lambda may be using wrong subnet
3. **Check NAT Gateway Limits**: Ensure NAT Gateway isn't throttled
4. **Review Lambda Timeout**: Increase Lambda timeout if needed (currently 30s)

### Issue: 503 Service Unavailable

This is **expected** if Razorpay credentials are not configured. This is NOT a network issue.

### Issue: 502 Bad Gateway

This indicates Lambda error, not network issue. Check Lambda logs for application errors.

## 📞 Support

If issues persist after following all steps:

1. Run full diagnostics: `./scripts/diagnose-nat-gateway.sh dev ap-south-1`
2. Collect CloudWatch logs
3. Document error messages and timestamps
4. Check AWS Service Health Dashboard

---

**Last Updated**: $(date)
**Status**: Security groups fixed, VPC endpoints verified, ready for testing
