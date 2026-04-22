'use client';

import React, { useState, useEffect, Fragment } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { apiClient, isUatMode } from '@/lib/api-client';
import { persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import { CountryCodeSelector, COUNTRY_CODES } from '@/components/ui/CountryCodeSelector';
import {
  PlatformLegalPolicyDialog,
  type PlatformPolicyType,
} from '@/components/legal/PlatformLegalPolicyDialog';
import {
  getStoredCustomerJwtForSession,
  setNeedsPasswordSetupAfterOtp,
  clearNeedsPasswordSetup,
} from '@/lib/session-utils';
import { Eye, EyeOff } from 'lucide-react';

const AIChatbotWidget = dynamic(
  () => import('@/components/customer/AIChatbotWidget').then((m) => ({ default: m.AIChatbotWidget })),
  { ssr: false }
);

function dialablePhoneForChat(countryCode: string, phoneDigits: string): string | undefined {
  const d = phoneDigits.replace(/\D/g, '');
  if (d.length !== 10) return undefined;
  return `${countryCode.trim()}${d}`;
}

// UAT Mode Configuration - uses runtime config (deploy-time) for static exports
const UAT_OTP = '123456'; // Static OTP for UAT testing

/** Top padding under notch / status bar (requires viewport-fit=cover in root layout). */
const authOrangeHeaderStyle = { paddingTop: 'max(2rem, env(safe-area-inset-top))' } as const;

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
  /** First-time users: OTP (signup). Returning users: username + password. */
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

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
    const storedToken = getStoredCustomerJwtForSession();

    if (storedPhone && storedToken) {
      // Verify token is not expired
      const { isTokenExpired } = require('@/lib/session-utils');
      if (!isTokenExpired(storedToken)) {
        const redirect = (typeof window !== 'undefined' && window.location?.search)
          ? new URLSearchParams(window.location.search).get('redirect') : null;
        router.push(redirect && redirect.startsWith('/') ? redirect : '/');
      } else {
        // Token expired, clear session
        const { clearCustomerSession } = require('@/lib/session-utils');
        clearCustomerSession();
      }
    }
  }, [router]);

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

  // Get selected country details
  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];


  // Otp sending & UAT mode handling
  const sendOtp = async () => {
    if (!phone || phone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    if (UAT_MODE) {
      console.log('🔧 [UAT Mode] OTP bypassed. Use:', UAT_OTP);
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
      await apiClient.post('/auth/otp/send', {
        phone: `${countryCode}${phone}`,
        role: 'customer',
      });
      setOtpSent(true);
      setResendTimer(60);
      if (referralCode?.trim()) {
        localStorage.setItem('pendingReferralCode', referralCode.trim().toUpperCase());
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const passwordLogin = async () => {
    const user = loginUsername.trim();
    const pass = loginPassword.trim();
    if (!user || !pass) {
      setError('Enter username and password');
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
        localStorage.setItem('customerPhone', digits);
        localStorage.setItem('customer_phone', digits);
        localStorage.setItem('phone', digits);
      }

      if (idToken && accessToken) {
        const { storeCognitoTokens, storeUserInfo } = require('@/lib/cognito-auth');
        storeCognitoTokens({
          accessToken,
          idToken,
          refreshToken: refreshToken || '',
          expiresIn,
        });
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
            localStorage.setItem('customerData', JSON.stringify(profileResponse.profile));
            localStorage.setItem('customerProfile', JSON.stringify(profileResponse.profile));
            persistCustomerDatabaseId(profileResponse.profile);
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

  const verifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    const pendingReferral = localStorage.getItem('pendingReferralCode')?.trim().toUpperCase() || '';
    const trimmedReferral = referralCode?.trim()
      ? referralCode.trim().toUpperCase()
      : pendingReferral;

    // UAT without referral: local shortcut (no API verify) — same as before
    if (UAT_MODE && !trimmedReferral) {
      if (otp !== UAT_OTP) {
        setError(`Invalid OTP. For UAT testing, use: ${UAT_OTP}`);
        return;
      }
      setLoading(true);
      setError(null);

      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      localStorage.setItem('customerPhone', cleanPhone);
      localStorage.setItem('customer_phone', cleanPhone);
      localStorage.setItem('phone', cleanPhone);
      localStorage.setItem('customerCountryCode', countryCode);
      localStorage.setItem('authToken', `uat-token-customer-${cleanPhone}-${Date.now()}`);

      sessionStorage.setItem('_warmpawz_has_session', 'true');
      sessionStorage.setItem('_warmpawz_just_logged_in', 'true');
      console.log('✅ [Auth] UAT Mode (no referral) - sessionStorage flags set before navigation');

      let profileResponse: any = undefined;
      try {
        profileResponse = await apiClient.get<any>(
          `/customer/profile/unified/${encodeURIComponent(cleanPhone)}`
        );
        if (profileResponse?.profile) {
          localStorage.setItem('customerData', JSON.stringify(profileResponse.profile));
          localStorage.setItem('customerProfile', JSON.stringify(profileResponse.profile));
          persistCustomerDatabaseId(profileResponse.profile);

          const onboardingStatus = profileResponse.profile.onboarding_status || 'INIT';
          const profileCompleted = profileResponse.profile.profile_completed;
          const nameVal = profileResponse.profile.name || profileResponse.profile.full_name || '';
          const hasRealName =
            !!nameVal &&
            String(nameVal).trim() !== '' &&
            nameVal !== `Customer ${phone.replace(/\D/g, '').slice(-4)}`;
          const hasProfileId = !!profileResponse.profile.id;
          const backendFullyOnboarded =
            onboardingStatus === 'COMPLETED' || profileCompleted === true;
          const hasMeaningfulProfile = (hasProfileId && hasRealName) || false;

          if (backendFullyOnboarded) {
            localStorage.setItem('profile_completed', 'true');
            localStorage.setItem('onboarding_completed', 'true');
            setCustomerOnboardingCompleteFromAuth('true');
          } else if (hasMeaningfulProfile) {
            localStorage.setItem('profile_completed', 'true');
            setCustomerOnboardingCompleteFromAuth('false');
          } else {
            setCustomerOnboardingCompleteFromAuth('false');
          }

          try {
            const petsResponse = await apiClient.get<any>(`/customer/pets/${phone}`);
            if (petsResponse?.pets?.length > 0) {
              localStorage.setItem('customerPets', JSON.stringify(petsResponse.pets));
            }
          } catch { }
        }
      } catch {
        // New customer - will go through onboarding
        setCustomerOnboardingCompleteFromAuth('false');
      }

      setLoading(false);

      const innerProfileUat = profileResponse?.profile as { has_password?: boolean } | undefined;
      const hasPasswordUat = Boolean(innerProfileUat?.has_password);
      const redirectPathUat =
        redirectAfterLogin && redirectAfterLogin.startsWith('/') ? redirectAfterLogin : '/';
      if (!hasPasswordUat) {
        setNeedsPasswordSetupAfterOtp();
        const profileCompleted =
          localStorage.getItem('profile_completed') === 'true' ||
          localStorage.getItem('onboarding_completed') === 'true';
        const onboardingDone =
          localStorage.getItem('customerOnboardingComplete') === 'true';
        const goProfileFirst = !profileCompleted && !onboardingDone;
        if (goProfileFirst) {
          router.push('/profile');
        } else {
          const afterPwd =
            localStorage.getItem('onboarding_completed') === 'true' ||
            localStorage.getItem('customerOnboardingComplete') === 'true'
              ? '/'
              : '/onboarding';
          router.push('/auth/set-password?next=' + encodeURIComponent(afterPwd));
        }
      } else {
        clearNeedsPasswordSetup();
        router.push(redirectPathUat);
      }
      return;
    }

    // Production OR UAT with referral: real OTP verify (vendor-web parity — backend applies referral)
    if (UAT_MODE && trimmedReferral && otp !== UAT_OTP) {
      setError(`Invalid OTP. For UAT testing, use: ${UAT_OTP}`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const fullPhoneForApi = `${countryCode}${phone}`;
      const response = await apiClient.post<any>('/auth/otp/verify', {
        phone: fullPhoneForApi,
        otp,
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
          storeCognitoTokens({
            accessToken: accessToken,
            idToken: idToken,
            refreshToken: refreshToken || '',
            expiresIn: expiresIn,
          });
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

            localStorage.setItem('customerData', JSON.stringify(profile));
            localStorage.setItem('customerProfile', JSON.stringify(profile));
            persistCustomerDatabaseId(profile);

            try {
              const petsResponse = await apiClient.get<any>(`/customer/pets/${phone}`);
              if (petsResponse?.pets && Array.isArray(petsResponse.pets) && petsResponse.pets.length > 0) {
                localStorage.setItem('customerPets', JSON.stringify(petsResponse.pets));
              }
            } catch (petError) {
              console.warn('⚠️ [Auth] Pets fetch:', petError);
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
      <div className="min-h-screen flex justify-center bg-[#FF8C42]">
        {/* Centered Container */}
        <div className="w-full max-w-md min-h-screen flex flex-col bg-[#FF8C42]">
          {/* Orange Header Section */}
          <div className="px-6 pb-20 flex flex-col items-center" style={authOrangeHeaderStyle}>
            {/* Warmpawz Logo */}
            <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-xl mb-6 p-2">
              <img src="/logo.png" alt="Warmpawz" className="w-full h-full object-contain" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-black italic text-center">
              Verify Your
            </h1>
            <h2 className="text-2xl font-bold text-black italic text-center">
              Number
            </h2>
          </div>

          {/* White Card Section */}
          <div className="flex-1 -mt-8 relative">
            <div className="bg-white rounded-t-[2.5rem] min-h-full px-6 pt-10 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
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
                    🧪 UAT Mode: Use OTP <strong>{UAT_OTP}</strong>
                  </p>
                </div>
              )}

              {/* OTP Input Section */}
              <div className="space-y-4">
                <label className="block text-gray-700 font-medium mb-2">Verification Code</label>

                {/* 6-digit OTP Input */}
                <div className="flex items-center border-2 border-gray-200 rounded-2xl overflow-hidden focus-within:border-[#FF8C42] focus-within:ring-4 focus-within:ring-[#FF8C42]/20 transition-all bg-white">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit code"
                    className="flex-1 py-4 px-4 text-lg text-center tracking-widest outline-none"
                    autoFocus
                  />
                </div>

                {/* Verify Button */}
                <button
                  onClick={verifyOtp}
                  disabled={loading || otp.length !== 6}
                  className="w-full py-4 bg-[#FF8C42] text-white text-lg font-semibold rounded-2xl hover:bg-[#FF7A29] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all shadow-lg shadow-[#FF8C42]/30"
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
                      className="text-[#FF8C42] font-medium text-sm underline hover:text-[#FF6B9D] disabled:opacity-50"
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
                      className="text-[#FF8C42] hover:underline font-medium"
                    >
                      Get Help
                    </button>
                  </p>
                  <button
                    onClick={() => { setOtpSent(false); setOtp(''); setError(null); }}
                    className="text-blue-600 text-sm hover:underline"
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
                  className="text-[#FF8C42] hover:text-[#FF6B9D] hover:underline font-medium"
                >
                  Customer Terms of Service
                </button>
                {' '}and{' '}
                <button
                  type="button"
                  onClick={() => openLegal('privacy_policy')}
                  className="text-[#FF8C42] hover:text-[#FF6B9D] hover:underline font-medium"
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
    <div className="min-h-screen flex justify-center bg-[#FF8C42]">
      {/* Centered Container */}
      <div className="w-full max-w-md min-h-screen flex flex-col bg-[#FF8C42]">
        {/* Orange Header Section */}
        <div className="px-6 pb-20 flex flex-col items-center" style={authOrangeHeaderStyle}>
          {/* Warmpawz Logo */}
          <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-xl mb-6 p-2">
            <img src="/logo.png" alt="Warmpawz" className="w-full h-full object-contain" />
          </div>

          {/* Welcome Text */}
          <h1 className="text-2xl font-bold text-black italic text-center">Welcome to</h1>
          <h2 className="text-3xl font-extrabold text-black tracking-wide">WARMPAWZ!</h2>
        </div>

        {/* White Card Section */}
        <div className="flex-1 -mt-8 relative">
          <div className="bg-white rounded-t-[2.5rem] min-h-full px-6 pt-10 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
            {/* Subtitle */}
            <p className="text-center text-gray-600 mb-8 text-base leading-relaxed">
              {authMode === 'login' ? (
                <>
                  Log in with your username (usually your 10-digit mobile number)<br />
                  and the password you created after signup.
                </>
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
                  OTP is <strong className="font-bold">{UAT_OTP}</strong> - No SMS will be sent
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

            {/* Login (username + password) or Sign up (phone OTP) */}
            <div className="space-y-4">
              {authMode === 'login' ? (
                <>
                  <label className="block text-gray-700 font-medium mb-2">Username</label>
                  <input
                    type="text"
                    autoComplete="username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full py-4 px-4 text-lg border-2 border-gray-200 rounded-2xl outline-none focus:border-[#FF8C42] focus:ring-4 focus:ring-[#FF8C42]/20"
                  />
                  <label className="block text-gray-700 font-medium mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Your password"
                      className="w-full py-4 pl-4 pr-14 text-lg border-2 border-gray-200 rounded-2xl outline-none focus:border-[#FF8C42] focus:ring-4 focus:ring-[#FF8C42]/20"
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
                    onClick={passwordLogin}
                    disabled={loading || !loginUsername.trim() || !loginPassword.trim()}
                    className="w-full py-4 bg-[#FF8C42] text-white text-lg font-semibold rounded-2xl hover:bg-[#FF7A29] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#FF8C42]/30 mt-2"
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
                    className="w-full text-center text-sm text-[#FF8C42] font-medium hover:underline pt-2"
                  >
                    New user? Sign up with phone (OTP)
                  </button>
                </>
              ) : (
                <>
              <label className="block text-gray-700 font-medium mb-2">Phone Number</label>

              {/* Phone Input with Country Code Selector */}
              <div className="flex items-stretch border-2 border-gray-200 rounded-2xl overflow-hidden focus-within:border-[#FF8C42] focus-within:ring-4 focus-within:ring-[#FF8C42]/20 transition-all bg-white">
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
                  className="flex-1 py-4 px-4 text-lg outline-none"
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
                  <div className="p-4 border-2 border-[#FF8C42]/30 rounded-2xl bg-[#FF8C42]/5">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-gray-700 font-medium text-sm">Referral Code (Optional)</label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowReferralModal(false);
                          setReferralCode('');
                          setReferralApplied(false);
                        }}
                        className="text-gray-400 hover:text-gray-600 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => {
                          setReferralCode(e.target.value.toUpperCase());
                          setReferralApplied(false);
                        }}
                        placeholder="Enter referral code"
                        maxLength={20}
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm uppercase focus:border-[#FF8C42] focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/20"
                      />
                      {referralCode && !referralApplied && (
                        <button
                          type="button"
                          onClick={() => setReferralApplied(true)}
                          className="px-4 py-3 bg-[#FF8C42] text-white rounded-xl text-sm font-medium hover:bg-[#FF7A29] transition-colors"
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
                className="w-full py-4 bg-[#FF8C42] text-white text-lg font-semibold rounded-2xl hover:bg-[#FF7A29] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all shadow-lg shadow-[#FF8C42]/30 mt-6"
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
                className="text-[#FF8C42] hover:text-[#FF6B9D] hover:underline font-medium transition-colors"
              >
                Customer Terms of Service
              </button>
              {' '}and{' '}
              <button
                type="button"
                onClick={() => openLegal('privacy_policy')}
                className="text-[#FF8C42] hover:text-[#FF6B9D] hover:underline font-medium transition-colors"
              >
                Privacy Policy
              </button>
            </p>

            {/* Footer with Version Info */}
            <div className="mt-auto pt-8 text-center space-y-1">
              <button
                type="button"
                onClick={() => setHelpChatOpen(true)}
                className="text-[#FF8C42] text-sm font-medium hover:text-[#FF6B9D] hover:underline transition-colors"
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
