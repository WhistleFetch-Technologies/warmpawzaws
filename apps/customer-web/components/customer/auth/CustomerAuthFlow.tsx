'use client';

import React, { useState, useEffect, Fragment } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { apiClient, isUatMode } from '@/lib/api-client';
import { persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import { CountryCodeSelector } from '@/components/ui/CountryCodeSelector';
import {
  PlatformLegalPolicyDialog,
  type PlatformPolicyType,
} from '@/components/legal/PlatformLegalPolicyDialog';
import {
  clearCachedPetsForPhone,
  writeCachedPetsForPhone,
  stripPetsFromCustomerRecord,
} from '@/lib/customer-pets-cache';
import { parsePetsFromApiResponse } from '@/components/customer/home/hooks/useHomePageData';
import {
  getStoredCustomerJwtForSession,
  clearNeedsPasswordSetup,
} from '@/lib/session-utils';
import { X } from 'lucide-react';
import { CachedImage } from '@/components/shared/CachedImage';
import { AUTH_MODAL_FORM, getAuthModalLayoutClasses } from '@/components/customer/auth/auth-modal-ui';
import { LOGIN_OTP_RETRY_CONFIG } from '@/lib/forgot-password-cooldown';
import { resolveAuthModeFromParams, resolveSafeAuthReturnPath } from '@/lib/auth-redirect';
import { isGuestBrowsingEnabled } from '@/lib/guest-browsing-flag';
import { emitGuestAuthAnalytics } from '@/lib/guest-auth-gate';
import { AuthGateLoadingShell } from '@/components/AuthGateLoadingShell';

const AIChatbotWidget = dynamic(
  () => import('@/components/customer/AIChatbotWidget').then((m) => ({ default: m.AIChatbotWidget })),
  { ssr: false }
);

function dialablePhoneForChat(countryCode: string, phoneDigits: string): string | undefined {
  const d = phoneDigits.replace(/\D/g, '');
  if (d.length !== 10) return undefined;
  return `${countryCode.trim()}${d}`;
}

// UAT Mode: must match backend when UAT_MODE=true (`auth-enhanced.ts`)
const UAT_VALID_OTPS = ['123456', '12345678'] as const;

/** Top padding under notch / status bar (requires viewport-fit=cover in root layout). */
const authOrangeHeaderStyle = { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' } as const;

/** Brand shell: subtle same-orange gradient, clips pseudo highlights. */
const authShellClass =
  'min-h-screen flex justify-center overflow-hidden bg-gradient-to-b from-[#FF9A56] via-[#FF8C42] to-[#E86820]';
const authColumnClass =
  'w-full max-w-md min-h-screen flex flex-col overflow-hidden bg-gradient-to-b from-[#FF9A56] via-[#FF8C42] to-[#E86820]';
/** Very soft circular highlights; children need relative z-10 to sit above ::after. */
const authHeaderClass =
  'relative z-0 isolate overflow-hidden px-6 pb-20 flex flex-col items-center before:pointer-events-none before:absolute before:-top-32 before:left-1/2 before:-translate-x-1/2 before:h-[19rem] before:w-[19rem] before:rounded-full before:bg-white/20 before:blur-3xl before:opacity-90 after:pointer-events-none after:absolute after:top-1/2 after:-right-12 after:h-48 after:w-48 after:rounded-full after:bg-amber-100/35 after:blur-3xl after:opacity-80';
const authHeroH1Class =
  'text-2xl font-bold text-black italic text-center relative z-10 [text-shadow:0_1px_0_rgba(255,255,255,0.4),0_2px_14px_rgba(0,0,0,0.1)]';
const authHeroH2Class =
  'text-2xl font-bold text-black italic text-center relative z-10 [text-shadow:0_1px_0_rgba(255,255,255,0.4),0_2px_14px_rgba(0,0,0,0.1)]';
const authHeroTitleClass =
  'text-3xl font-extrabold text-black tracking-wide relative z-10 [text-shadow:0_1px_0_rgba(255,255,255,0.35),0_2px_16px_rgba(0,0,0,0.1)]';
const authHeroTaglineClass =
  'mt-3 text-center text-lg font-bold text-black tracking-wide relative z-10 [text-shadow:0_1px_0_rgba(255,255,255,0.3),0_1px_10px_rgba(0,0,0,0.08)]';
const authLogoRingClass =
  'relative z-10 w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-xl ring-1 ring-white/40 mb-6 p-2';
const authCardClass =
  'bg-white rounded-t-[2.5rem] min-h-full px-6 pt-10 ring-1 ring-black/5 shadow-[0_-10px_40px_-4px_rgba(0,0,0,0.1),0_8px_32px_rgba(0,0,0,0.06)] pb-[max(1.5rem,env(safe-area-inset-bottom))]';
const authInputGroupClass =
  'flex items-stretch border-2 border-gray-200/90 rounded-2xl overflow-hidden transition-all duration-200 focus-within:border-[#FF8C42] focus-within:ring-4 focus-within:ring-[#FF8C42]/20 bg-[#FFFBF7] focus-within:bg-white';
const authOtpInnerClass =
  'min-w-0 flex-1 py-4 px-4 text-lg text-center tracking-widest outline-none bg-transparent transition-colors duration-200';
const authPrimaryButtonClass =
  'w-full py-3.5 text-white text-lg font-semibold rounded-full border border-white/25 bg-gradient-to-b from-[#FF9A4A] to-[#FF7A2E] shadow-lg shadow-[#C85A10]/30 transition-all duration-200 hover:shadow-xl hover:shadow-[#C85A10]/40 hover:brightness-105 active:scale-[0.98] active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

/** Inline actions: brand orange, no underline until hover/focus; matches primary CTA palette. */
const authTextLinkCoreClass =
  'text-[#FF8C42] no-underline underline-offset-2 decoration-2 transition-colors hover:text-[#E86820] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42]/40 focus-visible:ring-offset-2 focus-visible:text-[#E86820] focus-visible:underline';
const authTextLinkClass = `${authTextLinkCoreClass} font-medium rounded-sm`;
/** Terms / Privacy inside gray copy: readable, tappable, same focus ring. */
const authTermsLinkClass =
  `${authTextLinkCoreClass} font-semibold rounded-sm py-0.5`;

function getAuthLayoutClasses(variant: 'page' | 'modal') {
  if (variant === 'page') {
    return {
      shell: authShellClass,
      column: authColumnClass,
      header: authHeaderClass,
      card: authCardClass,
      logoRing: authLogoRingClass,
      headerStyle: authOrangeHeaderStyle,
      heroH1: authHeroH1Class,
      heroH2: authHeroH2Class,
      heroTitle: authHeroTitleClass,
      heroTagline: authHeroTaglineClass,
    };
  }
  return getAuthModalLayoutClasses();
}

function setCustomerOnboardingCompleteFromAuth(value: 'true' | 'false'): void {
  if (typeof window === 'undefined') return;
  if (value === 'false' && localStorage.getItem('onboarding_completed') === 'true') return;
  localStorage.setItem('customerOnboardingComplete', value);
}

export type CustomerAuthCompleteResult = {
  redirectPath: string;
  needsPasswordSetup: boolean;
};

export type CustomerAuthFlowProps = {
  variant: 'page' | 'modal';
  initialMode?: 'login' | 'signup';
  returnPath?: string | null;
  onComplete: (result: CustomerAuthCompleteResult) => void;
  onDismiss?: () => void;
};

export function CustomerAuthFlow({
  variant,
  initialMode = 'login',
  returnPath: returnPathProp = null,
  onComplete,
  onDismiss,
}: CustomerAuthFlowProps) {
  const router = useRouter();
  const isModal = variant === 'modal';
  // For static export compatibility, use window.location.search directly instead of useSearchParams
  // This avoids hydration issues and works even if JavaScript loads slowly
  const [redirectAfterLogin, setRedirectAfterLogin] = useState<string | null>(
    isModal ? returnPathProp : null
  );
  const [guestBrowseEnabled, setGuestBrowseEnabled] = useState(false);
  /** Defer URL-driven login vs signup until after mount — avoids SSR/client HTML mismatch. */
  const [authUiReady, setAuthUiReady] = useState(isModal);

  const finishAuthenticated = (redirectPath: string) => {
    if (isModal) {
      onComplete({ redirectPath, needsPasswordSetup: false });
      return;
    }
    router.push(redirectPath);
  };

  useEffect(() => {
    if (!isModal) return;
    setGuestBrowseEnabled(isGuestBrowsingEnabled());
    setRedirectAfterLogin(returnPathProp);
    setAuthMode(initialMode);
    setAuthUiReady(true);
  }, [isModal, returnPathProp, initialMode]);

  useEffect(() => {
    if (isModal) return;
    // Get redirect + referral (?ref=) from URL after mount (client-side only)
    if (typeof window !== 'undefined') {
      const guestOn = isGuestBrowsingEnabled();
      setGuestBrowseEnabled(guestOn);
      const params = new URLSearchParams(window.location.search);
      // Accept both `redirect` (canonical) and legacy `next` for guest/share return URLs.
      const safeReturn = resolveSafeAuthReturnPath(params);
      if (safeReturn) {
        setRedirectAfterLogin(safeReturn);
      }
      // Guest-first: bare /auth (no return URL, no force login/signup) → home. Use ?login=1 or ?signup=1 to stay.
      const forceLogin = params.get('login') === '1' || params.get('forceLogin') === '1';
      const forceSignup = params.get('signup') === '1';
      if (
        guestOn &&
        !safeReturn &&
        !forceLogin &&
        !forceSignup &&
        !params.get('ref') &&
        !params.get('referral')
      ) {
        router.replace('/');
        return;
      }
      setAuthMode(resolveAuthModeFromParams(params));
      const refCode = params.get('ref') || params.get('referral') || params.get('referralCode');
      if (refCode && refCode.trim()) {
        const c = refCode.trim().toUpperCase();
        setReferralCode(c);
        setShowReferralModal(true);
        setReferralApplied(true);
        localStorage.setItem('pendingReferralCode', c);
      }
      setAuthUiReady(true);
    }
  }, [router, isModal]);
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91'); // Default to India
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [uatHint, setUatHint] = useState(false);

  // Referral code state
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralApplied, setReferralApplied] = useState(false);
  const [legalDialogOpen, setLegalDialogOpen] = useState(false);
  const [legalDialogType, setLegalDialogType] = useState<PlatformPolicyType | null>(null);
  const [helpChatOpen, setHelpChatOpen] = useState(false);
  /** URL-driven after mount: login=1 and signup=1 both render OTP. */
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const layout = getAuthLayoutClasses(variant);
  const modalForm = isModal ? AUTH_MODAL_FORM : null;
  const inputGroupCls = modalForm?.inputGroup ?? authInputGroupClass;
  const otpInnerCls = modalForm?.otpInner ?? authOtpInnerClass;
  const primaryBtnCls = modalForm?.primaryButton ?? authPrimaryButtonClass;
  const textLinkCls = modalForm?.textLink ?? authTextLinkClass;
  const termsLinkCls = modalForm?.termsLink ?? authTermsLinkClass;
  const cardWrapCls = isModal
    ? (layout as ReturnType<typeof getAuthModalLayoutClasses>).cardWrap
    : 'flex-1 -mt-8 relative overflow-hidden';

  const openLegal = (t: PlatformPolicyType) => {
    setLegalDialogType(t);
    setLegalDialogOpen(true);
  };

  const guestHelpChat = helpChatOpen ? (
    <AIChatbotWidget
      presentation="modal"
      customerPhone={dialablePhoneForChat(countryCode, phone)}
      onClose={() => setHelpChatOpen(false)}
      onNavigate={(dest) => {
        if (typeof dest === 'string' && dest.startsWith('/')) {
          setHelpChatOpen(false);
          router.push(dest);
        }
      }}
    />
  ) : null;

  const legalDialog = (
    <PlatformLegalPolicyDialog
      open={legalDialogOpen}
      onOpenChange={(o) => {
        setLegalDialogOpen(o);
        if (!o) setLegalDialogType(null);
      }}
      policyType={legalDialogType}
    />
  );

  // UAT_MODE must be computed at runtime (after hydration) for static exports
  const [UAT_MODE, setUatMode] = useState(false);
  useEffect(() => {
    setUatMode(isUatMode());
  }, []);

  useEffect(() => {
    const { initializeSession } = require('@/lib/session-utils');
    initializeSession();
  }, []);

  useEffect(() => {
    if (isModal) return;
    // Check if already logged in (after session init)
    const storedPhone = localStorage.getItem('customerPhone');
    const cognitoAuth = require('@/lib/cognito-auth') as typeof import('@/lib/cognito-auth');
    const { isTokenExpired } = require('@/lib/session-utils');

    if (!storedPhone || !cognitoAuth.isAuthenticated()) {
      return;
    }

    const storedJwt = getStoredCustomerJwtForSession();

    if (storedJwt && !isTokenExpired(storedJwt)) {
      const redirect = (typeof window !== 'undefined' && window.location?.search)
        ? new URLSearchParams(window.location.search).get('redirect') : null;
      finishAuthenticated(redirect && redirect.startsWith('/') ? redirect : '/');
      return;
    }

    cognitoAuth.refreshCognitoTokensIfNeeded().then(() => {
      const jwtAfter = getStoredCustomerJwtForSession();
      if (jwtAfter && !isTokenExpired(jwtAfter)) {
        const redirect = (typeof window !== 'undefined' && window.location?.search)
          ? new URLSearchParams(window.location.search).get('redirect') : null;
        finishAuthenticated(redirect && redirect.startsWith('/') ? redirect : '/');
      } else if (!cognitoAuth.isAuthenticated()) {
        const { clearCustomerSession } = require('@/lib/session-utils');
        clearCustomerSession();
      }
    });
  }, [router, isModal]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Format phone number with spaces (74493 38923)
  const formatPhoneDisplay = (num: string) => {
    if (num.length <= 5) return num;
    return `${num.slice(0, 5)} ${num.slice(5)}`;
  };

  // Otp sending & UAT mode handling
  const sendOtp = async () => {
    if (!phone || phone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    if (UAT_MODE) {
      console.log('🔧 [UAT Mode] OTP bypassed. Use one of:', UAT_VALID_OTPS.join(', '));
      setOtpSent(true);
      setResendTimer(60);
      setUatHint(true);
      setError(null);
      if (referralCode?.trim()) {
        localStorage.setItem('pendingReferralCode', referralCode.trim().toUpperCase());
      }
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await apiClient.post(
        '/auth/otp/send',
        {
          phone: `${countryCode}${phone}`,
          role: 'customer',
        },
        LOGIN_OTP_RETRY_CONFIG
      );
      setOtpSent(true);
      setResendTimer(60);
      if (referralCode?.trim()) {
        localStorage.setItem('pendingReferralCode', referralCode.trim().toUpperCase());
      }
    } catch (err: any) {
      const code = err?.responseData?.error?.code || err?.code;
      if (code === 'OTP_DELIVERY_FAILED' || err?.statusCode === 503) {
        setError('Could not send SMS. Try again in a minute.');
      } else {
        setError(err.message || 'Failed to send OTP');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const otpTrim = otp?.trim() ?? '';
    if (!otpTrim) {
      setError('Please enter the OTP');
      return;
    }
    if (UAT_MODE) {
      if (!/^\d{6}$|^\d{8}$/.test(otpTrim)) {
        setError('UAT: enter 6-digit OTP or 8-digit bypass (see hint below)');
        return;
      }
    } else if (otpTrim.length !== 6 || !/^\d{6}$/.test(otpTrim)) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    const pendingReferral = localStorage.getItem('pendingReferralCode')?.trim().toUpperCase() || '';
    const trimmedReferral = referralCode?.trim()
      ? referralCode.trim().toUpperCase()
      : pendingReferral;

    try {
      setLoading(true);
      setError(null);

      const fullPhoneForApi = `${countryCode}${phone}`;
      const response = await apiClient.post<any>('/auth/otp/verify', {
        phone: fullPhoneForApi,
        otp: otpTrim,
        role: 'customer',
        referralCode: trimmedReferral || undefined,
        pendingReferralCode: trimmedReferral || undefined,
      });

      // Handle nested response structure: { success: true, data: { success: true, data: {...} } }
      const responseData = response.data?.data || response.data || response;
      const isVerified = response.success || response.verified || responseData?.success || responseData?.verified;

      console.log('🔍 [Auth] OTP Verify Response:', {
        success: response.success,
        verified: response.verified,
        hasData: !!response.data,
        hasNestedData: !!response.data?.data,
        responseData: responseData,
        isVerified
      });

      if (isVerified) {
        console.log('✅ [Auth] OTP verified successfully - proceeding with token storage and navigation');
        const shortPhone = phone.replace(/\D/g, '').slice(-10);
        clearCachedPetsForPhone();
        localStorage.setItem('customerPhone', shortPhone);
        localStorage.setItem('customer_phone', shortPhone);
        localStorage.setItem('phone', shortPhone);
        localStorage.setItem('customerCountryCode', countryCode);

        // Extract token from nested structure: response.data.data.token or response.token
        const tokenData = responseData?.token || response.token || response;
        const accessToken = tokenData?.access_token || tokenData?.accessToken || response.accessToken;
        const refreshToken = tokenData?.refresh_token || tokenData?.refreshToken || response.refreshToken;
        const idToken = tokenData?.id_token || tokenData?.idToken || response.idToken;
        const expiresIn = tokenData?.expires_in || tokenData?.expiresIn || response.expiresIn || 86400;

        // Store Cognito tokens (AWS Serverless compatible)
        if (idToken && accessToken) {
          const { storeCognitoTokens, storeUserInfo } = require('@/lib/cognito-auth');
          storeCognitoTokens(
            {
              accessToken: accessToken,
              idToken: idToken,
              refreshToken: refreshToken || '',
              expiresIn: expiresIn,
            },
            { isNewLogin: true }
          );
          localStorage.setItem('authToken', idToken || accessToken);
          const userData = responseData?.user || response.user;
          const prof = responseData?.profile;
          if (userData?.id) {
            storeUserInfo({
              userId: userData.id,
              phone: shortPhone,
              username: prof?.username || userData.phone || shortPhone,
            });
          }
        } else if (accessToken) {
          // Fallback to legacy token storage
          localStorage.setItem('authToken', accessToken);
          if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
          }
        }

        // Set sessionStorage flags to track that user is logged in
        // These flags are cleared on hard refresh, allowing us to detect it
        sessionStorage.setItem('_warmpawz_has_session', 'true');
        sessionStorage.setItem('_warmpawz_just_logged_in', 'true'); // ✅ FIX: Prevent session clearing right after login
        console.log('✅ [Auth] sessionStorage flags set after OTP verification');

        if (trimmedReferral) {
          localStorage.setItem('pendingReferralCode', trimmedReferral);
        }

        // Get customer profile; cache pets for app use without using pet count for routing
        try {
          const profileResponse = await apiClient.get<any>(
            `/customer/profile/unified/${encodeURIComponent(shortPhone)}`
          );
          console.log('✅ [Auth] Profile response:', profileResponse);

          if (profileResponse?.profile) {
            const profile = profileResponse.profile;
            const onboardingStatus = profile.onboarding_status || profile.onboardingStatus || 'INIT';
            const profileCompletedFlag = profile.profile_completed || profile.onboardingComplete || false;
            const nameVal = profile.name || profile.full_name || '';
            const digits = phone.replace(/\D/g, '').slice(-10);
            const hasName =
              !!nameVal &&
              String(nameVal).trim() !== '' &&
              nameVal !== `Customer ${digits.slice(-4)}`;
            const hasBookings = (profile.bookings?.length || 0) > 0;
            const hasProfileId = !!profile.id;

            console.log('📊 [Auth] Profile check:', {
              onboardingStatus,
              profileCompleted: profileCompletedFlag,
              hasName,
              hasBookings,
            });

            localStorage.setItem('customerData', JSON.stringify(stripPetsFromCustomerRecord(profile)));
            localStorage.setItem('customerProfile', JSON.stringify(stripPetsFromCustomerRecord(profile)));
            persistCustomerDatabaseId(profile);

            try {
              const petsResponse = await apiClient.get<any>(`/customer/pets/${shortPhone}`);
              const pets = parsePetsFromApiResponse(petsResponse);
              writeCachedPetsForPhone(shortPhone, pets);
            } catch (petError) {
              console.warn('⚠️ [Auth] Pets fetch:', petError);
              writeCachedPetsForPhone(shortPhone, []);
            }

            const backendFullyOnboarded =
              onboardingStatus === 'COMPLETED' || profileCompletedFlag === true;
            const hasMeaningfulProfile =
              (hasProfileId && hasName) || (hasProfileId && hasBookings);

            if (backendFullyOnboarded || hasMeaningfulProfile) {
              localStorage.setItem('profile_completed', 'true');
              localStorage.setItem('onboarding_completed', 'true');
              setCustomerOnboardingCompleteFromAuth('true');
              console.log('✅ [Auth] Profile ready — skip stage selection');
            } else {
              setCustomerOnboardingCompleteFromAuth('false');
              console.log('🆕 [Auth] New customer — start at profile');
            }
          } else {
            console.warn('⚠️ [Auth] No profile in response:', profileResponse);
            setCustomerOnboardingCompleteFromAuth('false');
          }
        } catch (profileError: any) {
          console.error('❌ [Auth] Error fetching profile:', profileError);
          // ✅ FIX: If profile fetch fails but customer exists, check localStorage for cached data
          const cachedProfile = localStorage.getItem('customerProfile');
          const cachedOnboarding = localStorage.getItem('customerOnboardingComplete');
          const stageSelectionDone = localStorage.getItem('onboarding_completed') === 'true';

          if (cachedProfile && (cachedOnboarding === 'true' || stageSelectionDone)) {
            console.log('✅ [Auth] Using cached profile data');
            // Keep existing onboarding status
          } else {
            // Customer doesn't exist yet - will be created by backend on first profile access
            setCustomerOnboardingCompleteFromAuth('false');
            console.log('🆕 [Auth] No cached profile - new customer');
          }
        }

        const redirectPath =
          redirectAfterLogin && redirectAfterLogin.startsWith('/') ? redirectAfterLogin : '/';

        emitGuestAuthAnalytics('login_completed');
        emitGuestAuthAnalytics('identity_authenticated');
        clearNeedsPasswordSetup();
        console.log('🚀 [Auth] Navigating to:', redirectPath);
        finishAuthenticated(redirectPath);
      } else {
        console.error('❌ [Auth] OTP verification failed - response:', response);
        setError('Invalid OTP. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  if (!authUiReady) {
    return <AuthGateLoadingShell />;
  }

  const renderModalHeroChrome = () => (
    <>
      {'headerPattern' in layout && layout.headerPattern ? (
        <div className={layout.headerPattern} aria-hidden="true" />
      ) : null}
      {isModal && onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full text-white/95 transition hover:text-white hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <X className="h-4 w-4 stroke-[2.5]" aria-hidden />
        </button>
      ) : null}
    </>
  );

  // OTP VERIFICATION SCREEN
  if (otpSent) {
    return (
      <Fragment>
      <div className={layout.shell}>
        {/* Centered Container */}
        <div className={layout.column}>
          {/* Orange Header Section */}
          <div className={layout.header} style={layout.headerStyle}>
            {renderModalHeroChrome()}
            {/* Warmpawz Logo */}
            <div className={layout.logoRing}>
              <CachedImage src="/logo.webp" alt="Warmpawz" className="w-full h-full object-contain" />
            </div>

            {/* Title */}
            <h1 className={layout.heroH1}>
              Verify Your
            </h1>
            <h2 className={layout.heroH2}>
              Number
            </h2>
          </div>

          {/* White Card Section */}
          <div className={cardWrapCls}>
            <div className={layout.card}>
              {/* Subtitle */}
              <div className="text-center mb-8">
                <p className="text-gray-600 text-sm mb-1">Enter the OTP sent to</p>
                <p className="text-gray-900 font-semibold">{countryCode} {formatPhoneDisplay(phone)}</p>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <span className="text-red-500 text-xl">⚠️</span>
                  <p className="text-red-600 text-sm flex-1">{error}</p>
                </div>
              )}

              {/* UAT Hint */}
              {uatHint && !isModal && (
                <div className="mb-6 p-4 bg-gradient-to-r from-[#FF8C42]/10 to-[#FF6B9D]/10 rounded-xl text-center">
                  <p className="text-[#FF8C42] text-sm font-medium">
                    🧪 UAT Mode: OTP <strong>{UAT_VALID_OTPS.join(' or ')}</strong>
                  </p>
                </div>
              )}

              {/* OTP Input Section */}
              <div className="space-y-4">
                <label className="block text-gray-700 font-medium mb-2">Verification Code</label>

                {/* 6-digit OTP Input */}
                <div className={inputGroupCls}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit code"
                    className={otpInnerCls}
                    autoFocus
                  />
                </div>

                {/* Verify Button */}
                <button
                  onClick={verifyOtp}
                  disabled={loading || otp.length !== 6}
                  className={primaryBtnCls}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Verifying...
                    </span>
                  ) : (
                    'Verify & Continue'
                  )}
                </button>

                {/* Resend OTP */}
                <div className="text-center mt-4">
                  {resendTimer > 0 ? (
                    <p className="text-gray-500 text-sm">
                      Resend OTP in <span className="font-medium text-gray-700">{resendTimer}s</span>
                    </p>
                  ) : (
                    <button
                      onClick={sendOtp}
                      disabled={loading}
                      type="button"
                      className={`text-sm disabled:opacity-50 disabled:no-underline ${textLinkCls}`}
                    >
                      Resend Code
                    </button>
                  )}
                </div>

                {/* Help Links */}
                <div className="text-center mt-4 space-y-3">
                  <p className="text-sm text-gray-600">
                    Trouble with verification?{' '}
                    <button
                      type="button"
                      onClick={() => setHelpChatOpen(true)}
                      className={`text-sm ${textLinkCls}`}
                    >
                      Get Help
                    </button>
                  </p>
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtp(''); setError(null); }}
                    className={`text-sm ${textLinkCls}`}
                  >
                    &lt; Change phone number
                  </button>
                </div>
              </div>

              <p className="text-center text-sm text-gray-500 mt-6 px-2">
                By continuing, you agree to our{' '}
                <button
                  type="button"
                  onClick={() => openLegal('customer_terms_of_service')}
                  className={`${termsLinkCls} align-baseline`}
                >
                  Customer Terms of Service
                </button>
                {' '}and{' '}
                <button
                  type="button"
                  onClick={() => openLegal('privacy_policy')}
                  className={`${termsLinkCls} align-baseline`}
                >
                  Privacy Policy
                </button>
              </p>

              {/* Footer with Version Info */}
              <div className="mt-auto pt-10 text-center space-y-1">
                <p className="text-gray-400 text-xs">WARMPAWZ Provider v2.1.0</p>
                <p className="text-gray-400 text-xs">© 2025 WARMPAWS Inc. All rights reserved</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {guestHelpChat}
      {legalDialog}
      </Fragment>
    );
  }

  // PHONE NUMBER ENTRY SCREEN
  return (
    <Fragment>
    <div className={layout.shell}>
      {/* Centered Container */}
      <div className={layout.column}>
        {/* Orange Header Section */}
        <div className={layout.header} style={layout.headerStyle}>
          {renderModalHeroChrome()}
          {/* Warmpawz Logo */}
          <div className={layout.logoRing}>
            <CachedImage src="/logo.webp" alt="Warmpawz" className="w-full h-full object-contain" />
          </div>

          {/* Welcome Text */}
          <h1 className={layout.heroH1}>Welcome to</h1>
          <h2 className={layout.heroTitle}>WARMPAWZ!</h2>
          <p className={layout.heroTagline}>
            Pet Care . Reimagined .
          </p>
        </div>

        {/* White Card Section */}
        <div className={cardWrapCls}>
          <div className={layout.card}>
            {/* Subtitle */}
            {isModal && authMode === 'signup' ? (
              <>
                <p className={modalForm?.description}>
                  Join our community of pet lovers and access
                  <br />
                  the best care for your furry friends
                </p>
                <h2 className={modalForm?.sectionTitle}>Create Your Account</h2>
              </>
            ) : (
            <p className={isModal ? modalForm?.description : 'text-center text-gray-600 mb-8 text-base leading-relaxed'}>
              {authMode === 'login' ? (
                <>
                  Log in with your mobile number.<br />
                  We’ll send a one-time OTP to verify.
                </>
              ) : (
                <>
                  Join our community of pet lovers and access<br />the best care for your furry friends
                </>
              )}
            </p>
            )}

            {/* Guest browsing is home `/`, not `/auth` — offer escape when flag is on */}
            {guestBrowseEnabled && (
              <div className={isModal ? modalForm?.guestBrowseWrap : 'mb-6 text-center'}>
                <button
                  type="button"
                  onClick={() => {
                    if (isModal) {
                      onDismiss?.();
                      return;
                    }
                    router.replace('/');
                  }}
                  className={
                    isModal
                      ? modalForm?.guestBrowseButton
                      : 'w-full rounded-xl border-2 border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 hover:bg-orange-100'
                  }
                >
                  Continue browsing without login
                </button>
                <p className={isModal ? modalForm?.guestBrowseHint : 'mt-2 text-xs text-gray-500'}>
                  Guest mode opens the home screen. Login is only needed for bookings and account.
                </p>
              </div>
            )}

            {/* UAT Mode Message */}
            {UAT_MODE && !isModal && (
              <div className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-xl text-center">
                <p className="text-yellow-800 text-sm font-semibold mb-1">
                  🧪 UAT MODE ACTIVE
                </p>
                <p className="text-yellow-700 text-xs">
                  OTP <strong className="font-bold">{UAT_VALID_OTPS.join(' or ')}</strong> — no SMS. Full JWTs
                  from <code className="text-xs">/auth/otp/verify</code>.
                </p>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div className={`${isModal ? 'mb-3 p-3' : 'mb-6 p-4'} bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5`}>
                <span className={`text-red-500 ${isModal ? 'text-lg' : 'text-xl'}`}>⚠️</span>
                <p className={`text-red-600 flex-1 ${isModal ? 'text-xs' : 'text-sm'}`}>{error}</p>
              </div>
            )}

            {/* Phone + OTP (login and signup) */}
            <div className={isModal ? 'space-y-2' : 'space-y-4'}>
              <label className={isModal ? modalForm?.phoneLabel : 'block text-gray-700 font-medium mb-2'}>
                Phone Number
              </label>

              {/* Phone Input with Country Code Selector */}
              <div className={inputGroupCls}>
                <CountryCodeSelector
                  selectedCode={countryCode}
                  onSelect={setCountryCode}
                  disabled={false}
                  compact={isModal}
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="74493 38923"
                  className={
                    isModal
                      ? 'min-w-0 flex-1 h-full px-2.5 text-[13px] outline-none bg-transparent placeholder:text-gray-400'
                      : 'min-w-0 flex-1 py-4 px-4 text-lg outline-none bg-transparent transition-colors duration-200'
                  }
                  autoFocus
                />
              </div>

              {/* Referral Code Section */}
              <div className={isModal ? 'mt-2' : 'mt-4'}>
                {!showReferralModal ? (
                  <button
                    type="button"
                    onClick={() => setShowReferralModal(true)}
                    className={
                      isModal
                        ? modalForm?.referralTrigger
                        : 'w-full py-3 border-2 border-dashed border-gray-300 rounded-2xl text-gray-600 hover:border-[#FF8C42] hover:text-[#FF8C42] transition-all flex items-center justify-center gap-2'
                    }
                  >
                    {isModal ? (
                      '+ Have a referral code?'
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Have a referral code?
                      </>
                    )}
                  </button>
                ) : (
                  <div
                    className={
                      isModal
                        ? modalForm?.referralPanel
                        : 'overflow-hidden p-4 border-2 border-[#FF8C42]/30 rounded-2xl bg-[#FF8C42]/5'
                    }
                  >
                    <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
                      <label className="text-gray-700 font-medium text-sm truncate">Referral Code (Optional)</label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowReferralModal(false);
                          setReferralCode('');
                          setReferralApplied(false);
                        }}
                        className="shrink-0 text-gray-400 hover:text-gray-600 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="flex w-full min-w-0 gap-2">
                      <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => {
                          setReferralCode(e.target.value.toUpperCase());
                          setReferralApplied(false);
                        }}
                        placeholder="Enter referral code"
                        maxLength={20}
                        className={
                          isModal
                            ? modalForm?.referralInput
                            : 'min-w-0 flex-1 w-full px-4 py-3 border-2 border-gray-200/90 rounded-xl text-sm uppercase bg-[#FFFBF7] transition-all duration-200 focus:border-[#FF8C42] focus:outline-none focus:ring-4 focus:ring-[#FF8C42]/20 focus:bg-white'
                        }
                      />
                      {referralCode && !referralApplied && (
                        <button
                          type="button"
                          onClick={() => setReferralApplied(true)}
                          className={
                            isModal
                              ? modalForm?.referralApply
                              : 'shrink-0 px-4 py-2.5 text-sm font-medium rounded-full border border-white/25 text-white bg-gradient-to-b from-[#FF9A4A] to-[#FF7A2E] shadow-md shadow-[#C85A10]/30 transition-all duration-200 hover:shadow-lg hover:brightness-105 active:brightness-95'
                          }
                        >
                          Apply
                        </button>
                      )}
                    </div>
                    {referralApplied && referralCode && (
                      <div className="mt-3 flex items-center gap-2 text-green-600 text-sm">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Referral code applied! You'll earn bonus points after signup!
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Send Code Button */}
              <button
                onClick={sendOtp}
                disabled={loading || phone.length !== 10}
                className={`${primaryBtnCls} ${isModal ? 'mt-3' : 'mt-6'}`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Send Verification Code'
                )}
              </button>
            </div>

            {/* Terms Footer */}
            <p className={isModal ? modalForm?.legalParagraph : 'text-center text-sm text-gray-500 mt-6'}>
              By continuing, you agree to our{' '}
              <button
                type="button"
                onClick={() => openLegal('customer_terms_of_service')}
                className={`${termsLinkCls} align-baseline`}
              >
                Customer Terms of Service
              </button>
              {' '}and{' '}
              <button
                type="button"
                onClick={() => openLegal('privacy_policy')}
                className={`${termsLinkCls} align-baseline`}
              >
                Privacy Policy
              </button>
            </p>

            {/* Footer with Version Info */}
            <div className={isModal ? modalForm?.footerBlock : `mt-auto text-center space-y-1 pt-8`}>
              <button
                type="button"
                onClick={() => setHelpChatOpen(true)}
                className={isModal ? `${modalForm?.footerHelp} ${textLinkCls}` : `text-sm ${textLinkCls}`}
              >
                Need Help?
              </button>
              <p className={isModal ? modalForm?.footerVersion : 'text-gray-400 text-xs'}>
                WARMPAWZ Customer v2.1.0
                {isModal ? ' · © 2025 WARMPAWZ Inc.' : null}
              </p>
              {!isModal ? (
              <p className="text-gray-400 text-xs">
                © 2025 WARMPAWZ Inc. All rights reserved
              </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Referral Code Modal Overlay - Alternative full-screen modal */}
      {/* This can be enabled if you prefer a modal approach */}
    </div>
    {guestHelpChat}
    {legalDialog}
    </Fragment>
  );
}
