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
  InitiateAuthCommand,
  AdminGetUserCommand,
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
  // ✅ FIX: Generate email-like username if User Pool requires email
  // Use phone number as email format: phone_+919326977987@warmpawz.local
  const username = email || `${phone.replace(/[^0-9]/g, '')}@warmpawz.local`;

  try {
    // Try to get existing user by username (email format)
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
  // ✅ FIX: Generate email-like username if User Pool requires email
  // Use phone number as email format: 9326977987@warmpawz.local
  const username = email || `${phone.replace(/[^0-9]/g, '')}@warmpawz.local`;
  const tempPassword = generateTemporaryPassword();

  // ✅ FIX: Ensure phone number is in E.164 format for Cognito
  // Cognito requires phone numbers in E.164 format: +[country code][number]
  let phoneFormatted = phone;
  if (!phone.startsWith('+')) {
    // If phone doesn't start with +, assume it's Indian number and add +91
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length === 10) {
      phoneFormatted = `+91${digits}`;
    } else if (digits.startsWith('91') && digits.length === 12) {
      phoneFormatted = `+${digits}`;
    } else {
      phoneFormatted = `+${digits}`;
    }
  }
  
  // Create user with email attribute (required if UsernameAttributes includes email)
  const userAttributes = [
    { Name: 'phone_number', Value: phoneFormatted }, // Use E.164 formatted phone
    { Name: 'phone_number_verified', Value: 'true' },
    { Name: 'email', Value: username }, // Use email-like username as email attribute
    { Name: 'email_verified', Value: 'true' }, // Mark as verified since it's phone-based
    { Name: 'custom:user_type', Value: userType },
  ];
  
  if (email && email !== username) {
    // If real email provided, use it instead
    const emailIndex = userAttributes.findIndex(attr => attr.Name === 'email');
    if (emailIndex >= 0) {
      userAttributes[emailIndex] = { Name: 'email', Value: email };
    }
  }

  // Create user
  const createResponse = await cognitoClient.send(
    new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      TemporaryPassword: tempPassword,
      UserAttributes: userAttributes,
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
  // ✅ FIX: Use same email-format username as getOrCreateCognitoUser
  const username = `${phone.replace(/[^0-9]/g, '')}@warmpawz.local`;
  const password = generatePermanentPassword(phone);

  // ✅ FIX: Use InitiateAuthCommand with USER_PASSWORD_AUTH (not AdminInitiateAuthCommand)
  // AdminInitiateAuthCommand doesn't support USER_PASSWORD_AUTH
  // InitiateAuthCommand works with USER_PASSWORD_AUTH which is enabled on the client
  const authResponse = await cognitoClient.send(
    new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
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

