#!/bin/bash
# ============================================================================
# Simple SQS Queue URL Configuration (Alternative Method)
# ============================================================================

set -e

AWS_REGION=${1:-ap-south-1}
ENVIRONMENT=${2:-dev}
LAMBDA_FUNCTION="warmpawz-${ENVIRONMENT}-api-handler"
QUEUE_URL="https://ap-south-1.queue.amazonaws.com/057442119249/warmpawz-${ENVIRONMENT}-payment-processing"

echo "🔧 Configuring SQS Payment Queue URL (Simple Method)"
echo "==================================================="
echo "Lambda: $LAMBDA_FUNCTION"
echo "Queue URL: $QUEUE_URL"
echo ""

# Get current env vars and add SQS_PAYMENT_QUEUE_URL
python3 << EOF
import json
import subprocess
import sys

# Get current environment
result = subprocess.run([
    'aws', 'lambda', 'get-function-configuration',
    '--function-name', '$LAMBDA_FUNCTION',
    '--region', '$AWS_REGION',
    '--query', 'Environment.Variables',
    '--output', 'json'
], capture_output=True, text=True)

if result.returncode != 0:
    print(f"❌ Failed to get Lambda config: {result.stderr}")
    sys.exit(1)

current_env = json.loads(result.stdout)
current_env['SQS_PAYMENT_QUEUE_URL'] = '$QUEUE_URL'

# Write to file
with open('/tmp/lambda-env.json', 'w') as f:
    json.dump(current_env, f)

# Read back and format for AWS CLI
with open('/tmp/lambda-env.json', 'r') as f:
    env_json = f.read()

# Update Lambda - use file input
update_cmd = [
    'aws', 'lambda', 'update-function-configuration',
    '--function-name', '$LAMBDA_FUNCTION',
    '--region', '$AWS_REGION',
    '--environment', f"Variables={env_json}"
]

update_result = subprocess.run(update_cmd, capture_output=True, text=True)

if update_result.returncode == 0:
    print("✅ SQS_PAYMENT_QUEUE_URL configured successfully")
    print(f"   Queue URL: $QUEUE_URL")
else:
    print(f"❌ Failed: {update_result.stderr}")
    print("\n💡 Manual command:")
    print(f"aws lambda update-function-configuration \\")
    print(f"  --function-name $LAMBDA_FUNCTION \\")
    print(f"  --region $AWS_REGION \\")
    print(f"  --environment 'Variables={env_json}'")
    sys.exit(1)
EOF

echo ""
echo "✅ Configuration complete!"
