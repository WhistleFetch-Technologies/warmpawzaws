/**
 * Persist session after POST /auth/customer-portal-session (admin “open as customer”).
 * Aligns with customer-web OTP success path in app/auth/page.tsx.
 */
import { storeCognitoTokens, storeUserInfo } from '@/lib/cognito-auth';
import { persistCustomerDatabaseId } from '@/lib/customer-id-storage';

export type CustomerPortalSessionEnvelope = {
  success: boolean;
  data?: {
    token: {
      access_token: string;
      id_token: string;
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
    state: string;
    profile: {
      id: string;
      phone: string;
      full_name: string | null;
      email: string | null;
      has_password: boolean;
      username: string;
    };
  };
};

export function applyCustomerPortalSessionFromEnvelope(envelope: CustomerPortalSessionEnvelope): void {
  if (typeof window === 'undefined') return;
  const data = envelope?.data;
  if (!data?.token || !data?.user || !data?.profile) {
    throw new Error('Invalid session payload');
  }

  const accessToken = data.token.access_token;
  const idToken = data.token.id_token || accessToken;
  const refreshToken = data.token.refresh_token || '';
  const expiresIn = Number(data.token.expires_in) || 86400;

  storeCognitoTokens({
    accessToken,
    idToken,
    refreshToken,
    expiresIn,
  });

  storeUserInfo({
    userId: data.user.id,
    phone: data.user.phone,
    username: data.profile.username || data.user.phone,
  });

  const shortPhone = String(data.user.phone).replace(/\D/g, '').slice(-10);
  localStorage.setItem('customerPhone', shortPhone);
  localStorage.setItem('customer_phone', shortPhone);
  localStorage.setItem('phone', shortPhone);

  localStorage.setItem('authToken', accessToken);
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }

  const profileRecord = {
    id: data.profile.id,
    phone: data.profile.phone,
    full_name: data.profile.full_name,
    email: data.profile.email,
    name: data.profile.full_name,
  };
  localStorage.setItem('customerData', JSON.stringify(profileRecord));
  localStorage.setItem('customerProfile', JSON.stringify(profileRecord));
  persistCustomerDatabaseId(data.profile.id);

  sessionStorage.setItem('_warmpawz_has_session', 'true');
  sessionStorage.setItem('_warmpawz_just_logged_in', 'true');
}
