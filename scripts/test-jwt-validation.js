#!/usr/bin/env node

/**
 * ============================================================================
 * JWT VALIDATION TEST SCRIPT
 * ============================================================================
 * 
 * Quick test script to verify JWT validation is working
 * 
 * Usage:
 *   node scripts/test-jwt-validation.js <JWT_TOKEN>
 * 
 * Or set environment variables:
 *   COGNITO_USER_POOL_ID=your-pool-id
 *   COGNITO_CLIENT_ID=your-client-id
 *   AWS_REGION=ap-south-1
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

const token = process.argv[2];

if (!token) {
  console.error('❌ Error: JWT token required');
  console.log('\nUsage: node scripts/test-jwt-validation.js <JWT_TOKEN>');
  console.log('\nOr provide token via environment:');
  console.log('  JWT_TOKEN=your-token node scripts/test-jwt-validation.js');
  process.exit(1);
}

// Simple token decode (unsafe - for testing only)
function decodeTokenUnsafe(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );
    
    return payload;
  } catch (error) {
    console.error('❌ Failed to decode token:', error.message);
    return null;
  }
}

// Check token expiry
function isTokenExpired(payload) {
  if (!payload.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

// Main test
console.log('🔍 JWT Token Validation Test\n');
console.log('Token (first 50 chars):', token.substring(0, 50) + '...\n');

const payload = decodeTokenUnsafe(token);

if (!payload) {
  console.error('❌ Token decode failed');
  process.exit(1);
}

console.log('✅ Token decoded successfully\n');
console.log('📋 Token Claims:');
console.log('  - User ID (sub):', payload.sub || 'N/A');
console.log('  - Username:', payload['cognito:username'] || payload.username || 'N/A');
console.log('  - Email:', payload.email || 'N/A');
console.log('  - Phone:', payload.phone_number || 'N/A');
console.log('  - User Type:', payload['custom:user_type'] || 'N/A');
console.log('  - Groups:', payload['cognito:groups'] || 'N/A');
console.log('  - Issuer:', payload.iss || 'N/A');
console.log('  - Audience:', payload.aud || 'N/A');
console.log('  - Expires:', payload.exp ? new Date(payload.exp * 1000).toISOString() : 'N/A');
console.log('  - Issued At:', payload.iat ? new Date(payload.iat * 1000).toISOString() : 'N/A');

// Check expiry
if (isTokenExpired(payload)) {
  console.log('\n⚠️  Token is EXPIRED');
} else {
  console.log('\n✅ Token is valid (not expired)');
}

// Check required claims
const hasSub = !!payload.sub;
const hasUsername = !!(payload['cognito:username'] || payload.username);

console.log('\n📊 Validation Checks:');
console.log('  - Has sub claim:', hasSub ? '✅' : '❌');
console.log('  - Has username:', hasUsername ? '✅' : '❌');
console.log('  - Has groups/role:', !!(payload['cognito:groups'] || payload['custom:user_type']) ? '✅' : '⚠️  (optional)');

// Environment check
console.log('\n🔧 Environment Variables:');
console.log('  - COGNITO_USER_POOL_ID:', process.env.COGNITO_USER_POOL_ID || '❌ Not set');
console.log('  - COGNITO_CLIENT_ID:', process.env.COGNITO_CLIENT_ID || '⚠️  Optional');
console.log('  - AWS_REGION:', process.env.AWS_REGION || '⚠️  Using default (ap-south-1)');

console.log('\n💡 Next Steps:');
console.log('  1. Set COGNITO_USER_POOL_ID environment variable');
console.log('  2. Test with actual API endpoint');
console.log('  3. Check CloudWatch logs for verification results');
console.log('  4. Verify user ID and role extraction in handler context\n');

