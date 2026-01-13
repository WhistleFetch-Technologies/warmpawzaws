/**
 * ============================================================================
 * JWT TOKEN GENERATION UTILITIES
 * ============================================================================
 * 
 * Generates proper JWT tokens for UAT mode (when Cognito is bypassed)
 * Uses jose library to create signed JWT tokens with proper structure
 * 
 * Date: 2025-01-12
 * ============================================================================
 */

import { SignJWT } from 'jose';

// UAT Mode Secret Key (for signing JWT tokens)
// In production, this should be stored in AWS Secrets Manager
const UAT_JWT_SECRET = process.env.UAT_JWT_SECRET || 'uat-secret-key-change-in-production';

/**
 * Generate a proper JWT token for UAT mode
 * Creates a signed JWT token with user claims
 */
export async function generateUATJWTToken(params: {
  userId: string;
  phone: string;
  role: 'customer' | 'vendor' | 'admin';
  expiresIn?: number; // seconds, default 60 for UAT
}): Promise<{ accessToken: string; idToken: string; refreshToken: string; expiresIn: number }> {
  const { userId, phone, role, expiresIn = 60 } = params;
  
  // Create secret key from string
  const secret = new TextEncoder().encode(UAT_JWT_SECRET);
  
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresIn;
  
  // Generate Access Token
  const accessToken = await new SignJWT({
    sub: userId,
    'cognito:username': phone,
    phone_number: phone,
    'custom:user_type': role,
    'cognito:groups': [role],
    token_use: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setIssuer('warmpawz-uat')
    .setAudience('warmpawz-api')
    .sign(secret);

  // Generate ID Token (for user info)
  const idToken = await new SignJWT({
    sub: userId,
    'cognito:username': phone,
    phone_number: phone,
    'custom:user_type': role,
    'cognito:groups': [role],
    token_use: 'id',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setIssuer('warmpawz-uat')
    .setAudience('warmpawz-api')
    .sign(secret);

  // Generate Refresh Token (longer expiry for refresh)
  const refreshExp = now + (7 * 24 * 60 * 60); // 7 days
  const refreshToken = await new SignJWT({
    sub: userId,
    'cognito:username': phone,
    token_use: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(refreshExp)
    .setIssuer('warmpawz-uat')
    .setAudience('warmpawz-api')
    .sign(secret);

  console.log(`[JWT Generator] Generated UAT tokens for ${role} ${userId} (expires in ${expiresIn}s)`);

  return {
    accessToken,
    idToken,
    refreshToken,
    expiresIn,
  };
}

/**
 * Verify UAT JWT token
 * Used to verify tokens generated in UAT mode
 */
export async function verifyUATJWTToken(token: string): Promise<{
  valid: boolean;
  payload?: any;
  error?: string;
}> {
  try {
    const secret = new TextEncoder().encode(UAT_JWT_SECRET);
    const { jwtVerify } = await import('jose');
    
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'warmpawz-uat',
      audience: 'warmpawz-api',
    });

    return { valid: true, payload };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}
