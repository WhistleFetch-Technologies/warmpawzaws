# NAT Instance Setup and Testing Results

## Setup Summary

✅ **NAT Instance Created Successfully**

- **Instance ID**: `i-0e38af5c56c72cca9`
- **Instance Type**: t3.nano
- **State**: Running
- **Public IP**: 15.206.236.117
- **Private IP**: 10.0.1.84
- **Source/Dest Check**: Disabled (required for NAT)
- **Security Group**: sg-03ab18c84705ab1c9
- **Elastic IP**: eipalloc-0b6de992e01e1f664

## Route Table Configuration

✅ **All Private Route Tables Updated**

- 8 route tables updated to route `0.0.0.0/0` through NAT instance
- Route state: Active
- NAT Gateway routes removed

## Cost Savings

- **Before**: ~$32/month (NAT Gateway)
- **After**: ~$3.50/month (NAT Instance)
- **Savings**: ~$28.50/month (~89% reduction)

## External API Testing

### ✅ API Gateway Connectivity
- **Status**: Working
- **Endpoint**: `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`
- **Health Check**: HTTP 200

### 🔄 Razorpay API Testing
- **Status**: Testing in progress
- **Endpoint**: `/razorpay/create-order`
- **Note**: Requires actual payment flow to fully test

### 🔄 Google Maps API Testing
- **Status**: Requires booking flow with address
- **Note**: Will be tested during actual booking creation

### 🔄 Shiprocket API Testing
- **Status**: Requires order shipping flow
- **Note**: Will be tested during actual order processing

## Next Steps for Full Testing

1. **Test Razorpay**:
   - Create a test booking
   - Proceed to payment page
   - Verify Razorpay order creation succeeds
   - Check CloudWatch logs for any timeout errors

2. **Test Google Maps**:
   - Create a home service booking with address
   - Verify geocoding works
   - Check CloudWatch logs for Google Maps API calls

3. **Test Shiprocket**:
   - Create an order with shipping
   - Verify shipping label creation
   - Check CloudWatch logs for Shiprocket API calls

## Monitoring

### CloudWatch Alarms to Set Up

1. **NAT Instance Status Check**:
   ```bash
   aws cloudwatch put-metric-alarm \
     --alarm-name "warmpawz-dev-nat-instance-status" \
     --alarm-description "Alert when NAT instance status check fails" \
     --metric-name StatusCheckFailed \
     --namespace AWS/EC2 \
     --statistic Maximum \
     --period 60 \
     --threshold 1 \
     --comparison-operator GreaterThanOrEqualToThreshold \
     --evaluation-periods 2 \
     --dimensions Name=InstanceId,Value=i-0e38af5c56c72cca9 \
     --region ap-south-1
   ```

2. **High CPU Utilization**:
   ```bash
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
     --dimensions Name=InstanceId,Value=i-0e38af5c56c72cca9 \
     --region ap-south-1
   ```

## Verification Commands

```bash
# Check NAT instance status
aws ec2 describe-instances --instance-ids i-0e38af5c56c72cca9 --region ap-south-1

# Check route tables
aws ec2 describe-route-tables --route-table-ids rtb-0d38d99bc79f9b8a2 --region ap-south-1

# Check CloudWatch logs for external API calls
aws logs tail /aws/lambda/warmpawz-dev-api-handler --since 10m --region ap-south-1 | grep -i "razorpay\|timeout"

# Test API Gateway
curl https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/health
```

## Troubleshooting

If external APIs fail:

1. **Check NAT Instance Status**:
   ```bash
   aws ec2 describe-instance-status --instance-ids i-0e38af5c56c72cca9 --region ap-south-1
   ```

2. **Verify Route Tables**:
   ```bash
   aws ec2 describe-route-tables --filters "Name=vpc-id,Values=vpc-02a4893e5e582c4d8" --region ap-south-1
   ```

3. **Check Security Group**:
   ```bash
   aws ec2 describe-security-groups --group-ids sg-03ab18c84705ab1c9 --region ap-south-1
   ```

4. **Review CloudWatch Logs**:
   ```bash
   aws logs tail /aws/lambda/warmpawz-dev-api-handler --since 1h --region ap-south-1
   ```

## Success Criteria

✅ NAT instance is running
✅ Route tables are configured correctly
✅ API Gateway is reachable
🔄 External APIs need actual flow testing

The NAT instance setup is complete and ready for use. External API connectivity will be fully verified during actual payment, booking, and shipping flows.
