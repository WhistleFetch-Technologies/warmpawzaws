#!/usr/bin/env python3
"""
Update Lambda environment variables
"""
import json
import subprocess
import sys

LAMBDA_FUNCTION = sys.argv[1] if len(sys.argv) > 1 else "warmpawz-dev-api-handler"
AWS_REGION = sys.argv[2] if len(sys.argv) > 2 else "ap-south-1"
QUEUE_URL = sys.argv[3] if len(sys.argv) > 3 else "https://ap-south-1.queue.amazonaws.com/057442119249/warmpawz-dev-payment-processing"

# Get current environment
result = subprocess.run([
    'aws', 'lambda', 'get-function-configuration',
    '--function-name', LAMBDA_FUNCTION,
    '--region', AWS_REGION,
    '--query', 'Environment.Variables',
    '--output', 'json'
], capture_output=True, text=True)

if result.returncode != 0:
    print(f"❌ Failed to get Lambda config: {result.stderr}")
    sys.exit(1)

current_env = json.loads(result.stdout)
current_env['SQS_PAYMENT_QUEUE_URL'] = QUEUE_URL

# Update Lambda
update_result = subprocess.run([
    'aws', 'lambda', 'update-function-configuration',
    '--function-name', LAMBDA_FUNCTION,
    '--region', AWS_REGION,
    '--environment', f"Variables={json.dumps(current_env)}"
], capture_output=True, text=True)

if update_result.returncode == 0:
    print("✅ SQS_PAYMENT_QUEUE_URL configured successfully")
    print(f"   Queue URL: {QUEUE_URL}")
    sys.exit(0)
else:
    print(f"❌ Failed: {update_result.stderr}")
    sys.exit(1)
