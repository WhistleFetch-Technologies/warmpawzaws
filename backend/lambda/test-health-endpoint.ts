/**
 * ============================================================================
 * Health Endpoint Test Script
 * ============================================================================
 * 
 * Tests the enhanced /health endpoint
 * Run with: npx ts-node test-health-endpoint.ts
 * ============================================================================
 */

import { checkDbHealth } from './src/database/rds-connection';

async function testHealthCheck() {
  console.log('🧪 Testing Health Check Functions');
  console.log('=================================\n');

  // Test 1: Database health check
  console.log('Test 1: Database Health Check');
  console.log('--------------------------------');
  try {
    const dbHealthy = await checkDbHealth();
    if (dbHealthy) {
      console.log('✅ Database connection: Healthy');
    } else {
      console.log('⚠️  Database connection: Unhealthy');
    }
  } catch (error) {
    console.log('⚠️  Database health check failed (expected if DB not configured)');
    console.log(`   Error: ${error instanceof Error ? error.message : error}`);
  }

  console.log('\n✅ Health check test completed');
  console.log('\n📝 To test the full /health endpoint:');
  console.log('   1. Start the server: npm run start:local');
  console.log('   2. Call: curl http://localhost:3000/health');
  console.log('   3. Check response includes database and environment status');
}

testHealthCheck().catch(console.error);
