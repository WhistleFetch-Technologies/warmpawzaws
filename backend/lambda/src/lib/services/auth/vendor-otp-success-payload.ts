/**
 * Shared payload builders for vendor auth success (verify-otp shape).
 * Used by VerifyOtpHandlerEnhanced and admin vendor-portal bootstrap.
 */
import { generateUATJWTToken } from '../../../utils/jwt-generator';
import {
  getOrCreateCognitoUser,
  authenticateCognitoUser,
  CognitoTokens,
} from '../../../utils/cognito-client';

export type VendorVerifyOtpInnerMeta = {
  timestamp: string;
  requestId: string;
  version: 'v1';
};

/** Issue access/id/refresh tokens — same branches as auth-enhanced verify-otp. */
export async function issueAuthTokensAfterOtp(params: {
  userId: string;
  phone: string;
  role: 'customer' | 'vendor' | 'admin';
}): Promise<CognitoTokens> {
  const { userId, phone, role } = params;
  const isUATMode = process.env.UAT_MODE === 'true';

  let cognitoTokens: CognitoTokens;

  if (isUATMode) {
    cognitoTokens = await generateUATJWTToken({
      userId,
      phone,
      role,
      expiresIn: 24 * 60 * 60,
    });
    console.log('[vendor-otp-success-payload] UAT Mode: Generated JWT tokens with 24h expiry');
  } else {
    const cognitoUserPoolId =
      process.env.COGNITO_USER_POOL_ID ||
      process.env.COGNITO_VENDOR_POOL_ID ||
      process.env.COGNITO_CUSTOMER_POOL_ID ||
      '';

    if (!cognitoUserPoolId) {
      console.warn(
        '[vendor-otp-success-payload] Production Mode: Cognito not configured, using JWT tokens as fallback'
      );
      cognitoTokens = await generateUATJWTToken({
        userId,
        phone,
        role,
        expiresIn: 24 * 60 * 60,
      });
    } else {
      try {
        const COGNITO_TIMEOUT_MS = 8000;
        const cognitoAuthPromise = (async () => {
          await getOrCreateCognitoUser(phone, undefined, role);
          return authenticateCognitoUser(phone);
        })();
        const cognitoTimeout = new Promise<CognitoTokens>((_, reject) =>
          setTimeout(() => reject(new Error('Cognito authentication timeout after 8 seconds')), COGNITO_TIMEOUT_MS)
        );
        cognitoTokens = await Promise.race([cognitoAuthPromise, cognitoTimeout]);
      } catch (cognitoError: any) {
        console.error('[vendor-otp-success-payload] Cognito failed:', cognitoError?.message || cognitoError);
        console.warn('[vendor-otp-success-payload] Falling back to JWT tokens');
        cognitoTokens = await generateUATJWTToken({
          userId,
          phone,
          role,
          expiresIn: 24 * 60 * 60,
        });
      }
    }
  }

  return cognitoTokens;
}

export function computeVendorIsNewUser(userId: string, userData: any): boolean {
  return (
    (userId && userId.startsWith('temp_vendor_')) ||
    !userData?.id ||
    !userData?.created_at ||
    (userData?.onboarding_status && ['INIT', 'ROLE_PENDING'].includes(userData.onboarding_status))
  );
}

/**
 * First argument to BaseHandlerEnhanced.success() for verify-otp vendor success
 * (becomes response.data in the outer envelope).
 */
export function buildVerifyOtpVendorSuccessWrapper(params: {
  cognitoTokens: CognitoTokens;
  userId: string;
  phone: string;
  userData: any;
  isNewUser: boolean;
  requestId: string;
}): {
  success: true;
  data: {
    token: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };
    user: {
      id: string;
      phone: string;
      role: string;
      is_active: boolean;
      created_at: string;
    };
    state: 'new' | 'existing';
    profile: {
      id: string | null;
      phone: string;
      business_name: string | null;
      status: string;
      onboarding_status: string;
    };
  };
  meta: VendorVerifyOtpInnerMeta;
} {
  const { cognitoTokens, userId, phone, userData, isNewUser, requestId } = params;
  const role = 'vendor';

  return {
    success: true,
    data: {
      token: {
        access_token: cognitoTokens.accessToken,
        refresh_token: cognitoTokens.refreshToken,
        expires_in: cognitoTokens.expiresIn,
        token_type: 'Bearer',
      },
      user: {
        id: userId,
        phone,
        role,
        is_active: userData?.is_active !== false,
        created_at: userData?.created_at || new Date().toISOString(),
      },
      state: isNewUser ? 'new' : 'existing',
      profile: {
        id: userId && userId.startsWith('temp_vendor_') ? null : userId,
        phone,
        business_name: userData?.business_name || null,
        status: userData?.status || 'pending',
        onboarding_status: userData?.onboarding_status || 'INIT',
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      version: 'v1',
    },
  };
}
