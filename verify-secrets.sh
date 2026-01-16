#!/bin/bash
echo "🔍 Verifying GitHub Secrets Configuration..."
echo ""

echo "📋 AWS Secrets Status:"
gh secret list --repo ketan0103/warmpawzaws | grep -E "AWS_" | while read line; do
  name=$(echo "$line" | awk '{print $1}')
  date=$(echo "$line" | awk '{print $2}')
  echo "  ✅ $name (Last updated: $date)"
done

echo ""
echo "🧪 Testing AWS Credentials..."
AWS_ACCESS_KEY_ID=$(gh secret get AWS_ACCESS_KEY_ID --repo ketan0103/warmpawzaws 2>/dev/null || echo "Cannot read secret")
if [ "$AWS_ACCESS_KEY_ID" = "AKIAQ2X6RFZIQ3ATFOUF" ]; then
  echo "  ✅ AWS_ACCESS_KEY_ID is correct"
else
  echo "  ⚠️  AWS_ACCESS_KEY_ID may not be set correctly"
fi

echo ""
echo "✅ Verification complete"
