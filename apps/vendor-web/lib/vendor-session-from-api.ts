/**
 * Apply vendor session from the same payload shape as POST /auth/verify-otp success
 * (used by /auth/vendor-portal-session and auth page after login).
 */

/** Skip aggressive 401→/auth session clear for this long after bootstrap (admin portal tab, OTP, etc.). */
export const VENDOR_POST_LOGIN_401_GRACE_MS = 120_000;

const KNOWN_ONBOARDING = new Set([
  'INIT',
  'ROLE_PENDING',
  'FORM_PENDING',
  'UNDER_REVIEW',
  'CLARIFICATION_REQUIRED',
  'APPROVED',
  'REJECTED',
  'ACTIVATED',
]);

/** Normalize DB/API casing (e.g. `approved`) to the uppercase enums the dashboard expects. */
export function normalizeVendorApplicationStatus(status: string | null | undefined): string {
  const u = (status ?? 'INIT').toString().trim().toUpperCase();
  return KNOWN_ONBOARDING.has(u) ? u : u || 'INIT';
}

export function isVendorPortalActiveStatus(status: string | null | undefined): boolean {
  const n = normalizeVendorApplicationStatus(status);
  return n === 'APPROVED' || n === 'ACTIVATED';
}

export type VendorVerifySessionInput = {
  phone: string;
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user: Record<string, unknown>;
  profile: Record<string, unknown>;
  vendorId: string;
  onboardingStatus: string;
  /** E.g. "91" for India; defaults to "91" */
  countryCode?: string;
};

export type VendorAuthTokenBundle = {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  userId?: string;
  phone?: string;
};

/** Persist Cognito bundle so silent refresh works after OTP / portal bootstrap. */
export function persistVendorCognitoTokens(bundle: VendorAuthTokenBundle): void {
  if (typeof window === 'undefined') return;
  const accessToken = bundle.accessToken?.trim();
  if (!accessToken) return;

  const idToken = (bundle.idToken || accessToken).trim();
  let refreshToken = bundle.refreshToken?.trim() || '';
  if (!refreshToken && typeof window !== 'undefined') {
    try {
      const existing = JSON.parse(localStorage.getItem('vendorCognitoTokens') || 'null');
      if (existing?.refreshToken) refreshToken = String(existing.refreshToken);
    } catch {
      /* ignore */
    }
  }
  const expiresIn =
    typeof bundle.expiresIn === 'number' && Number.isFinite(bundle.expiresIn)
      ? bundle.expiresIn
      : 86400;

  try {
    const { storeCognitoTokens, storeUserInfo } = require('@/lib/cognito-auth');
    storeCognitoTokens(
      {
        accessToken,
        idToken,
        refreshToken,
        expiresIn,
      },
      { isNewLogin: true },
    );
    if (bundle.userId) {
      storeUserInfo({
        userId: String(bundle.userId),
        phone: bundle.phone || '',
        username: bundle.phone || String(bundle.userId),
      });
    }
  } catch (err) {
    console.warn('[vendor-session] persistVendorCognitoTokens skipped:', err);
  }
}

/**
 * Writes localStorage / sessionStorage to match VendorAuth post-verify + auth page handleAuthSuccess.
 */
export function applyVendorPortalSessionFromVerifyPayload(input: VendorVerifySessionInput): void {
  if (typeof window === 'undefined') return;

  const countryCode = input.countryCode || '91';

  localStorage.setItem('vendorPhone', input.phone);
  localStorage.setItem('authToken', input.accessToken);
  localStorage.setItem('vendorAuthToken', input.accessToken);
  localStorage.setItem('vendorCountryCode', countryCode);

  persistVendorCognitoTokens({
    accessToken: input.accessToken,
    idToken: input.idToken || input.accessToken,
    refreshToken: input.refreshToken,
    expiresIn: input.expiresIn,
    userId: input.vendorId || String((input.user as { id?: string }).id || ''),
    phone: input.phone,
  });

  if (input.vendorId) {
    localStorage.setItem('vendorId', input.vendorId);
  }
  if (input.user && Object.keys(input.user).length > 0) {
    localStorage.setItem('vendorUser', JSON.stringify(input.user));
  }
  if (input.profile && Object.keys(input.profile).length > 0) {
    localStorage.setItem('vendorData', JSON.stringify(input.profile));
    const bizName =
      (input.profile as { business_name?: string }).business_name ||
      (input.profile as { businessName?: string }).businessName ||
      '';
    if (bizName) {
      localStorage.setItem('vendorName', bizName);
      localStorage.setItem('businessName', bizName);
    }
    const roleId = (input.profile as { roleId?: string }).roleId || (input.profile as { role_id?: string }).role_id;
    if (roleId) {
      localStorage.setItem('vendorRole', String(roleId));
    }
  }
  const normalizedStatus = normalizeVendorApplicationStatus(input.onboardingStatus);
  localStorage.setItem('vendorApplicationStatus', normalizedStatus);

  sessionStorage.setItem('_warmpawz_vendor_just_logged_in', 'true');
  sessionStorage.setItem('_warmpawz_vendor_has_session', 'true');
  sessionStorage.setItem('_warmpawz_vendor_login_at', String(Date.now()));

  scheduleVendorPushRegistrationAfterLogin(input.vendorId);
}

export function scheduleVendorPushRegistrationAfterLogin(vendorId: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = vendorId?.trim();
  if (!/^[0-9a-f-]{36}$/i.test(trimmed)) return;
  queueMicrotask(() => {
    void Promise.all([import('./push-bootstrap'), import('./api-client')]).then(
      ([{ retryPushRegistration }, { apiClient }]) =>
        retryPushRegistration({
          userId: trimmed,
          userType: 'vendor',
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          apiClient,
        })
    );
  });
}

/** Derive dial country code from E.164-style phone when possible. */
export function guessCountryCodeFromPhone(phone: string): string {
  const p = (phone || '').trim();
  if (p.startsWith('+91')) return '91';
  if (p.startsWith('91') && p.length > 10) return '91';
  return '91';
}

/**
 * Unwrap verify-otp / vendor-portal-session API JSON to the flat fields VendorAuth uses.
 */
export function unwrapVerifyOtpResponseBody(verifyData: unknown): {
  phone: string;
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  user: Record<string, unknown>;
  profile: Record<string, unknown>;
  vendorId: string;
  onboardingStatus: string;
} | null {
  let responseData: any = verifyData;
  const v = verifyData as any;
  if (v?.data) {
    const d1 = v.data;
    if (d1?.data && (d1.data.token || d1.data.tokens || d1.data.user || d1.data.profile)) {
      responseData = d1.data;
    } else if (d1?.token || d1?.tokens || d1?.user || d1?.profile) {
      responseData = d1;
    } else {
      responseData = d1.data ? d1.data : d1;
    }
  }

  const tokens = responseData?.token || responseData?.tokens || {};
  const user = responseData?.user || {};
  const profile = responseData?.profile || {};

  const accessToken =
    tokens.access_token ||
    tokens.accessToken ||
    responseData?.token?.access_token ||
    responseData?.access_token;

  const idToken = tokens.id_token || tokens.idToken || accessToken;
  const refreshToken = tokens.refresh_token || tokens.refreshToken || '';
  const expiresInRaw = tokens.expires_in ?? tokens.expiresIn;
  const expiresIn =
    typeof expiresInRaw === 'number' && Number.isFinite(expiresInRaw) ? expiresInRaw : 86400;

  const u = user as { phone?: string; phone_number?: string };
  const p = profile as { phone?: string; phone_number?: string };
  const phone =
    (u.phone && String(u.phone).trim()) ||
    (u.phone_number && String(u.phone_number).trim()) ||
    (p.phone && String(p.phone).trim()) ||
    (p.phone_number && String(p.phone_number).trim()) ||
    '';
  const onboardingStatus = normalizeVendorApplicationStatus(
    (profile as { onboarding_status?: string }).onboarding_status ||
      responseData?.onboarding_status ||
      'INIT'
  );

  const vendorId = String((user as { id?: string }).id || (profile as { id?: string }).id || '');

  if (!accessToken || !phone) return null;

  return {
    phone,
    accessToken,
    idToken,
    refreshToken,
    expiresIn,
    user,
    profile,
    vendorId,
    onboardingStatus,
  };
}
