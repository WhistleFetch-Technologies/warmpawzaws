#!/bin/bash

# ============================================================================
# QUICK TEST SCRIPT
# ============================================================================
# Starts server and tests endpoints
# ============================================================================

cd "$(dirname "$0")"

echo "=== Warmpawz Local Testing ==="
echo ""

# Check prerequisites
if [ ! -f "dist/handler.js" ]; then
    echo "❌ Build missing. Running build..."
    npm run build:bundle
fi

echo "✅ Prerequisites checked"
echo ""

# Start server in background
echo "🚀 Starting serverless-offline..."
if command -v serverless &> /dev/null; then
    serverless offline --config serverless.local.yml > /tmp/warmpawz-server.log 2>&1 &
else
    npx serverless offline --config serverless.local.yml > /tmp/warmpawz-server.log 2>&1 &
fi
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
echo ""

# Wait for server to start
echo "⏳ Waiting for server to start (max 30 seconds)..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ Server is ready!"
        echo ""
        break
    fi
    sleep 1
    echo -n "."
done
echo ""

# Test endpoints
echo "=== Testing Endpoints ==="
echo ""

# Test 1: Health
echo "[1/5] Health Check..."
HEALTH=$(curl -s http://localhost:3000/health 2>&1)
if echo "$HEALTH" | grep -q "success"; then
    echo "✅ Health check passed"
    echo "$HEALTH" | python3 -m json.tool 2>/dev/null | head -10 || echo "$HEALTH" | head -100
else
    echo "❌ Health check failed"
    echo "$HEALTH"
fi
echo ""

# Test 2: Send OTP
echo "[2/5] Send OTP..."
SEND_OTP=$(curl -s -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}' 2>&1)
if echo "$SEND_OTP" | grep -q "success"; then
    echo "✅ Send OTP passed"
    echo "$SEND_OTP" | python3 -m json.tool 2>/dev/null | head -10 || echo "$SEND_OTP" | head -100
else
    echo "⚠️  Send OTP response:"
    echo "$SEND_OTP" | head -200
fi
echo ""

# Test 3: Verify OTP
echo "[3/5] Verify OTP (UAT Mode: OTP=123456)..."
VERIFY_OTP=$(curl -s -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "otp": "123456"}' 2>&1)
if echo "$VERIFY_OTP" | grep -q "success"; then
    echo "✅ Verify OTP passed"
    TOKEN=$(echo "$VERIFY_OTP" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data',{}).get('token',{}).get('accessToken','') or d.get('data',{}).get('accessToken','') or '')" 2>/dev/null || echo "")
    if [ -n "$TOKEN" ]; then
        echo "✅ Token received: ${TOKEN:0:50}..."
    fi
    echo "$VERIFY_OTP" | python3 -m json.tool 2>/dev/null | head -15 || echo "$VERIFY_OTP" | head -200
else
    echo "⚠️  Verify OTP response:"
    echo "$VERIFY_OTP" | head -200
fi
echo ""

# Test 4: Validation
echo "[4/5] Test Validation (Invalid Request)..."
INVALID=$(curl -s -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "invalid"}' 2>&1)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "invalid"}')
if [ "$HTTP_CODE" = "400" ]; then
    echo "✅ Validation working (HTTP 400 - Expected)"
    echo "$INVALID" | python3 -m json.tool 2>/dev/null | head -10 || echo "$INVALID" | head -100
else
    echo "⚠️  Validation test (HTTP $HTTP_CODE - Expected 400)"
    echo "$INVALID" | head -100
fi
echo ""

# Test 5: Request ID
echo "[5/5] Check Request ID..."
REQ_ID=$(curl -s http://localhost:3000/health 2>&1)
REQUEST_ID=$(echo "$REQ_ID" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('meta',{}).get('requestId','NOT_FOUND'))" 2>/dev/null || echo "NOT_FOUND")
if [ "$REQUEST_ID" != "NOT_FOUND" ] && [ -n "$REQUEST_ID" ]; then
    echo "✅ Request ID present: $REQUEST_ID"
else
    echo "⚠️  Request ID not found"
fi
echo ""

echo "=== Test Summary ==="
echo "✅ All tests completed"
echo ""
echo "Server is still running (PID: $SERVER_PID)"
echo "View logs: tail -f /tmp/warmpawz-server.log"
echo "Stop server: kill $SERVER_PID"
echo ""
echo "Server URL: http://localhost:3000"

