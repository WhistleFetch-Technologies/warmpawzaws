# NAT Instance IP Forwarding Configuration

## Issue
The NAT instance was created without IP forwarding enabled, causing Lambda functions in private subnets to be unable to reach external APIs (like Razorpay).

## Solution

### For Existing NAT Instance

The NAT instance `i-0e38af5c56c72cca9` needs to be configured manually:

1. **Via AWS Console (EC2 Instance Connect)**:
   - Go to AWS Console → EC2 → Instances → `i-0e38af5c56c72cca9`
   - Click "Connect" → "EC2 Instance Connect"
   - Run these commands:
   ```bash
   # Enable IP forwarding
   echo 'net.ipv4.ip_forward = 1' | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   
   # Configure iptables NAT
   INTERFACE=$(ip route | grep default | awk '{print $5}' | head -1)
   sudo iptables -t nat -A POSTROUTING -o $INTERFACE -j MASQUERADE
   sudo service iptables save
   
   # Make persistent
   echo "sudo iptables -t nat -A POSTROUTING -o $INTERFACE -j MASQUERADE" | sudo tee -a /etc/rc.local
   sudo chmod +x /etc/rc.local
   ```

2. **Via SSH** (if key pair is available):
   ```bash
   ssh ec2-user@15.206.236.117
   # Then run the commands above
   ```

### For New NAT Instances

The `create-nat-instance-manual.sh` script has been updated to automatically configure IP forwarding via user data when creating new instances.

## Verification

After configuration, test the payment endpoint:
```bash
# Create a pharmacy order
ORDER_ID=$(curl -s -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/pharmacy/orders/create" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"39c84571-b26d-475a-bb38-94975cb8262d","prescriptionId":null,"items":[{"medicine_name":"Test","quantity":1,"unit_price":100}],"deliveryAddress":{"address":"Test","lat":19.0760,"lng":72.8777,"pincode":"400001"},"paymentMethod":"online"}' \
  | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1)

# Test payment endpoint
curl -s -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/pharmacy/orders/${ORDER_ID}/payment" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod":"online"}'
```

Expected: Should return a Razorpay order object instead of "fetch failed" error.
