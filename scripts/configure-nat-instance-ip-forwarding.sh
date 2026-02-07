#!/bin/bash

# ============================================================================
# Configure NAT Instance IP Forwarding
# ============================================================================
# This script configures IP forwarding and iptables rules on an existing
# NAT instance to enable NAT functionality.
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${ENVIRONMENT:-dev}"
AWS_REGION="${AWS_REGION:-ap-south-1}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Configure NAT Instance IP Forwarding${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Find NAT instance
echo -e "${BLUE}Step 1: Finding NAT Instance${NC}"
NAT_INSTANCE_ID=$(aws ec2 describe-instances \
  --region $AWS_REGION \
  --filters "Name=tag:Name,Values=warmpawz-${ENVIRONMENT}-nat-instance" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text 2>/dev/null || echo "")

if [ -z "$NAT_INSTANCE_ID" ] || [ "$NAT_INSTANCE_ID" == "None" ]; then
  echo -e "${RED}❌ NAT instance not found${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Found NAT Instance: $NAT_INSTANCE_ID${NC}"
echo ""

# Step 2: Get instance details
echo -e "${BLUE}Step 2: Getting Instance Details${NC}"
INSTANCE_INFO=$(aws ec2 describe-instances \
  --region $AWS_REGION \
  --instance-ids $NAT_INSTANCE_ID \
  --query 'Reservations[0].Instances[0].{PublicIp:PublicIpAddress,PrivateIp:PrivateIpAddress,SubnetId:SubnetId}' \
  --output json)

PUBLIC_IP=$(echo $INSTANCE_INFO | grep -o '"PublicIp":"[^"]*"' | cut -d'"' -f4)
PRIVATE_IP=$(echo $INSTANCE_INFO | grep -o '"PrivateIp":"[^"]*"' | cut -d'"' -f4)
SUBNET_ID=$(echo $INSTANCE_INFO | grep -o '"SubnetId":"[^"]*"' | cut -d'"' -f4)

echo -e "${GREEN}   Public IP: $PUBLIC_IP${NC}"
echo -e "${GREEN}   Private IP: $PRIVATE_IP${NC}"
echo ""

# Step 3: Get VPC CIDR
echo -e "${BLUE}Step 3: Getting VPC CIDR${NC}"
VPC_ID=$(aws ec2 describe-subnets --region $AWS_REGION --subnet-ids $SUBNET_ID --query 'Subnets[0].VpcId' --output text)
VPC_CIDR=$(aws ec2 describe-vpcs --region $AWS_REGION --vpc-ids $VPC_ID --query 'Vpcs[0].CidrBlock' --output text)

echo -e "${GREEN}   VPC ID: $VPC_ID${NC}"
echo -e "${GREEN}   VPC CIDR: $VPC_CIDR${NC}"
echo ""

# Step 4: Create user data script for IP forwarding
echo -e "${BLUE}Step 4: Creating IP Forwarding Configuration${NC}"
USER_DATA_SCRIPT=$(cat <<'EOF'
#!/bin/bash
# Enable IP forwarding
echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
sysctl -p

# Configure iptables NAT rules
# Flush existing NAT rules
iptables -t nat -F
iptables -t nat -X

# Enable NAT for traffic from VPC
# Get the primary network interface
INTERFACE=$(ip route | grep default | awk '{print $5}' | head -1)
iptables -t nat -A POSTROUTING -o $INTERFACE -j MASQUERADE

# Save iptables rules (for Amazon Linux 2)
service iptables save 2>/dev/null || true

# Make rules persistent across reboots
echo "iptables -t nat -A POSTROUTING -o $INTERFACE -j MASQUERADE" >> /etc/rc.local
chmod +x /etc/rc.local

# Verify configuration
echo "IP Forwarding Status:"
sysctl net.ipv4.ip_forward
echo ""
echo "NAT Rules:"
iptables -t nat -L -n -v
EOF
)

# Base64 encode user data
USER_DATA_B64=$(echo "$USER_DATA_SCRIPT" | base64)

echo -e "${GREEN}✅ Configuration script created${NC}"
echo ""

# Step 5: Instructions for manual configuration
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}⚠️  Manual Configuration Required${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Since the NAT instance already exists, you need to configure it manually."
echo ""
echo "Option 1: Use EC2 Instance Connect (Recommended)"
echo "  1. Go to AWS Console → EC2 → Instances → $NAT_INSTANCE_ID"
echo "  2. Click 'Connect' → 'EC2 Instance Connect'"
echo "  3. Run the following commands:"
echo ""
echo -e "${GREEN}# Enable IP forwarding${NC}"
echo "echo 'net.ipv4.ip_forward = 1' | sudo tee -a /etc/sysctl.conf"
echo "sudo sysctl -p"
echo ""
echo -e "${GREEN}# Configure iptables NAT${NC}"
echo "INTERFACE=\$(ip route | grep default | awk '{print \$5}' | head -1)"
echo "sudo iptables -t nat -A POSTROUTING -o \$INTERFACE -j MASQUERADE"
echo "sudo service iptables save"
echo ""
echo "Option 2: Use SSH (if key pair is available)"
echo "  ssh ec2-user@$PUBLIC_IP"
echo "  (Then run the commands above)"
echo ""
echo "Option 3: Recreate instance with user data"
echo "  The instance can be recreated with user data that configures IP forwarding automatically."
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
