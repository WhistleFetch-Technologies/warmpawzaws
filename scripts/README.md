# Test Scripts for WarmPawz Platform

## 📋 Overview

This directory contains test scripts and tools for validating the WarmPawz platform functionality.

## 🧪 Test Scripts

### 1. Webhook Signature Test
Tests Razorpay webhook signature verification.

```bash
npm run test:webhook
# or
tsx test-webhook-signature.ts
```

### 2. Payment Flow Test
End-to-end test of the payment flow (requires API access).

```bash
npm run test:payment
# or
tsx test-payment-flow.ts
```

### 3. Refund Flow Test
Tests the refund flow when bookings are cancelled (requires API access).

```bash
npm run test:refund
# or
tsx test-refund-flow.ts
```

### 4. Run All Tests
Run all test scripts in sequence.

```bash
npm run test:all
# or
./run-all-tests.sh
```

## 🔧 Setup

1. Install dependencies:
```bash
cd scripts
npm install
```

2. Set environment variables:
```bash
export API_BASE_URL=https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475
export EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 📊 Test Results

Tests output detailed results showing:
- ✅ Passed steps
- ❌ Failed steps with error messages
- 📊 Summary statistics

## 📝 Notes

- Some tests require actual API access and may create test data
- Webhook tests require Razorpay configuration
- Payment/refund tests require valid API keys

## 🔍 Monitoring

See `setup-monitoring.md` for monitoring setup guide.

