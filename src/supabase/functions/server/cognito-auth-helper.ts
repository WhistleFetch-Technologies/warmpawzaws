/**
 * ============================================================================
 * COGNITO AUTHENTICATION HELPER (Server Functions)
 * ============================================================================
 * 
 * Wrapper for Cognito authentication operations
 * Replaces AWS SNS OTP with Cognito SMS MFA
 * 
 * RULES:
 * ❌ NO AWS SNS OTP imports allowed (unless as fallback)
 * ✅ All auth operations use Cognito
 * ✅ Uses PlatformSettingsRepository for AWS credentials
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { 
  CognitoIdentityProviderClient, 
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
  AuthFlowType
} from "@aws-sdk/client-cognito-identity-provider";
import { getPlatformSettingsRepository } from '../../../supabase/lib/repositories/index';

// Get Cognito configuration from environment or platform settings
function getCognitoClient(): CognitoIdentityProviderClient {
  const region = process.env.AWS_REGION || 'ap-south-1';
  
  return new CognitoIdentityProviderClient({
    region,
  });
}

/**
 * Get user pool ID and client ID based on role
 */
async function getPoolConfig(role: 'customer' | 'vendor' | 'admin'): Promise<{
  userPoolId: string;
  clientId: string;
}> {
  const platformSettingsRepo = getPlatformSettingsRepository();
  const awsSettings = await platformSettingsRepo.getAWSSettings();
  
  const cognitoConfig = awsSettings?.cognito || {};
  
  switch (role) {
    case 'customer':
      return {
        userPoolId: cognitoConfig.customerPoolId || process.env.COGNITO_CUSTOMER_POOL_ID || '',
        clientId: cognitoConfig.customerClientId || process.env.COGNITO_CUSTOMER_CLIENT_ID || '',
      };
    case 'vendor':
      return {
        userPoolId: cognitoConfig.vendorPoolId || process.env.COGNITO_VENDOR_POOL_ID || '',
        clientId: cognitoConfig.vendorClientId || process.env.COGNITO_VENDOR_CLIENT_ID || '',
      };
    case 'admin':
      return {
        userPoolId: cognitoConfig.adminPoolId || process.env.COGNITO_ADMIN_POOL_ID || '',
        clientId: cognitoConfig.adminClientId || process.env.COGNITO_ADMIN_CLIENT_ID || '',
      };
    default:
      throw new Error(`Invalid role: ${role}`);
  }
}

/**
 * Generate temporary password for new users
 */
function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Send OTP via Cognito SMS MFA
 * For Customer and Vendor pools (phone-based auth)
 */
export async function sendCognitoOTP(
  phone: string,
  role: 'customer' | 'vendor'
): Promise<{ session: string; challengeName: string; success: boolean }> {
  const client = getCognitoClient();
  const { userPoolId, clientId } = await getPoolConfig(role);

  if (!userPoolId || !clientId) {
    throw new Error(`Cognito ${role} pool not configured. Please set COGNITO_${role.toUpperCase()}_POOL_ID and COGNITO_${role.toUpperCase()}_CLIENT_ID`);
  }

  try {
    let username = phone;
    
    // Try to initiate auth (will create user if doesn't exist with self-signup enabled)
    const initiateCommand = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.CUSTOM_AUTH,
      ClientId: clientId,
      AuthParameters: {
        USERNAME: username,
      },
    });

    const response = await client.send(initiateCommand);

    if (response.ChallengeName === 'CUSTOM_CHALLENGE') {
      // Respond to custom challenge to trigger SMS
      const challengeCommand = new RespondToAuthChallengeCommand({
        ClientId: clientId,
        ChallengeName: 'CUSTOM_CHALLENGE',
        Session: response.Session || '',
        ChallengeResponses: {
          USERNAME: username,
          ANSWER: 'SMS', // Trigger SMS delivery
        },
      });

      const challengeResponse = await client.send(challengeCommand);

      if (challengeResponse.ChallengeName === 'SMS_MFA') {
        return {
          session: challengeResponse.Session || '',
          challengeName: 'SMS_MFA',
          success: true,
        };
      }
    }

    // If already in SMS_MFA challenge, return session
    if (response.ChallengeName === 'SMS_MFA' && response.Session) {
      return {
        session: response.Session,
        challengeName: 'SMS_MFA',
        success: true,
      };
    }

    throw new Error('Failed to initiate SMS MFA challenge');
  } catch (error: any) {
    // If user doesn't exist, create them first
    if (error.name === 'UserNotFoundException' || error.name === 'ResourceNotFoundException') {
      try {
        // Sign up new user
        const signUpCommand = new SignUpCommand({
          ClientId: clientId,
          Username: phone,
          Password: generateTemporaryPassword(),
          UserAttributes: [
            { Name: 'phone_number', Value: phone },
          ],
        });

        await client.send(signUpCommand);

        // Retry auth initiation
        return sendCognitoOTP(phone, role);
      } catch (signUpError: any) {
        console.error('❌ [COGNITO] Error signing up user:', signUpError);
        throw new Error(`Failed to create user: ${signUpError.message}`);
      }
    }

    console.error('❌ [COGNITO] Error sending OTP:', error);
    return {
      session: '',
      challengeName: '',
      success: false,
    };
  }
}

/**
 * Verify OTP via Cognito SMS MFA
 */
export async function verifyCognitoOTP(
  phone: string,
  otp: string,
  session: string,
  role: 'customer' | 'vendor'
): Promise<{
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  success: boolean;
}> {
  const client = getCognitoClient();
  const { clientId } = await getPoolConfig(role);

  if (!clientId) {
    throw new Error(`Cognito ${role} client not configured`);
  }

  try {
    const command = new RespondToAuthChallengeCommand({
      ClientId: clientId,
      ChallengeName: 'SMS_MFA',
      Session: session,
      ChallengeResponses: {
        USERNAME: phone,
        SMS_MFA_CODE: otp,
      },
    });

    const response = await client.send(command);

    if (!response.AuthenticationResult) {
      throw new Error('Authentication failed - no tokens returned');
    }

    return {
      accessToken: response.AuthenticationResult.AccessToken || '',
      idToken: response.AuthenticationResult.IdToken || '',
      refreshToken: response.AuthenticationResult.RefreshToken || '',
      expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
      success: true,
    };
  } catch (error: any) {
    console.error('❌ [COGNITO] Error verifying OTP:', error);
    return {
      accessToken: '',
      idToken: '',
      refreshToken: '',
      expiresIn: 0,
      success: false,
    };
  }
}

