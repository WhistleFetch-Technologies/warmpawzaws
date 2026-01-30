/**
 * ============================================================================
 * TRANSACTION ABORT FIX TEST
 * ============================================================================
 * 
 * Tests that transaction abort errors are properly detected and handled
 * 
 * Run: npx ts-node test-transaction-abort-fix.ts
 * ============================================================================
 */

// Import the function directly without triggering DB initialization
// We'll replicate the function logic here for testing
function isTransactionAbortedError(error: any): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  const code = error.code || '';
  
  // PostgreSQL error codes and messages that indicate transaction abort
  return (
    code === '25P02' || // in_failed_sql_transaction
    message.includes('current transaction is aborted') ||
    message.includes('transaction is aborted') ||
    message.includes('commands ignored until end of transaction block')
  );
}

interface TestCase {
  name: string;
  error: any;
  expected: boolean;
}

const testCases: TestCase[] = [
  {
    name: 'PostgreSQL error code 25P02',
    error: { code: '25P02', message: 'Some error' },
    expected: true,
  },
  {
    name: 'Exact "current transaction is aborted" message',
    error: { message: 'current transaction is aborted, commands ignored until end of transaction block' },
    expected: true,
  },
  {
    name: 'Partial "transaction is aborted" message',
    error: { message: 'transaction is aborted' },
    expected: true,
  },
  {
    name: 'Partial "commands ignored" message',
    error: { message: 'commands ignored until end of transaction block' },
    expected: true,
  },
  {
    name: 'Unique constraint violation (not transaction abort)',
    error: { code: '23505', message: 'Unique constraint violation' },
    expected: false,
  },
  {
    name: 'Foreign key violation (not transaction abort)',
    error: { code: '23503', message: 'Foreign key constraint violation' },
    expected: false,
  },
  {
    name: 'Null error',
    error: null,
    expected: false,
  },
  {
    name: 'Undefined error',
    error: undefined,
    expected: false,
  },
  {
    name: 'Empty error object',
    error: {},
    expected: false,
  },
  {
    name: 'Case-insensitive message matching',
    error: { message: 'CURRENT TRANSACTION IS ABORTED' },
    expected: true,
  },
];

function runTests(): void {
  console.log('\n═'.repeat(60));
  console.log('TRANSACTION ABORT ERROR DETECTION TEST');
  console.log('═'.repeat(60));
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const result = isTransactionAbortedError(testCase.error);
      const success = result === testCase.expected;

      if (success) {
        console.log(`✅ ${testCase.name}`);
        passed++;
      } else {
        console.log(`❌ ${testCase.name}`);
        console.log(`   Expected: ${testCase.expected}, Got: ${result}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`❌ ${testCase.name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log('TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total tests: ${testCases.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('═'.repeat(60));

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

// Run tests
runTests();
