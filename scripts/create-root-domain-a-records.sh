#!/bin/bash
# Create A records for root domain (warmpawz.com) pointing to Google IPs
# These are Google Workspace/Google Apps mail server IPs

set -e

ZONE_ID="Z07857473SRNOUZ0V7594"  # warmpawz.com hosted zone

# Google IP addresses for mail services
GOOGLE_IPS=(
  "216.239.32.21"
  "216.239.34.21"
  "216.239.36.21"
  "216.239.38.21"
)

echo "🌍 Creating A records for root domain (warmpawz.com)..."
echo ""

# Check if A record already exists
EXISTING=$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" --query "ResourceRecordSets[?Name=='warmpawz.com.' && Type=='A']" --output json 2>/dev/null | python3 -c "import sys, json; r = json.load(sys.stdin); print('EXISTS' if r else 'MISSING')" 2>/dev/null || echo "MISSING")

if [ "$EXISTING" = "EXISTS" ]; then
  echo "⚠️  A record for warmpawz.com already exists"
  echo ""
  echo "Current A record:"
  aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" --query "ResourceRecordSets[?Name=='warmpawz.com.' && Type=='A']" --output json 2>/dev/null | python3 -c "
import sys, json
r = json.load(sys.stdin)[0]
ips = [rr['Value'] for rr in r.get('ResourceRecords', [])]
print(f\"  IPs: {', '.join(ips)}\")
" 2>/dev/null || echo "  (Unable to retrieve)"
  echo ""
  read -p "Do you want to update/replace it? (y/N): " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 0
  fi
fi

echo "📝 Creating A record with Google IPs:"
for ip in "${GOOGLE_IPS[@]}"; do
  echo "   - $ip"
done
echo ""

# Build ResourceRecords array
RESOURCE_RECORDS="["
for i in "${!GOOGLE_IPS[@]}"; do
  if [ $i -gt 0 ]; then
    RESOURCE_RECORDS+=","
  fi
  RESOURCE_RECORDS+="{\"Value\":\"${GOOGLE_IPS[$i]}\"}"
done
RESOURCE_RECORDS+="]"

# Create change batch
CHANGE_BATCH=$(cat <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "warmpawz.com",
      "Type": "A",
      "TTL": 300,
      "ResourceRecords": ${RESOURCE_RECORDS}
    }
  }]
}
EOF
)

echo "Creating A record..."
CHANGE_ID=$(aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch "$CHANGE_BATCH" --query "ChangeInfo.Id" --output text 2>/dev/null || echo "")

if [ -n "$CHANGE_ID" ]; then
  echo "✅ A record created successfully!"
  echo "   Change ID: $CHANGE_ID"
  echo ""
  echo "📋 Record details:"
  echo "   Name: warmpawz.com"
  echo "   Type: A"
  echo "   TTL: 300 seconds"
  echo "   IPs: ${GOOGLE_IPS[*]}"
  echo ""
  echo "⏱️  DNS changes may take 1-5 minutes to propagate"
else
  echo "❌ Failed to create A record"
  exit 1
fi

