# Automated Test Scripts - Quick Reference

## Quick Start

```bash
cd backend/lambda

# Run all tests
./run-all-tests.sh

# Run specific test
./run-all-tests.sh slot-blocking
./run-all-tests.sh error-handling
./run-all-tests.sh multiple-services
```

## Individual Test Scripts

### 1. Slot Blocking Test
```bash
npx ts-node test-booking-slot-blocking.ts
```

**What it tests:**
- Multiple 'pending' bookings allowed for same slot
- Only 'confirmed' bookings block slots
- Conflict check logic

### 2. Error Handling Test (409)
```bash
npx ts-node test-error-handling-409.ts
```

**What it tests:**
- 409 SLOT_CONFLICT error returned correctly
- Error message is user-friendly
- Error code is correct

### 3. Multiple Services Test
```bash
npx ts-node test-multiple-services.ts
```

**What it tests:**
- Multiple services sent in payload
- Total amount/duration calculated correctly
- All service IDs included

## Test Output

Each test provides:
- ✅ Pass/Fail for each assertion
- Detailed logs
- Summary with pass/fail counts
- Next steps for verification

## Dependencies

Tests require:
- `axios` (installed automatically if missing)
- `ts-node` (via npx)
- Node.js and npm

## Troubleshooting

If tests fail:
1. Check API endpoint is accessible
2. Verify test data (IDs) are valid
3. Check CloudWatch logs for backend errors
4. Ensure backend is deployed with latest code
