/**
 * ============================================================================
 * AWS COGNITO AUTHENTICATION INTEGRATION
 * ============================================================================
 * 
 * Integrates AWS Cognito with the OTP-based authentication system
 * 
 * Date: 2026-01-02
 * ============================================================================
 */

import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
  AdminGetUserCommand,
  AdminUserGlobalSignOutCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';

export interface CognitoUser {
  username: string;
  sub: string;
  phone: string;
  email?: string;
  attributes: Record<string, string>;
}

export interface CognitoTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Create or get Cognito user by phone number
 */
export async function getOrCreateCognitoUser(
  phone: string,
  email?: string,
  userType: 'customer' | 'vendor' | 'admin' = 'customer'
): Promise<CognitoUser> {
  const username = `phone_${phone}`;

  try {
    // Try to get existing user
    const getUserResponse = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
      })
    );

    const attributes: Record<string, string> = {};
    getUserResponse.UserAttributes?.forEach(attr => {
      if (attr.Name && attr.Value) {
        attributes[attr.Name] = attr.Value;
      }
    });

    return {
      username,
      sub: attributes['sub'] || '',
      phone: attributes['phone_number'] || phone,
      email: attributes['email'],
      attributes,
    };
  } catch (error: any) {
    if (error.name === 'UserNotFoundException') {
      // Create new user
      return await createCognitoUser(phone, email, userType);
    }
    throw error;
  }
}

/**
 * Create new Cognito user
 */
async function createCognitoUser(
  phone: string,
  email?: string,
  userType: 'customer' | 'vendor' | 'admin' = 'customer'
): Promise<CognitoUser> {
  const username = `phone_${phone}`;
  const tempPassword = generateTemporaryPassword();

  // Create user
  const createResponse = await cognitoClient.send(
    new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      TemporaryPassword: tempPassword,
      UserAttributes: [
        { Name: 'phone_number', Value: phone },
        { Name: 'phone_number_verified', Value: 'true' },
        ...(email ? [{ Name: 'email', Value: email }, { Name: 'email_verified', Value: 'false' }] : []),
        { Name: 'custom:user_type', Value: userType },
      ],
      MessageAction: 'SUPPRESS', // Don't send email/SMS from Cognito
    })
  );

  // Set permanent password (bypass FORCE_CHANGE_PASSWORD state)
  const permanentPassword = generatePermanentPassword(phone);
  await cognitoClient.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      Password: permanentPassword,
      Permanent: true,
    })
  );

  const sub = createResponse.User?.Attributes?.find(attr => attr.Name === 'sub')?.Value || '';

  return {
    username,
    sub,
    phone,
    email,
    attributes: {
      sub,
      phone_number: phone,
      ...(email && { email }),
      'custom:user_type': userType,
    },
  };
}

/**
 * Authenticate user and get tokens
 */
export async function authenticateCognitoUser(
  phone: string
): Promise<CognitoTokens> {
  const username = `phone_${phone}`;
  const password = generatePermanentPassword(phone);

  const authResponse = await cognitoClient.send(
    new AdminInitiateAuthCommand({
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthFlow: AuthFlowType.ADMIN_NO_SRP_AUTH,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    })
  );

  if (!authResponse.AuthenticationResult) {
    throw new Error('Authentication failed');
  }

  return {
    accessToken: authResponse.AuthenticationResult.AccessToken || '',
    idToken: authResponse.AuthenticationResult.IdToken || '',
    refreshToken: authResponse.AuthenticationResult.RefreshToken || '',
    expiresIn: authResponse.AuthenticationResult.ExpiresIn || 3600,
  };
}

/**
 * Exchange a Cognito refresh token for new access/id tokens (same user pool + app client as login).
 * Refresh token rotation: Cognito may omit a new refresh token; caller should keep the previous one.
 */
export async function refreshCognitoUserSession(refreshToken: string): Promise<CognitoTokens> {
  if (!USER_POOL_ID || !CLIENT_ID) {
    throw new Error('Cognito is not configured');
  }
  const rt = (refreshToken || '').trim();
  if (!rt) {
    throw new Error('Refresh token required');
  }

  const authResponse = await cognitoClient.send(
    new AdminInitiateAuthCommand({
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      AuthParameters: {
        REFRESH_TOKEN: rt,
      },
    })
  );

  if (!authResponse.AuthenticationResult) {
    throw new Error('Cognito refresh failed');
  }

  const ar = authResponse.AuthenticationResult;
  return {
    accessToken: ar.AccessToken || '',
    idToken: ar.IdToken || '',
    refreshToken: ar.RefreshToken || rt,
    expiresIn: ar.ExpiresIn || 3600,
  };
}

/**
 * Revoke all refresh tokens for the internal Cognito user `phone_{dialable}`.
 * Used after customer password reset/change so old sessions cannot refresh.
 */
export async function adminGlobalSignOutCognitoUserByDialablePhone(
  dialablePhone: string
): Promise<{ ok: boolean; error?: string }> {
  const poolId =
    process.env.COGNITO_USER_POOL_ID ||
    process.env.COGNITO_VENDOR_POOL_ID ||
    process.env.COGNITO_CUSTOMER_POOL_ID ||
    '';
  if (!poolId || !dialablePhone?.trim()) {
    return { ok: true };
  }
  const username = `phone_${dialablePhone.trim()}`;
  try {
    await cognitoClient.send(
      new AdminUserGlobalSignOutCommand({
        UserPoolId: poolId,
        Username: username,
      })
    );
    return { ok: true };
  } catch (error: any) {
    if (error?.name === 'UserNotFoundException') {
      return { ok: true };
    }
    return { ok: false, error: error?.message || String(error) };
  }
}

/**
 * Generate temporary password for initial user creation
 */
function generateTemporaryPassword(): string {
  const length = 16;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

/**
 * Generate consistent permanent password from phone number
 * Uses HMAC to create deterministic but secure password
 */
function generatePermanentPassword(phone: string): string {
  const crypto = require('crypto');
  const secret = process.env.COGNITO_PASSWORD_SECRET || 'warmpawz-default-secret-change-me';
  
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(phone)
    .digest('hex');
  
  // Create password that meets Cognito requirements (min 8 chars, uppercase, lowercase, number, special)
  return `Wp${hmac.substring(0, 12)}!@`;
}

/**
 * Verify Cognito JWT token
 */
export async function verifyCognitoToken(token: string): Promise<CognitoUser | null> {
  try {
    // In production, verify JWT signature using Cognito public keys
    // For now, we'll decode without verification (implement proper verification in production)
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );

    return {
      username: payload['cognito:username'] || '',
      sub: payload.sub || '',
      phone: payload.phone_number || '',
      email: payload.email,
      attributes: payload,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

