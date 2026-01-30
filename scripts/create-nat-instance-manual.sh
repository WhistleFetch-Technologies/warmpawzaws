#!/bin/bash
# ============================================================================
# Manual NAT Instance Creation Script for Existing VPC
# ============================================================================
# This script creates a NAT instance in an existing VPC and updates route tables
# Cost: ~$3.50/month (t3.nano) vs ~$32/month (NAT Gateway)
# Savings: ~$28.50/month (~89% reduction)
# ============================================================================

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-ap-south-1}

echo "🔧 Manual NAT Instance Creation for Existing VPC"
echo "=================================================="
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Step 1: Get VPC ID
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Finding VPC${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=tag:Name,Values=warmpawz-${ENVIRONMENT}-vpc" \
  --query 'Vpcs[0].VpcId' \
  --output text \
  --region $AWS_REGION 2>/dev/null || echo "")

if [ -z "$VPC_ID" ] || [ "$VPC_ID" == "None" ]; then
  echo -e "${RED}❌ VPC not found. Please check the VPC name tag.${NC}"
  exit 1
fi

VPC_CIDR=$(aws ec2 describe-vpcs \
  --vpc-ids $VPC_ID \
  --query 'Vpcs[0].CidrBlock' \
  --output text \
  --region $AWS_REGION)

echo -e "${GREEN}✅ Found VPC: $VPC_ID${NC}"
echo "   CIDR: $VPC_CIDR"
echo ""

# Step 2: Get Public Subnet
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Finding Public Subnet${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

PUBLIC_SUBNET_ID=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Type,Values=public" \
  --query 'Subnets[0].SubnetId' \
  --output text \
  --region $AWS_REGION 2>/dev/null || echo "")

if [ -z "$PUBLIC_SUBNET_ID" ] || [ "$PUBLIC_SUBNET_ID" == "None" ]; then
  echo -e "${RED}❌ Public subnet not found. Please check subnet tags.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Found Public Subnet: $PUBLIC_SUBNET_ID${NC}"
echo ""

# Step 3: Get NAT AMI
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Finding NAT AMI${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

NAT_AMI=$(aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=amzn-ami-vpc-nat-*" "Name=virtualization-type,Values=hvm" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text \
  --region $AWS_REGION 2>/dev/null || echo "")

if [ -z "$NAT_AMI" ] || [ "$NAT_AMI" == "None" ]; then
  echo -e "${YELLOW}⚠️  NAT AMI not found. Using Amazon Linux 2 instead.${NC}"
  NAT_AMI=$(aws ec2 describe-images \
    --owners amazon \
    --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" "Name=state,Values=available" \
    --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
    --output text \
    --region $AWS_REGION)
fi

echo -e "${GREEN}✅ Using AMI: $NAT_AMI${NC}"
echo ""

# Step 4: Create Security Group
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4: Creating Security Group${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if security group already exists
EXISTING_SG=$(aws ec2 describe-security-groups \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=warmpawz-${ENVIRONMENT}-nat-instance-sg" \
  --query 'SecurityGroups[0].GroupId' \
  --output text \
  --region $AWS_REGION 2>/dev/null || echo "")

if [ -n "$EXISTING_SG" ] && [ "$EXISTING_SG" != "None" ]; then
  echo -e "${YELLOW}⚠️  Security group already exists: $EXISTING_SG${NC}"
  NAT_SG_ID=$EXISTING_SG
else
  NAT_SG_ID=$(aws ec2 create-security-group \
    --group-name "warmpawz-${ENVIRONMENT}-nat-instance-sg" \
    --description "Security group for NAT instance" \
    --vpc-id $VPC_ID \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=warmpawz-${ENVIRONMENT}-nat-instance-sg},{Key=Environment,Value=${ENVIRONMENT}}]" \
    --query 'GroupId' \
    --output text \
    --region $AWS_REGION)

  # Add ingress rule (allow all from VPC)
  aws ec2 authorize-security-group-ingress \
    --group-id $NAT_SG_ID \
    --protocol tcp \
    --port 0-65535 \
    --cidr $VPC_CIDR \
    --region $AWS_REGION > /dev/null 2>&1 || true

  aws ec2 authorize-security-group-ingress \
    --group-id $NAT_SG_ID \
    --protocol udp \
    --port 0-65535 \
    --cidr $VPC_CIDR \
    --region $AWS_REGION > /dev/null 2>&1 || true

  # Add egress rule (allow all outbound)
  aws ec2 authorize-security-group-egress \
    --group-id $NAT_SG_ID \
    --protocol -1 \
    --port 0 \
    --cidr 0.0.0.0/0 \
    --region $AWS_REGION > /dev/null 2>&1 || true

  echo -e "${GREEN}✅ Created Security Group: $NAT_SG_ID${NC}"
fi
echo ""

# Step 5: Allocate Elastic IP
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 5: Allocating Elastic IP${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if EIP already exists
EXISTING_EIP=$(aws ec2 describe-addresses \
  --filters "Name=tag:Name,Values=warmpawz-${ENVIRONMENT}-nat-instance-eip" \
  --query 'Addresses[0].AllocationId' \
  --output text \
  --region $AWS_REGION 2>/dev/null || echo "")

if [ -n "$EXISTING_EIP" ] && [ "$EXISTING_EIP" != "None" ]; then
  echo -e "${YELLOW}⚠️  Elastic IP already exists: $EXISTING_EIP${NC}"
  EIP_ALLOCATION_ID=$EXISTING_EIP
else
  # Try to allocate new EIP, but if limit exceeded, try to find unused EIP
  EIP_ALLOCATION_ID=$(aws ec2 allocate-address \
    --domain vpc \
    --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=warmpawz-${ENVIRONMENT}-nat-instance-eip},{Key=Environment,Value=${ENVIRONMENT}}]" \
    --query 'AllocationId' \
    --output text \
    --region $AWS_REGION 2>/dev/null || echo "")

  if [ -z "$EIP_ALLOCATION_ID" ] || [ "$EIP_ALLOCATION_ID" == "None" ]; then
    echo -e "${YELLOW}⚠️  Elastic IP limit reached. Looking for unused EIP...${NC}"
    # Find an unused Elastic IP
    UNUSED_EIP=$(aws ec2 describe-addresses \
      --filters "Name=domain,Values=vpc" \
      --query 'Addresses[?AssociationId==`null`].[AllocationId] | [0][0]' \
      --output text \
      --region $AWS_REGION 2>/dev/null || echo "")
    
    if [ -n "$UNUSED_EIP" ] && [ "$UNUSED_EIP" != "None" ]; then
      echo -e "${YELLOW}   Found unused EIP: $UNUSED_EIP${NC}"
      # Tag it for our use
      aws ec2 create-tags \
        --resources $UNUSED_EIP \
        --tags "Key=Name,Value=warmpawz-${ENVIRONMENT}-nat-instance-eip" "Key=Environment,Value=${ENVIRONMENT}" \
        --region $AWS_REGION > /dev/null 2>&1 || true
      EIP_ALLOCATION_ID=$UNUSED_EIP
      echo -e "${GREEN}✅ Using existing unused Elastic IP: $EIP_ALLOCATION_ID${NC}"
    else
      echo -e "${RED}❌ Cannot allocate Elastic IP and no unused EIPs found.${NC}"
      echo -e "${YELLOW}   Please release an unused Elastic IP or increase your limit.${NC}"
      exit 1
    fi
  else
    echo -e "${GREEN}✅ Allocated Elastic IP: $EIP_ALLOCATION_ID${NC}"
  fi
fi
echo ""

# Step 6: Create NAT Instance
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 6: Creating NAT Instance${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if NAT instance already exists
EXISTING_INSTANCE=$(aws ec2 describe-instances \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=warmpawz-${ENVIRONMENT}-nat-instance" "Name=instance-state-name,Values=running,stopped,stopping" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text \
  --region $AWS_REGION 2>/dev/null || echo "")

if [ -n "$EXISTING_INSTANCE" ] && [ "$EXISTING_INSTANCE" != "None" ]; then
  echo -e "${YELLOW}⚠️  NAT instance already exists: $EXISTING_INSTANCE${NC}"
  NAT_INSTANCE_ID=$EXISTING_INSTANCE
  
  # Check if instance is stopped
  INSTANCE_STATE=$(aws ec2 describe-instances \
    --instance-ids $NAT_INSTANCE_ID \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text \
    --region $AWS_REGION)
  
  if [ "$INSTANCE_STATE" == "stopped" ]; then
    echo -e "${YELLOW}   Instance is stopped. Starting...${NC}"
    aws ec2 start-instances --instance-ids $NAT_INSTANCE_ID --region $AWS_REGION > /dev/null
    echo -e "${GREEN}   ✅ Instance starting...${NC}"
  fi
else
  echo "Creating NAT instance (t3.nano)..."
  
  # Create user data script to configure IP forwarding
  USER_DATA_SCRIPT="#!/bin/bash
# Enable IP forwarding
echo 'net.ipv4.ip_forward = 1' >> /etc/sysctl.conf
sysctl -p

# Configure iptables NAT rules
INTERFACE=\$(ip route | grep default | awk '{print \$5}' | head -1)
iptables -t nat -A POSTROUTING -o \$INTERFACE -j MASQUERADE

# Save iptables rules
service iptables save 2>/dev/null || iptables-save > /etc/sysconfig/iptables

# Make persistent
echo 'iptables -t nat -A POSTROUTING -o \$INTERFACE -j MASQUERADE' >> /etc/rc.local
chmod +x /etc/rc.local
"
  
  USER_DATA_B64=$(echo "$USER_DATA_SCRIPT" | base64)
  
  NAT_INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $NAT_AMI \
    --instance-type t3.nano \
    --subnet-id $PUBLIC_SUBNET_ID \
    --associate-public-ip-address \
    --security-group-ids $NAT_SG_ID \
    --user-data "$USER_DATA_B64" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=warmpawz-${ENVIRONMENT}-nat-instance},{Key=Environment,Value=${ENVIRONMENT}},{Key=Purpose,Value=NAT}]" \
    --query 'Instances[0].InstanceId' \
    --output text \
    --region $AWS_REGION)

  echo -e "${GREEN}✅ Created NAT Instance: $NAT_INSTANCE_ID${NC}"
  echo "   Waiting for instance to be running..."
  
  aws ec2 wait instance-running --instance-ids $NAT_INSTANCE_ID --region $AWS_REGION
  echo -e "${GREEN}   ✅ Instance is running${NC}"
  
  # Disable source/dest check (CRITICAL for NAT functionality)
  aws ec2 modify-instance-attribute \
    --instance-id $NAT_INSTANCE_ID \
    --no-source-dest-check \
    --region $AWS_REGION > /dev/null
  
  echo -e "${GREEN}   ✅ Disabled source/dest check${NC}"
fi
echo ""

# Step 7: Associate Elastic IP
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 7: Associating Elastic IP${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if EIP is already associated
EIP_ASSOCIATION=$(aws ec2 describe-addresses \
  --allocation-ids $EIP_ALLOCATION_ID \
  --query 'Addresses[0].InstanceId' \
  --output text \
  --region $AWS_REGION 2>/dev/null || echo "")

if [ -n "$EIP_ASSOCIATION" ] && [ "$EIP_ASSOCIATION" != "None" ] && [ "$EIP_ASSOCIATION" == "$NAT_INSTANCE_ID" ]; then
  echo -e "${YELLOW}⚠️  Elastic IP already associated with instance${NC}"
else
  # Release existing association if any
  if [ -n "$EIP_ASSOCIATION" ] && [ "$EIP_ASSOCIATION" != "None" ] && [ "$EIP_ASSOCIATION" != "$NAT_INSTANCE_ID" ]; then
    echo -e "${YELLOW}   Releasing existing association...${NC}"
    aws ec2 disassociate-address --association-id $(aws ec2 describe-addresses --allocation-ids $EIP_ALLOCATION_ID --query 'Addresses[0].AssociationId' --output text --region $AWS_REGION) --region $AWS_REGION > /dev/null 2>&1 || true
  fi
  
  # Associate EIP with NAT instance
  aws ec2 associate-address \
    --instance-id $NAT_INSTANCE_ID \
    --allocation-id $EIP_ALLOCATION_ID \
    --region $AWS_REGION > /dev/null
  
  echo -e "${GREEN}✅ Associated Elastic IP with NAT instance${NC}"
fi
echo ""

# Step 8: Update Route Tables
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 8: Updating Route Tables${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Get private route tables
PRIVATE_RT_IDS=$(aws ec2 describe-route-tables \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Type,Values=private" \
  --query 'RouteTables[*].RouteTableId' \
  --output text \
  --region $AWS_REGION 2>/dev/null || echo "")

if [ -z "$PRIVATE_RT_IDS" ] || [ "$PRIVATE_RT_IDS" == "None" ]; then
  # Try alternative filter
  PRIVATE_RT_IDS=$(aws ec2 describe-route-tables \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=*private*" \
    --query 'RouteTables[*].RouteTableId' \
    --output text \
    --region $AWS_REGION 2>/dev/null || echo "")
fi

if [ -z "$PRIVATE_RT_IDS" ] || [ "$PRIVATE_RT_IDS" == "None" ]; then
  echo -e "${YELLOW}⚠️  No private route tables found. Please update route tables manually.${NC}"
else
  for RT_ID in $PRIVATE_RT_IDS; do
    echo "Updating route table: $RT_ID"
    
    # Check if route already exists
    EXISTING_ROUTE=$(aws ec2 describe-route-tables \
      --route-table-ids $RT_ID \
      --query 'RouteTables[0].Routes[?DestinationCidrBlock==`0.0.0.0/0` && InstanceId!=`null`].InstanceId' \
      --output text \
      --region $AWS_REGION 2>/dev/null || echo "")
    
    if [ -n "$EXISTING_ROUTE" ] && [ "$EXISTING_ROUTE" == "$NAT_INSTANCE_ID" ]; then
      echo -e "  ${YELLOW}⚠️  Route already points to NAT instance${NC}"
    else
      # Delete existing NAT Gateway route if exists
      EXISTING_NAT=$(aws ec2 describe-route-tables \
        --route-table-ids $RT_ID \
        --query 'RouteTables[0].Routes[?DestinationCidrBlock==`0.0.0.0/0` && NatGatewayId!=`null`].NatGatewayId' \
        --output text \
        --region $AWS_REGION 2>/dev/null || echo "")
      
      if [ -n "$EXISTING_NAT" ] && [ "$EXISTING_NAT" != "None" ]; then
        echo -e "  ${YELLOW}   Removing existing NAT Gateway route...${NC}"
        aws ec2 delete-route \
          --route-table-id $RT_ID \
          --destination-cidr-block 0.0.0.0/0 \
          --region $AWS_REGION > /dev/null 2>&1 || true
      fi
      
      # Delete existing instance route if different
      if [ -n "$EXISTING_ROUTE" ] && [ "$EXISTING_ROUTE" != "None" ] && [ "$EXISTING_ROUTE" != "$NAT_INSTANCE_ID" ]; then
        echo -e "  ${YELLOW}   Removing existing instance route...${NC}"
        aws ec2 delete-route \
          --route-table-id $RT_ID \
          --destination-cidr-block 0.0.0.0/0 \
          --region $AWS_REGION > /dev/null 2>&1 || true
      fi
      
      # Create route to NAT instance
      aws ec2 create-route \
        --route-table-id $RT_ID \
        --destination-cidr-block 0.0.0.0/0 \
        --instance-id $NAT_INSTANCE_ID \
        --region $AWS_REGION > /dev/null
      
      echo -e "  ${GREEN}✅ Route updated to use NAT instance${NC}"
    fi
  done
fi
echo ""

# Step 9: Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ NAT Instance Setup Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📋 Summary:"
echo "   VPC ID: $VPC_ID"
echo "   NAT Instance ID: $NAT_INSTANCE_ID"
echo "   Security Group: $NAT_SG_ID"
echo "   Elastic IP: $EIP_ALLOCATION_ID"
echo ""
echo "💰 Cost Savings:"
echo "   Before: ~\$32/month (NAT Gateway)"
echo "   After:  ~\$3.50/month (NAT Instance)"
echo "   Savings: ~\$28.50/month (~89% reduction)"
echo ""
echo "📝 Next Steps:"
echo "   1. Test connectivity from Lambda"
echo "   2. Monitor NAT instance in CloudWatch"
echo "   3. Set up CloudWatch alarms for instance health"
echo ""
echo "🔍 Verification:"
echo "   aws ec2 describe-instances --instance-ids $NAT_INSTANCE_ID --region $AWS_REGION"
echo ""
