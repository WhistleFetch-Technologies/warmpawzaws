'use client';

import React, { useState, useEffect, useRef, Fragment } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { apiClient, isUatMode } from '@/lib/api-client';
import { persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import { applyUnifiedProfileToCustomerLocalStorage } from '@/lib/customer-flow-guards';
import { CountryCodeSelector, COUNTRY_CODES } from '@/components/ui/CountryCodeSelector';
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
  setNeedsPasswordSetupAfterOtp,
  clearNeedsPasswordSetup,
} from '@/lib/session-utils';
import { Eye, EyeOff } from 'lucide-react';
import {
  FORGOT_PASSWORD_RETRY_CONFIG,
  LOGIN_OTP_RETRY_CONFIG,
  formatForgotCooldownMessage,
  formatResetRecentlyMessage,
  forgotCooldownStorageKey,
  persistForgotCooldown,
  readForgotCooldownRemaining,
  readRetryAfterSecondsFromError,
  readRetryAfterSecondsFromSuccess,
} from '@/lib/forgot-password-cooldown';

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
const authFieldClass =
  'w-full py-4 px-4 text-lg border-2 border-gray-200/90 rounded-2xl outline-none bg-[#FFFBF7] transition-all duration-200 focus:border-[#FF8C42] focus:ring-4 focus:ring-[#FF8C42]/20 focus:bg-white';
const authFieldInGroupClass =
  'w-full py-4 pl-4 pr-14 text-lg border-2 border-gray-200/90 rounded-2xl outline-none bg-[#FFFBF7] transition-all duration-200 focus:border-[#FF8C42] focus:ring-4 focus:ring-[#FF8C42]/20 focus:bg-white';
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
/** “New user?” CTA: soft pill behind the same link behavior; Forgot password stays plain text. */
const authSignupPillLinkClass =
  `${authTextLinkCoreClass} font-medium inline-flex justify-center rounded-full px-4 py-2 bg-[#FF8C42]/10 hover:bg-[#FF8C42]/15`;
/** Terms / Privacy inside gray copy: readable, tappable, same focus ring. */
const authTermsLinkClass =
  `${authTextLinkCoreClass} font-semibold rounded-sm py-0.5`;

function setCustomerOnboardingCompleteFromAuth(value: 'true' | 'false'): void {
  if (typeof window === 'undefined') return;
  if (value === 'false' && localStorage.getItem('onboarding_completed') === 'true') return;
  localStorage.setItem('customerOnboardingComplete', value);
}

function AuthPageContent() {
  const router = useRouter();
  // For static export compatibility, use window.location.search directly instead of useSearchParams
  // This avoids hydration issues and works even if JavaScript loads slowly
  const [redirectAfterLogin, setRedirectAfterLogin] = useState<string | null>(null);

  useEffect(() => {
    // Get redirect + referral (?ref=) from URL after mount (client-side only)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      if (redirect) {
        setRedirectAfterLogin(redirect);
      }
      const refCode = params.get('ref') || params.get('referral') || params.get('referralCode');
      if (refCode && refCode.trim()) {
        const c = refCode.trim().toUpperCase();
        setReferralCode(c);
        setShowReferralModal(true);
        setReferralApplied(true);
        localStorage.setItem('pendingReferralCode', c);
        setAuthMode('signup');
      }
    }
  }, []);
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
  /** Default: password login. OTP signup opens from "New user?" or referral links. */
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  /** Forgot password: dedicated server routes (never generic send-otp for reset). */
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotInfo, setForgotInfo] = useState<string | null>(null);
  const [forgotSuccessBanner, setForgotSuccessBanner] = useState<string | null>(null);
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotResendTimer, setForgotResendTimer] = useState(0);
  const forgotRequestGen = useRef(0);

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
    // Initialize session (clears on hard refresh)
    const { initializeSession } = require('@/lib/session-utils');
    initializeSession();

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
      router.push(redirect && redirect.startsWith('/') ? redirect : '/');
      return;
    }

    cognitoAuth.refreshCognitoTokensIfNeeded().then(() => {
      const jwtAfter = getStoredCustomerJwtForSession();
      if (jwtAfter && !isTokenExpired(jwtAfter)) {
        const redirect = (typeof window !== 'undefined' && window.location?.search)
          ? new URLSearchParams(window.location.search).get('redirect') : null;
        router.push(redirect && redirect.startsWith('/') ? redirect : '/');
      } else if (!cognitoAuth.isAuthenticated()) {
        const { clearCustomerSession } = require('@/lib/session-utils');
        clearCustomerSession();
      }
    });
  }, [router]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  useEffect(() => {
    if (forgotResendTimer > 0) {
      const timer = setTimeout(() => setForgotResendTimer(forgotResendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [forgotResendTimer]);

  useEffect(() => {
    if (!forgotOpen) return;
    const key = forgotCooldownStorageKey(forgotUsername.trim() || loginUsername.trim());
    setForgotResendTimer(readForgotCooldownRemaining(key));
  }, [forgotOpen, forgotUsername, loginUsername]);

  // Format phone number with spaces (74493 38923)
  const formatPhoneDisplay = (num: string) => {
    if (num.length <= 5) return num;
    return `${num.slice(0, 5)} ${num.slice(5)}`;
  };

  // Get selected country details
  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];


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

  const passwordLogin = async () => {
    const user = loginUsername.trim();
    const pass = loginPassword.trim();
    if (!user || !pass) {
      setError('Enter phone number and password');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = await apiClient.post<any>('/auth/login', {
        username: user,
        password: pass,
        role: 'customer',
      });
      const responseData = (body as any).data?.data || (body as any).data || body;
      const isOk = (body as any).success ?? responseData?.success;
      const inner = responseData?.data && responseData.data.token ? responseData.data : responseData;
      if (!isOk || !inner?.token) {
        setError('Login failed');
        return;
      }

      const tokenData = inner.token;
      const accessToken = tokenData.access_token || tokenData.accessToken;
      const refreshToken = tokenData.refresh_token || tokenData.refreshToken;
      const idToken = tokenData.id_token || tokenData.idToken;
      const expiresIn = tokenData.expires_in || tokenData.expiresIn || 86400;
      const userData = inner.user;
      const profile = inner.profile;

      const digits = String(userData?.phone || user)
        .replace(/\D/g, '')
        .slice(-10);
      if (digits.length >= 10) {
        clearCachedPetsForPhone();
        localStorage.setItem('customerPhone', digits);
        localStorage.setItem('customer_phone', digits);
        localStorage.setItem('phone', digits);
      }

      if (idToken && accessToken) {
        const { storeCognitoTokens, storeUserInfo } = require('@/lib/cognito-auth');
        storeCognitoTokens(
          {
          accessToken,
          idToken,
          refreshToken: refreshToken || '',
          expiresIn,
          },
          { isNewLogin: true }
        );
        localStorage.setItem('authToken', idToken || accessToken);
        if (userData?.id) {
          storeUserInfo({
            userId: userData.id,
            phone: digits || user,
            username: profile?.username || user,
          });
        }
      } else if (accessToken) {
        localStorage.setItem('authToken', accessToken);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      }

      sessionStorage.setItem('_warmpawz_has_session', 'true');
      sessionStorage.setItem('_warmpawz_just_logged_in', 'true');
      clearNeedsPasswordSetup();

      try {
        const phoneKey = localStorage.getItem('customerPhone') || digits;
        if (phoneKey && phoneKey.length >= 10) {
          const profileResponse = await apiClient.get<any>(
            `/customer/profile/unified/${encodeURIComponent(phoneKey)}`
          );
          if (profileResponse?.profile) {
            localStorage.setItem(
              'customerData',
              JSON.stringify(stripPetsFromCustomerRecord(profileResponse.profile))
            );
            localStorage.setItem(
              'customerProfile',
              JSON.stringify(stripPetsFromCustomerRecord(profileResponse.profile))
            );
            persistCustomerDatabaseId(profileResponse.profile);
            const tenDigits = (localStorage.getItem('customerPhone') || digits)
              .replace(/\D/g, '')
              .slice(-10);
            applyUnifiedProfileToCustomerLocalStorage(profileResponse.profile, tenDigits);
          }
        }
      } catch {
        /* optional */
      }

      const redirectPath =
        redirectAfterLogin && redirectAfterLogin.startsWith('/') ? redirectAfterLogin : '/';
      router.push(redirectPath);
    } catch (err: any) {
      const code = err?.responseData?.error?.code || err?.code;
      if (code === 'PASSWORD_NOT_SET') {
        setError('Use Sign up with OTP once to verify your phone, then create a password.');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  function pickForgotResponseData(res: unknown): Record<string, unknown> | null {
    const r = res as Record<string, unknown> | null;
    if (!r || typeof r !== 'object') return null;
    const outer = r.data as Record<string, unknown> | undefined;
    if (outer && typeof outer === 'object' && outer.data && typeof outer.data === 'object') {
      return outer.data as Record<string, unknown>;
    }
    return null;
  }

  function forgotCooldownKey(username?: string) {
    return forgotCooldownStorageKey((username ?? forgotUsername).trim() || loginUsername.trim());
  }

  function refreshForgotResendFromStorage() {
    setForgotResendTimer(readForgotCooldownRemaining(forgotCooldownKey()));
  }

  function applyForgotCooldown(seconds: number, username?: string) {
    const key = forgotCooldownKey(username);
    persistForgotCooldown(key, seconds);
    setForgotResendTimer(readForgotCooldownRemaining(key));
  }

  function invalidateForgotInFlightRequest() {
    forgotRequestGen.current += 1;
    setLoading(false);
  }

  const openForgotPassword = () => {
    setForgotOpen(true);
    setForgotStep(1);
    setForgotUsername(loginUsername.trim());
    setForgotOtp('');
    setForgotResetToken('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotInfo(null);
    setError(null);
    refreshForgotResendFromStorage();
  };

  const closeForgotPassword = () => {
    invalidateForgotInFlightRequest();
    setForgotOpen(false);
    setForgotStep(1);
    setForgotOtp('');
    setForgotResetToken('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotInfo(null);
    setError(null);
  };

  const submitForgotPasswordRequest = async () => {
    const u = forgotUsername.trim();
    if (!u) {
      setError('Enter the phone number you use to log in');
      return;
    }
    if (forgotResendTimer > 0) {
      setError(formatForgotCooldownMessage(forgotResendTimer, 'request'));
      return;
    }
    const gen = ++forgotRequestGen.current;
    setLoading(true);
    setError(null);
    setForgotInfo(null);
    try {
      const res = await apiClient.post<unknown>(
        '/auth/customer/forgot-password/request',
        { username: u },
        FORGOT_PASSWORD_RETRY_CONFIG
      );
      if (gen !== forgotRequestGen.current) return;
      const inner = pickForgotResponseData(res);
      const msg =
        (typeof inner?.message === 'string' && inner.message) ||
        'If an account exists, we sent instructions.';
      const retrySec =
        typeof inner?.retryAfterSeconds === 'number'
          ? Math.ceil(inner.retryAfterSeconds)
          : readRetryAfterSecondsFromSuccess(res);
      applyForgotCooldown(retrySec, u);
      setForgotInfo(msg);
      setForgotStep(2);
    } catch (err: unknown) {
      if (gen !== forgotRequestGen.current) return;
      const e = err as {
        statusCode?: number;
        code?: string;
        message?: string;
        responseData?: { error?: { code?: string } };
      };
      const errCode = e?.code || e?.responseData?.error?.code;
      if (errCode === 'RESET_RECENTLY') {
        const retrySec = readRetryAfterSecondsFromError(err);
        setError(formatResetRecentlyMessage(retrySec));
      } else if (e?.statusCode === 429 || errCode === 'RATE_LIMITED') {
        const retrySec = readRetryAfterSecondsFromError(err);
        applyForgotCooldown(retrySec, u);
        setError(`Too many requests. Wait ${retrySec} seconds before trying again.`);
      } else if (errCode === 'OTP_DELIVERY_FAILED' || e?.statusCode === 503) {
        applyForgotCooldown(60, u);
        setError('Could not send SMS. Try again in a minute.');
      } else {
        setError(e?.message || 'Something went wrong. Try again.');
      }
    } finally {
      if (gen === forgotRequestGen.current) setLoading(false);
    }
  };

  const submitForgotPasswordVerifyOtp = async () => {
    const u = forgotUsername.trim();
    if (!forgotOtp || forgotOtp.length !== 6) {
      setError('Enter the 6-digit code from SMS');
      return;
    }
    const gen = ++forgotRequestGen.current;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<unknown>(
        '/auth/customer/forgot-password/verify-otp',
        {
          username: u,
          otp: forgotOtp,
        },
        FORGOT_PASSWORD_RETRY_CONFIG
      );
      if (gen !== forgotRequestGen.current) return;
      const inner = pickForgotResponseData(res);
      const token = typeof inner?.resetToken === 'string' ? inner.resetToken : '';
      if (!token) {
        setError('Invalid or expired code');
        return;
      }
      setForgotResetToken(token);
      setForgotStep(3);
    } catch (err: unknown) {
      if (gen !== forgotRequestGen.current) return;
      const e = err as {
        statusCode?: number;
        code?: string;
        message?: string;
        responseData?: { error?: { code?: string } };
      };
      const errCode = e?.code || e?.responseData?.error?.code;
      if (errCode === 'RESET_RECENTLY') {
        const retrySec = readRetryAfterSecondsFromError(err);
        setError(formatResetRecentlyMessage(retrySec));
      } else if (e?.statusCode === 429 || errCode === 'RATE_LIMITED') {
        const retrySec = readRetryAfterSecondsFromError(err);
        applyForgotCooldown(retrySec, u);
        setError(`Too many requests. Wait ${retrySec} seconds before trying again.`);
      } else {
        setError(e?.message || 'Invalid or expired code');
      }
    } finally {
      if (gen === forgotRequestGen.current) setLoading(false);
    }
  };

  const submitForgotPasswordReset = async () => {
    if (forgotNewPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiClient.post<unknown>('/auth/customer/forgot-password/reset', {
        resetToken: forgotResetToken,
        newPassword: forgotNewPassword,
        confirmPassword: forgotConfirmPassword,
      });
      setForgotSuccessBanner('Password updated. You can log in with your new password.');
      closeForgotPassword();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || 'Could not reset password. Request a new code.');
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
        let unifiedProfileForAuth: Record<string, unknown> | undefined = undefined;
        try {
          const profileResponse = await apiClient.get<any>(
            `/customer/profile/unified/${encodeURIComponent(shortPhone)}`
          );
          console.log('✅ [Auth] Profile response:', profileResponse);

          if (profileResponse?.profile) {
            const profile = profileResponse.profile;
            unifiedProfileForAuth = profile as Record<string, unknown>;
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

            if (backendFullyOnboarded) {
              localStorage.setItem('profile_completed', 'true');
              localStorage.setItem('onboarding_completed', 'true');
              setCustomerOnboardingCompleteFromAuth('true');
              console.log('✅ [Auth] Backend reports full onboarding complete');
            } else if (hasMeaningfulProfile) {
              localStorage.setItem('profile_completed', 'true');
              setCustomerOnboardingCompleteFromAuth('false');
              console.log('✅ [Auth] Profile saved — show onboarding choice');
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

        const otpPayloadProfile =
          (responseData?.profile as { has_password?: boolean } | undefined) ??
          ((responseData as any)?.data?.profile as { has_password?: boolean } | undefined);
        const hasPassword = Boolean(
          (unifiedProfileForAuth as { has_password?: boolean } | undefined)?.has_password ??
            otpPayloadProfile?.has_password
        );
        const redirectPath =
          redirectAfterLogin && redirectAfterLogin.startsWith('/') ? redirectAfterLogin : '/';

        if (!hasPassword) {
          setNeedsPasswordSetupAfterOtp();
          const profileCompleted =
            localStorage.getItem('profile_completed') === 'true' ||
            localStorage.getItem('onboarding_completed') === 'true';
          const onboardingDone =
            localStorage.getItem('customerOnboardingComplete') === 'true';
          const goProfileFirst = !profileCompleted && !onboardingDone;
          if (goProfileFirst) {
            console.log('🚀 [Auth] Password required — profile first, then set-password');
            router.push('/profile');
          } else {
            const afterPwd =
              localStorage.getItem('onboarding_completed') === 'true' ||
              localStorage.getItem('customerOnboardingComplete') === 'true'
                ? '/'
                : '/onboarding';
            console.log('🚀 [Auth] Password required — set-password then', afterPwd);
            router.push('/auth/set-password?next=' + encodeURIComponent(afterPwd));
          }
        } else {
          clearNeedsPasswordSetup();
          console.log('🚀 [Auth] Navigating to:', redirectPath);
          router.push(redirectPath);
        }
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

  // OTP VERIFICATION SCREEN
  if (otpSent) {
    return (
      <Fragment>
      <div className={authShellClass}>
        {/* Centered Container */}
        <div className={authColumnClass}>
          {/* Orange Header Section */}
          <div className={authHeaderClass} style={authOrangeHeaderStyle}>
            {/* Warmpawz Logo */}
            <div className={authLogoRingClass}>
              <img src="/logo.webp" alt="Warmpawz" className="w-full h-full object-contain" />
            </div>

            {/* Title */}
            <h1 className={authHeroH1Class}>
              Verify Your
            </h1>
            <h2 className={authHeroH2Class}>
              Number
            </h2>
          </div>

          {/* White Card Section */}
          <div className="flex-1 -mt-8 relative overflow-hidden">
            <div className={authCardClass}>
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
              {uatHint && (
                <div className="mb-6 p-4 bg-gradient-to-r from-[#FF8C42]/10 to-[#FF6B9D]/10 rounded-xl text-center">
                  <p className="text-[#FF8C42] text-sm font-medium">
                    🧪 UAT Mode: OTP <strong>{UAT_VALID_OTPS.join(' or ')}</strong> · password login:{' '}
                    <strong>12345678</strong>
                  </p>
                </div>
              )}

              {/* OTP Input Section */}
              <div className="space-y-4">
                <label className="block text-gray-700 font-medium mb-2">Verification Code</label>

                {/* 6-digit OTP Input */}
                <div className={authInputGroupClass}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit code"
                    className={authOtpInnerClass}
                    autoFocus
                  />
                </div>

                {/* Verify Button */}
                <button
                  onClick={verifyOtp}
                  disabled={loading || otp.length !== 6}
                  className={authPrimaryButtonClass}
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
                      className={`text-sm disabled:opacity-50 disabled:no-underline ${authTextLinkClass}`}
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
                      className={`text-sm ${authTextLinkClass}`}
                    >
                      Get Help
                    </button>
                  </p>
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtp(''); setError(null); }}
                    className={`text-sm ${authTextLinkClass}`}
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
                  className={`${authTermsLinkClass} align-baseline`}
                >
                  Customer Terms of Service
                </button>
                {' '}and{' '}
                <button
                  type="button"
                  onClick={() => openLegal('privacy_policy')}
                  className={`${authTermsLinkClass} align-baseline`}
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
    <div className={authShellClass}>
      {/* Centered Container */}
      <div className={authColumnClass}>
        {/* Orange Header Section */}
        <div className={authHeaderClass} style={authOrangeHeaderStyle}>
          {/* Warmpawz Logo */}
          <div className={authLogoRingClass}>
            <img src="/logo.webp" alt="Warmpawz" className="w-full h-full object-contain" />
          </div>

          {/* Welcome Text */}
          <h1 className={authHeroH1Class}>Welcome to</h1>
          <h2 className={authHeroTitleClass}>WARMPAWZ!</h2>
          <p className={authHeroTaglineClass}>
            Pet Care . Reimagined .
          </p>
        </div>

        {/* White Card Section */}
        <div className="flex-1 -mt-8 relative overflow-hidden">
          <div className={authCardClass}>
            {/* Subtitle */}
            <p className="text-center text-gray-600 mb-8 text-base leading-relaxed">
              {authMode === 'login' ? (
                forgotOpen ? (
                  <>
                    {forgotStep === 3
                      ? 'Choose a new password for your account.'
                      : 'Reset your password using a code we send by SMS to your registered mobile number only.'}
                  </>
                ) : (
                  <>
                    Log in with your phone number (your 10-digit mobile number)<br />
                    and the password you created after signup.
                  </>
                )
              ) : (
                <>
                  Join our community of pet lovers and access<br />the best care for your furry friends
                </>
              )}
            </p>

            {/* UAT Mode Message */}
            {UAT_MODE && authMode === 'signup' && (
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
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <span className="text-red-500 text-xl">⚠️</span>
                <p className="text-red-600 text-sm flex-1">{error}</p>
              </div>
            )}

            {forgotSuccessBanner && authMode === 'login' && !forgotOpen && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
                {forgotSuccessBanner}
              </div>
            )}

            {/* Login (phone + password) or Sign up (phone OTP) */}
            <div className="space-y-4">
              {authMode === 'login' ? (
                forgotOpen ? (
                  <>
                    {forgotStep === 1 && (
                      <>
                        <label className="block text-gray-700 font-medium mb-2">Phone Number</label>
                        <input
                          type="text"
                          autoComplete="username"
                          value={forgotUsername}
                          onChange={(e) => setForgotUsername(e.target.value)}
                          placeholder="Same phone number you use to log in"
                          className={authFieldClass}
                        />
                        <button
                          type="button"
                          onClick={submitForgotPasswordRequest}
                          disabled={loading || !forgotUsername.trim() || forgotResendTimer > 0}
                          className={`${authPrimaryButtonClass} mt-2`}
                        >
                          {loading ? 'Sending…' : 'Send code'}
                        </button>
                        {forgotResendTimer > 0 ? (
                          <p className="text-center text-sm text-gray-500">
                            {formatForgotCooldownMessage(forgotResendTimer, 'request')}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={closeForgotPassword}
                          className="w-full text-center text-sm text-gray-600 font-medium hover:underline pt-2"
                        >
                          Back to log in
                        </button>
                      </>
                    )}
                    {forgotStep === 2 && (
                      <>
                        {forgotInfo ? (
                          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 mb-2">
                            {forgotInfo}
                          </div>
                        ) : null}
                        <label className="block text-gray-700 font-medium mb-2">6-digit code from SMS</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={forgotOtp}
                          onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="••••••"
                          className={authFieldClass}
                        />
                        <button
                          type="button"
                          onClick={submitForgotPasswordVerifyOtp}
                          disabled={loading || forgotOtp.length !== 6}
                          className={`${authPrimaryButtonClass} mt-2`}
                        >
                          {loading ? 'Checking…' : 'Continue'}
                        </button>
                        <div className="text-center pt-2">
                          {forgotResendTimer > 0 ? (
                            <p className="text-sm text-gray-500">
                              {formatForgotCooldownMessage(forgotResendTimer, 'resend')}
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={submitForgotPasswordRequest}
                              disabled={loading}
                              className={`text-sm disabled:opacity-50 disabled:no-underline ${authTextLinkClass}`}
                            >
                              Resend code
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={closeForgotPassword}
                          className="w-full text-center text-sm text-gray-600 font-medium hover:underline pt-2"
                        >
                          Entered wrong number?
                        </button>
                      </>
                    )}
                    {forgotStep === 3 && (
                      <>
                        <label className="block text-gray-700 font-medium mb-2">New password</label>
                        <div className="relative">
                          <input
                            type={showForgotNewPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={forgotNewPassword}
                            onChange={(e) => setForgotNewPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            className={authFieldInGroupClass}
                          />
                          <button
                            type="button"
                            onClick={() => setShowForgotNewPassword((v) => !v)}
                            aria-label={showForgotNewPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
                          >
                            {showForgotNewPassword ? (
                              <EyeOff className="h-5 w-5" aria-hidden />
                            ) : (
                              <Eye className="h-5 w-5" aria-hidden />
                            )}
                          </button>
                        </div>
                        <label className="block text-gray-700 font-medium mb-2">Confirm password</label>
                        <input
                          type={showForgotNewPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={forgotConfirmPassword}
                          onChange={(e) => setForgotConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className={authFieldClass}
                        />
                        <button
                          type="button"
                          onClick={submitForgotPasswordReset}
                          disabled={
                            loading ||
                            forgotNewPassword.length < 8 ||
                            forgotNewPassword !== forgotConfirmPassword
                          }
                          className={`${authPrimaryButtonClass} mt-2`}
                        >
                          {loading ? 'Updating…' : 'Update password'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotStep(2);
                            setError(null);
                          }}
                          className="w-full text-center text-sm text-gray-600 font-medium hover:underline pt-2"
                        >
                          Back
                        </button>
                      </>
                    )}
                  </>
                ) : (
                <>
                  <label className="block text-gray-700 font-medium mb-2">Phone Number</label>
                  <input
                    type="text"
                    autoComplete="username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className={authFieldClass}
                  />
                  <label className="block text-gray-700 font-medium mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Your password"
                      className={authFieldInGroupClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((v) => !v)}
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 active:scale-95 transition-colors"
                    >
                      {showLoginPassword ? (
                        <EyeOff className="h-5 w-5" aria-hidden />
                      ) : (
                        <Eye className="h-5 w-5" aria-hidden />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className={`w-full text-right text-sm pt-1 ${authTextLinkClass}`}
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={passwordLogin}
                    disabled={loading || !loginUsername.trim() || !loginPassword.trim()}
                    className={`${authPrimaryButtonClass} mt-2`}
                  >
                    {loading ? 'Signing in…' : 'Log in'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setShowLoginPassword(false);
                      setError(null);
                    }}
                    className={`w-full text-center text-sm pt-2 ${authSignupPillLinkClass}`}
                  >
                    New user? Sign up with phone (OTP)
                  </button>
                </>
                )
              ) : (
                <>
              <label className="block text-gray-700 font-medium mb-2">Phone Number</label>

              {/* Phone Input with Country Code Selector */}
              <div className={authInputGroupClass}>
                <CountryCodeSelector
                  selectedCode={countryCode}
                  onSelect={setCountryCode}
                  disabled={false}
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="74493 38923"
                  className="min-w-0 flex-1 py-4 px-4 text-lg outline-none bg-transparent transition-colors duration-200"
                  autoFocus
                />
              </div>

              {/* Referral Code Section */}
              <div className="mt-4">
                {!showReferralModal ? (
                  <button
                    type="button"
                    onClick={() => setShowReferralModal(true)}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-2xl text-gray-600 hover:border-[#FF8C42] hover:text-[#FF8C42] transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Have a referral code?
                  </button>
                ) : (
                  <div className="overflow-hidden p-4 border-2 border-[#FF8C42]/30 rounded-2xl bg-[#FF8C42]/5">
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
                        className="min-w-0 flex-1 w-full px-4 py-3 border-2 border-gray-200/90 rounded-xl text-sm uppercase bg-[#FFFBF7] transition-all duration-200 focus:border-[#FF8C42] focus:outline-none focus:ring-4 focus:ring-[#FF8C42]/20 focus:bg-white"
                      />
                      {referralCode && !referralApplied && (
                        <button
                          type="button"
                          onClick={() => setReferralApplied(true)}
                          className="shrink-0 px-4 py-2.5 text-sm font-medium rounded-full border border-white/25 text-white bg-gradient-to-b from-[#FF9A4A] to-[#FF7A2E] shadow-md shadow-[#C85A10]/30 transition-all duration-200 hover:shadow-lg hover:brightness-105 active:brightness-95"
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
                className={`${authPrimaryButtonClass} mt-6`}
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
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setError(null);
                }}
                className="w-full text-center text-sm text-gray-600 hover:text-[#FF8C42] pt-2"
              >
                Already have a password? Log in
              </button>
                </>
              )}
            </div>

            {/* Terms Footer */}
            <p className="text-center text-sm text-gray-500 mt-6">
              By continuing, you agree to our{' '}
              <button
                type="button"
                onClick={() => openLegal('customer_terms_of_service')}
                className={`${authTermsLinkClass} align-baseline`}
              >
                Customer Terms of Service
              </button>
              {' '}and{' '}
              <button
                type="button"
                onClick={() => openLegal('privacy_policy')}
                className={`${authTermsLinkClass} align-baseline`}
              >
                Privacy Policy
              </button>
            </p>

            {/* Footer with Version Info */}
            <div className="mt-auto pt-8 text-center space-y-1">
              <button
                type="button"
                onClick={() => setHelpChatOpen(true)}
                className={`text-sm ${authTextLinkClass}`}
              >
                Need Help?
              </button>
              <p className="text-gray-400 text-xs">WARMPAWZ Customer v2.1.0</p>
              <p className="text-gray-400 text-xs">© 2025 WARMPAWZ Inc. All rights reserved</p>
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

export default function AuthPage() {
  // No longer need Suspense since we removed useSearchParams
  // This should allow the page to render immediately without waiting for client-side hydration
  return <AuthPageContent />;
}
