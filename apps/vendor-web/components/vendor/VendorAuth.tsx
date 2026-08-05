'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import { apiClient, isUatMode } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { storeSession } from '@/lib/session-manager';
import { clearVendorSession } from '@/lib/session-utils';
import {
  scheduleVendorPushRegistrationAfterLogin,
  unwrapVerifyOtpResponseBody,
} from '@/lib/vendor-session-from-api';
import { CountryCodeSelector } from '@/components/ui/CountryCodeSelector';
import { ChatWidget } from '@/components/customer/ChatWidget';
import {
  PlatformLegalPolicyDialog,
  type PlatformPolicyType,
} from '@/components/legal/PlatformLegalPolicyDialog';
import {
  FORGOT_PASSWORD_RETRY_CONFIG,
  formatForgotCooldownMessage,
  formatResetRecentlyMessage,
  forgotCooldownStorageKey,
  persistForgotCooldown,
  readForgotCooldownRemaining,
  readRetryAfterSecondsFromError,
  readRetryAfterSecondsFromSuccess,
} from '@/lib/forgot-password-cooldown';

const logoImage = '/logo.png';

const UAT_FORGOT_OTP_HINT = '123456';

function pickForgotResponseData(res: unknown): Record<string, unknown> | null {
  const r = res as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return null;
  const outer = r.data as Record<string, unknown> | undefined;
  if (outer && typeof outer === 'object' && outer.data && typeof outer.data === 'object') {
    return outer.data as Record<string, unknown>;
  }
  return null;
}

interface VendorAuthProps {
  onAuthSuccess: (session: any) => void;
  /** When true, auth blocks fill the scroll area inside VendorPublicAppShell (no min-h-screen). */
  usePublicAppShell?: boolean;
}

export function VendorAuth({ onAuthSuccess, usePublicAppShell = false }: VendorAuthProps) {
  /** Default sign-in first (same as customer-web /auth login default). */
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91'); // Default to India
  const [otpCode, setOtpCode] = useState('');
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [rateLimitCooldown, setRateLimitCooldown] = useState<number | null>(null);
  const [lastOtpRequestTime, setLastOtpRequestTime] = useState<number>(0);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [referralCode, setReferralCode] = useState('');
  const [showReferralInput, setShowReferralInput] = useState(false);
  const [referralApplied, setReferralApplied] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);
  const [legalDialogOpen, setLegalDialogOpen] = useState(false);
  const [legalDialogType, setLegalDialogType] = useState<PlatformPolicyType | null>(null);
  const [showChatBot, setShowChatBot] = useState(false);
  /** Phone + password sign-in (backend: username = dialable phone). */
  const [loginPhoneDigits, setLoginPhoneDigits] = useState('');
  const [loginCountryCode, setLoginCountryCode] = useState('+91');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  /** Forgot password: dedicated vendor routes (same envelope parsing as customer-web). */
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
  const [uatRuntimeForgotHint, setUatRuntimeForgotHint] = useState(false);
  const [forgotResendTimer, setForgotResendTimer] = useState(0);
  const forgotRequestGen = useRef(0);

  useEffect(() => {
    setUatRuntimeForgotHint(isUatMode());
  }, []);

  useEffect(() => {
    if (forgotResendTimer > 0) {
      const timer = setTimeout(() => setForgotResendTimer(forgotResendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [forgotResendTimer]);

  useEffect(() => {
    if (!forgotOpen) return;
    setForgotResendTimer(readForgotCooldownRemaining(forgotCooldownKey()));
  }, [forgotOpen, forgotUsername]);

  // Referral deep link: open registration with code applied (parity with customer-web /auth ?ref=).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref') || params.get('referral') || params.get('referralCode');
    if (!refCode?.trim()) return;
    const c = refCode.trim().toUpperCase();
    setReferralCode(c);
    setReferralApplied(true);
    setShowReferralInput(true);
    localStorage.setItem('pendingReferralCode', c);
    setIsSignUp(true);
  }, []);

  const openLegal = (t: PlatformPolicyType) => {
    setLegalDialogType(t);
    setLegalDialogOpen(true);
  };

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

  const fillShell = usePublicAppShell
    ? 'min-h-0 w-full flex-1 flex flex-col'
    : 'min-h-screen';
  const centerShell = usePublicAppShell
    ? 'min-h-0 w-full flex-1 flex flex-col items-center justify-center p-4'
    : 'min-h-screen flex items-center justify-center p-4';

  const chatBotWidget = showChatBot ? (
    <ChatWidget
      userType="vendor"
      defaultOpen
      onClose={() => setShowChatBot(false)}
    />
  ) : null;
  
  // Update cooldown countdown timer
  useEffect(() => {
    if (!rateLimitCooldown || rateLimitCooldown <= Date.now()) {
      setCooldownSeconds(0);
      return;
    }
    
    const interval = setInterval(() => {
      const remaining = Math.ceil((rateLimitCooldown - Date.now()) / 1000);
      if (remaining > 0) {
        setCooldownSeconds(remaining);
      } else {
        setCooldownSeconds(0);
        setRateLimitCooldown(null);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [rateLimitCooldown]);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    businessName: '',
    ownerName: '',
    phone: '',
    services: [] as string[],
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    pan: '',
    aadhar: '',
    bankAccount: '',
    ifsc: '',
    agreedToTerms: false
  });

  const serviceOptions = [
    'Pet Walking',
    'Grooming at Home',
    'Grooming Centre',
    'Vet Services at Home',
    'Vet Clinic',
    'Tele Consultation',
    'Pet Training',
    'Pet Food Delivery',
    'Medicine Delivery',
    'Pet Cafe',
    'Pet Insurance',
    'Peer to Peer'
  ];

  // Format phone number with spaces
  const formatPhoneDisplay = (num: string) => {
    if (num.length <= 5) return num;
    return `${num.slice(0, 5)} ${num.slice(5)}`;
  };

  function forgotCooldownKey(username?: string) {
    return forgotCooldownStorageKey((username ?? forgotUsername).trim());
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
    const d = loginPhoneDigits.replace(/\D/g, '').slice(-10);
    setForgotUsername(d.length === 10 ? `${loginCountryCode.trim()}${d}` : '');
    setForgotOtp('');
    setForgotResetToken('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotInfo(null);
    setError('');
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
    setError('');
  };

  const submitForgotPasswordRequest = async () => {
    const u = forgotUsername.trim();
    if (!u) {
      setError('Enter the phone number or email you use to log in');
      return;
    }
    if (forgotResendTimer > 0) {
      setError(formatForgotCooldownMessage(forgotResendTimer, 'request'));
      return;
    }
    const gen = ++forgotRequestGen.current;
    setLoading(true);
    setError('');
    setForgotInfo(null);
    try {
      const res = await apiClient.post<unknown>(
        '/auth/vendor/forgot-password/request',
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
        isRateLimit?: boolean;
        responseData?: { error?: { code?: string } };
      };
      const errCode = e?.code || e?.responseData?.error?.code;
      if (errCode === 'RESET_RECENTLY') {
        const retrySec = readRetryAfterSecondsFromError(err);
        setError(formatResetRecentlyMessage(retrySec));
      } else if (e?.statusCode === 429 || errCode === 'RATE_LIMITED' || e?.isRateLimit) {
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
    setError('');
    try {
      const res = await apiClient.post<unknown>(
        '/auth/vendor/forgot-password/verify-otp',
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
        isRateLimit?: boolean;
        responseData?: { error?: { code?: string } };
      };
      const errCode = e?.code || e?.responseData?.error?.code;
      if (errCode === 'RESET_RECENTLY') {
        const retrySec = readRetryAfterSecondsFromError(err);
        setError(formatResetRecentlyMessage(retrySec));
      } else if (e?.statusCode === 429 || errCode === 'RATE_LIMITED' || e?.isRateLimit) {
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
    setError('');
    try {
      await apiClient.post<unknown>('/auth/vendor/forgot-password/reset', {
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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const digits = loginPhoneDigits.replace(/\D/g, '');
      if (digits.length < 10) {
        setError('Please enter a valid 10-digit mobile number');
        setLoading(false);
        return;
      }

      const password = formData.password.trim();
      if (!password) {
        setError('Please enter your password');
        setLoading(false);
        return;
      }

      const usernamePhone = `${loginCountryCode}${digits.slice(-10)}`;

      // Drop stale tokens so profile calls after login use the fresh session.
      clearVendorSession();

      const loginRaw = await apiClient.post<any>('/auth/vendor/login', {
        username: usernamePhone,
        password,
        role: 'vendor',
      });

      const unwrapped = unwrapVerifyOtpResponseBody(loginRaw);
      if (!unwrapped) {
        throw new Error('Authentication failed: No access token received');
      }

      const { accessToken, user, profile, vendorId, onboardingStatus, phone: dialablePhone } =
        unwrapped;

      const tokens = ((loginRaw as any)?.data?.data?.token ||
        (loginRaw as any)?.data?.token ||
        (loginRaw as any)?.token ||
        {}) as Record<string, string>;
      const idToken = tokens.id_token || tokens.idToken || accessToken;
      const refreshToken = tokens.refresh_token || tokens.refreshToken || '';
      const expiresInRaw = tokens.expires_in ?? tokens.expiresIn;
      const expiresIn =
        typeof expiresInRaw === 'number' && Number.isFinite(expiresInRaw) ? expiresInRaw : 86400;

      try {
        const { persistVendorCognitoTokens } = require('@/lib/vendor-session-from-api');
        persistVendorCognitoTokens({
          accessToken,
          idToken,
          refreshToken,
          expiresIn,
          userId: vendorId,
          phone: dialablePhone,
        });
      } catch (storeErr) {
        console.warn('[VendorAuth] persistVendorCognitoTokens skipped:', storeErr);
      }

      storeSession({
        phone: dialablePhone,
        accessToken: idToken || accessToken,
        user,
        profile,
        vendorId,
      });

      localStorage.setItem('vendorAuthToken', idToken || accessToken);
      localStorage.setItem('vendorApplicationStatus', onboardingStatus);
      localStorage.setItem('vendorCountryCode', loginCountryCode);

      sessionStorage.setItem('_warmpawz_vendor_has_session', 'true');
      sessionStorage.setItem('_warmpawz_vendor_just_logged_in', 'true');
      sessionStorage.setItem('_warmpawz_vendor_login_at', String(Date.now()));

      if (vendorId) {
        scheduleVendorPushRegistrationAfterLogin(vendorId);
      }

      try {
        const vendorData = (await apiClient.get('/vendor/profile')) as any;
        if (vendorData?.vendor?.status === 'pending') {
          setPendingApproval(true);
          setLoading(false);
          return;
        }
        if (vendorData?.vendor?.status === 'rejected') {
          setError('Your vendor account has been rejected. Please contact support.');
          setLoading(false);
          return;
        }
      } catch (profileErr) {
        console.warn('[VendorAuth] Optional profile fetch after password login failed:', profileErr);
      }

      onAuthSuccess({
        phone: dialablePhone,
        accessToken: idToken || accessToken,
        idToken,
        refreshToken,
        expiresIn,
        user,
        profile,
        vendorId,
        onboardingStatus,
        state: ((loginRaw as any)?.data?.data?.state ||
          (loginRaw as any)?.data?.state ||
          'existing') as string,
      });
    } catch (err: any) {
      const errCode = err?.originalError?.error?.code;
      const hint =
        errCode === 'PASSWORD_NOT_SET'
          ? ' No password on file yet. Use “New vendor? Register here” and sign in with OTP once, complete onboarding, then set your password when prompted.'
          : errCode === 'PASSWORD_ON_INACTIVE_VENDOR'
            ? ''
            : '';
      setError((err.message || 'Failed to sign in') + hint);
      console.error('Sign in error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }
    
    // Debounce: Prevent rapid clicks (minimum 2 seconds between requests)
    const now = Date.now();
    const timeSinceLastRequest = now - lastOtpRequestTime;
    const minInterval = 2000; // 2 seconds
    
    if (timeSinceLastRequest < minInterval && lastOtpRequestTime > 0) {
      const remainingTime = Math.ceil((minInterval - timeSinceLastRequest) / 1000);
      setError(`Please wait ${remainingTime} second${remainingTime > 1 ? 's' : ''} before requesting another OTP.`);
      return;
    }
    
    // Check if we're in a rate limit cooldown period
    if (rateLimitCooldown && rateLimitCooldown > Date.now()) {
      const remainingSeconds = Math.ceil((rateLimitCooldown - Date.now()) / 1000);
      setError(`Too many requests. Please wait ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''} before trying again.`);
      return;
    }
    
    setLoading(true);
    setLastOtpRequestTime(now);
    
    try {
      console.log('📤 [VendorAuth] Sending OTP to:', `${countryCode}${phoneNumber}`);
      
      // Send OTP using the correct endpoint
      const sendOtpData = await apiClient.post<any>('/auth/send-otp', {
        phone: `${countryCode}${phoneNumber}`,
        role: 'vendor'
      });
      
      console.log('✅ [VendorAuth] OTP sent successfully:', sendOtpData);
      
      // Clear any rate limit cooldown on success
      setRateLimitCooldown(null);
      
      // Store referral code for use after signup (optional)
      if (referralCode && referralCode.trim()) {
        localStorage.setItem('pendingReferralCode', referralCode.trim());
      }
      // Show OTP screen
      setFormData({ ...formData, phone: phoneNumber });
      setShowOtpScreen(true);
      setLoading(false);
    } catch (error: any) {
      console.error('❌ [VendorAuth] Failed to send OTP:', error);
      
      // Handle rate limiting specifically
      if (error.statusCode === 429 || error.isRateLimit) {
        const retryAfter = error.retryAfter || 5; // Default to 5 seconds if not provided
        const cooldownUntil = Date.now() + (retryAfter * 1000);
        setRateLimitCooldown(cooldownUntil);
        
        setError(`Too many requests. Please wait ${retryAfter} second${retryAfter > 1 ? 's' : ''} before trying again.`);
        
        // Clear cooldown after the period expires
        setTimeout(() => {
          setRateLimitCooldown(null);
        }, retryAfter * 1000);
      } else {
        setError(error.message || 'Failed to send OTP. Please try again.');
      }
      
      setLoading(false);
    }
  };

  // Handler to preserve cursor position when filtering OTP input
  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const cursorPosition = input.selectionStart || 0;
    const oldValue = otpCode;
    const newValue = input.value.replace(/[^0-9]/g, '');
    
    // Calculate new cursor position
    // Count how many non-numeric characters were removed before the cursor
    let removedBeforeCursor = 0;
    for (let i = 0; i < Math.min(cursorPosition, input.value.length); i++) {
      if (!/[0-9]/.test(input.value[i])) {
        removedBeforeCursor++;
      }
    }
    
    const newCursorPosition = Math.max(0, cursorPosition - removedBeforeCursor);
    
    // Update state
    setOtpCode(newValue);
    
    // Restore cursor position after React updates
    setTimeout(() => {
      if (otpInputRef.current) {
        const finalPosition = Math.min(newCursorPosition, newValue.length);
        otpInputRef.current.setSelectionRange(finalPosition, finalPosition);
      }
    }, 0);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    console.log('🔐 [VendorAuth] Verifying OTP:', otpCode);
    console.log('🔐 [VendorAuth] Phone number:', `${countryCode}${phoneNumber}`);
    
    try {
      // Verify OTP using the correct endpoint
      console.log('🔐 [VendorAuth] Step 1: Verifying OTP...');
      const verifyPayload: Record<string, string> = {
        phone: `${countryCode}${phoneNumber}`,
        otp: otpCode,
        role: 'vendor'
      };
      if (referralCode && referralCode.trim()) {
        verifyPayload.referralCode = referralCode.trim();
        localStorage.setItem('pendingReferralCode', referralCode.trim());
      }
      
      // ✅ FIX: Add retry logic for timeout/503 errors (max 2 retries)
      let verifyData: any;
      let lastError: any;
      const maxRetries = 2;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`🔄 [VendorAuth] Retry attempt ${attempt} of ${maxRetries}...`);
            // Wait before retry (exponential backoff: 1s, 2s)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
          
          verifyData = await apiClient.post<any>('/auth/verify-otp', verifyPayload);
          // Success - break out of retry loop
          break;
        } catch (err: any) {
          lastError = err;
          const isTimeoutError = err.statusCode === 503 || 
                                err.message?.includes('timeout') || 
                                err.message?.includes('took too long') ||
                                err.message?.includes('temporarily unavailable');
          
          // If it's a timeout error and we have retries left, continue
          if (isTimeoutError && attempt < maxRetries) {
            console.warn(`⚠️ [VendorAuth] Timeout error on attempt ${attempt + 1}, will retry...`);
            continue;
          }
          
          // If it's not a timeout error, or we're out of retries, throw
          throw err;
        }
      }
      
      console.log('📋 [VendorAuth] OTP verification result:', verifyData);
      
      // Handle nested response structure from API Gateway
      // Response can be: { data: { data: { token: {...}, user: {...} } } }
      // or direct: { token: {...}, user: {...} }
      let responseData = verifyData;
      
      // Unwrap nested data structure
      if (verifyData.data) {
        // Check if it's the nested structure: { data: { data: {...} } }
        if (verifyData.data.data) {
          responseData = verifyData.data.data;
        } else {
          // Single level: { data: {...} }
          responseData = verifyData.data;
        }
      }
      
      // Extract token and user from the unwrapped response
      const tokens = responseData.token || responseData.tokens || {};
      const user = responseData.user || {};
      const profile = responseData.profile || {}; // ✅ FIX: Get profile directly from verify-otp response
      
      // Get access token from various possible locations
      const accessToken = tokens.access_token || 
                         tokens.accessToken || 
                         responseData.token?.access_token ||
                         responseData.access_token;
      const idToken = tokens.id_token || tokens.idToken || accessToken;
      const refreshToken = tokens.refresh_token || tokens.refreshToken || '';
      const expiresInRaw = tokens.expires_in ?? tokens.expiresIn;
      const expiresIn =
        typeof expiresInRaw === 'number' && Number.isFinite(expiresInRaw) ? expiresInRaw : 86400;
      
      // ✅ FIX: Get onboarding_status directly from verify-otp response (it's already there!)
      const onboardingStatus = profile.onboarding_status || responseData.onboarding_status || 'INIT';
      
      console.log('🔍 [VendorAuth] Extracted data:', { 
        hasToken: !!accessToken, 
        tokenPreview: accessToken ? accessToken.substring(0, 30) + '...' : 'none',
        user: user,
        profile: profile,
        onboardingStatus: onboardingStatus
      });
      
      if (!accessToken) {
        console.error('❌ [VendorAuth] Token extraction failed. Response structure:', JSON.stringify(verifyData, null, 2));
        throw new Error('Authentication failed: No access token received');
      }
      
      console.log('✅ [VendorAuth] OTP verified successfully! Onboarding status:', onboardingStatus);
      
      // ✅ FIX: Store onboarding status IMMEDIATELY from verify-otp response
      localStorage.setItem('vendorApplicationStatus', onboardingStatus);
      localStorage.setItem('vendorCountryCode', countryCode);
      
      // Store session with access token IMMEDIATELY before any async calls
      // This ensures localStorage is set before redirect
      storeSession({
        phone: phoneNumber,
        accessToken: idToken || accessToken,
        user: user,
        profile: profile,
        vendorId: user.id || profile.id
      });

      try {
        const { persistVendorCognitoTokens } = require('@/lib/vendor-session-from-api');
        persistVendorCognitoTokens({
          accessToken,
          idToken: idToken || accessToken,
          refreshToken,
          expiresIn,
          userId: String(user.id || profile.id || ''),
          phone: phoneNumber,
        });
      } catch (storeErr) {
        console.warn('[VendorAuth] persistVendorCognitoTokens skipped:', storeErr);
      }
      
      // Store profile data if available
      if (profile && Object.keys(profile).length > 0) {
        localStorage.setItem('vendorData', JSON.stringify(profile));
        if (profile.id) {
          localStorage.setItem('vendorId', profile.id);
        }
        const businessName = (profile as any).business_name || (profile as any).businessName || '';
        if (businessName) {
          localStorage.setItem('vendorName', businessName);
          localStorage.setItem('businessName', businessName);
        }
        // ✅ FIX: Store roleId immediately to prevent race condition with useVendorCapabilities
        if (profile.roleId || profile.role_id) {
          const roleId = profile.roleId || profile.role_id;
          localStorage.setItem('vendorRole', roleId);
          console.log('🔐 [VendorAuth] Stored vendorRole:', roleId);
        }
      }
      
      // Double-check storage immediately
      const storedPhoneCheck = localStorage.getItem('vendorPhone');
      const storedTokenCheck = localStorage.getItem('authToken');
      const storedStatusCheck = localStorage.getItem('vendorApplicationStatus');
      console.log('🔐 [VendorAuth] Session stored:', {
        phone: !!storedPhoneCheck,
        token: !!storedTokenCheck,
        status: storedStatusCheck,
        phoneValue: storedPhoneCheck,
        tokenPreview: storedTokenCheck ? storedTokenCheck.substring(0, 30) + '...' : 'none'
      });
      
      if (!storedPhoneCheck || !storedTokenCheck) {
        console.error('❌ [VendorAuth] Session storage failed! Storing directly...');
        // Fallback: Store directly
        localStorage.setItem('vendorPhone', phoneNumber);
        localStorage.setItem('authToken', accessToken);
        if (user.id || profile.id) {
          localStorage.setItem('vendorId', user.id || profile.id);
        }
        localStorage.setItem('vendorUser', JSON.stringify(user));
      }
      
      // Set sessionStorage flags to track that user is logged in
      // These flags are cleared on hard refresh, allowing us to detect it
      sessionStorage.setItem('_warmpawz_vendor_has_session', 'true');
      sessionStorage.setItem('_warmpawz_vendor_just_logged_in', 'true'); // ✅ FIX: Added for better detection
      sessionStorage.setItem('_warmpawz_vendor_login_at', String(Date.now()));
      console.log('✅ [Vendor Session] sessionStorage flags set after login');

      const resolvedVendorId = String(user.id || profile.id || '').trim();
      if (resolvedVendorId) {
        scheduleVendorPushRegistrationAfterLogin(resolvedVendorId);
      }
      
      // ✅ FIX: Use onboarding_status from verify-otp response directly (no separate API call needed)
      // The verify-otp endpoint already returns the correct onboarding_status
      console.log('✅ [VendorAuth] Using onboarding status from verify-otp response:', onboardingStatus);
      
      // Call onAuthSuccess immediately with the status from verify-otp response
      onAuthSuccess({
        phone: phoneNumber,
        accessToken: idToken || accessToken,
        idToken,
        refreshToken,
        expiresIn,
        user: user,
        profile: profile,
        vendorId: user.id || profile.id,
        onboardingStatus: onboardingStatus, // ✅ FIX: Use status from verify-otp response
        state: responseData.state || 'existing'
      });
    } catch (error: any) {
      console.error('❌ [VendorAuth] Login error:', error);
      
      // ✅ FIX: Provide better error messages for timeout/503 errors
      let errorMessage = error.message || 'Network error. Please try again.';
      
      if (error.statusCode === 503 || error.message?.includes('timeout') || error.message?.includes('took too long')) {
        errorMessage = 'The request took too long. Please check your connection and try again.';
      } else if (error.message?.includes('temporarily unavailable')) {
        errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };
  
  // DEBUG: Test button to check database
  const handleDebugCheck = async () => {
    console.log('🔍 DEBUG: Checking ALL vendor data...');
    try {
      const data = await apiClient.get('/admin/vendors/all') as any;
      
      console.log('📊 ========== RAW RESPONSE ==========');
      console.log('Full data:', JSON.stringify(data, null, 2));
      console.log('========================================');
      
      if (data.error) {
        console.error('Error from server:', data.error);
        console.log('✅ Success! Data received');
        const { users, vendorProfiles, vendorVendors, applications } = data.data || {};
        
        console.log('📊 ========== ALL VENDOR DATA ==========');
        console.log('USERS:', users);
        console.log('VENDOR PROFILES:', vendorProfiles);
        console.log('VENDOR VENDORS:', vendorVendors);
        console.log('APPLICATIONS:', applications);
        console.log('========================================');
        
        alert(`Found:\n${users?.length || 0} users\n${vendorProfiles?.length || 0} vendor:profile entries\n${vendorVendors?.length || 0} vendor:vendor_ entries\n${applications?.length || 0} applications\n\nCheck console for details!`);
      }
    } catch (error: any) {
      console.error('❌ Debug error:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : undefined);
      alert(`Network Error: ${error instanceof Error ? error.message : String(error)}\n\nCheck console for full details.`);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.agreedToTerms) {
      setError('Please agree to the terms and conditions');
      return;
    }

    setLoading(true);
    setError('');
  };

  const toggleService = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  if (pendingApproval) {
    return (
      <Fragment>
      <div className={`${centerShell} bg-gradient-to-br from-orange-50 to-white`}>
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">⏳</span>
          </div>
          <h2 className="text-2xl mb-4">Application Under Review</h2>
          <p className="text-gray-600 mb-6">
            Thank you for registering with Warmpawz! Your vendor application is being reviewed by our admin team. 
            We'll notify you once your account is approved.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            This usually takes 24-48 hours. You'll receive an email once approved.
          </p>
          <Button
            onClick={() => {
              setPendingApproval(false);
              setIsSignUp(false);
            }}
            className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
          >
            Back to Login
          </Button>
        </div>
      </div>
      {legalDialog}
      {chatBotWidget}
      </Fragment>
    );
  }

  // OTP VERIFICATION SCREEN - PIXEL PERFECT
  if (showOtpScreen) {
    const formattedPhone = phoneNumber.length === 10 
      ? `${countryCode} ${phoneNumber.slice(0, 5)} ${phoneNumber.slice(5)}`
      : `${countryCode} ${phoneNumber}`;

    return (
      <Fragment>
      <div
        className={`${fillShell} bg-[#FF8C42] flex flex-col ${usePublicAppShell ? 'mx-auto max-w-[430px]' : 'vendor-auth-column'}`}
      >

        {/* Orange Header Section */}
        <div className="px-6 pt-8 pb-20 flex flex-col items-center">
          {/* Logo */}
          <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-xl mb-6 p-2">
            <img src={logoImage} alt="Warmpawz" className="w-full h-full object-contain" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-black italic text-center">
            Verify Your
          </h1>
          <h2 className="text-2xl font-bold text-black italic text-center">
            Number
          </h2>
        </div>

        {/* White Content Card */}
        <div className="flex-1 -mt-8 bg-white rounded-t-[32px] px-6 pt-10 pb-12">
          <div className="text-center mb-8">
            <p className="text-gray-600 text-sm mb-1">
              Enter the OTP sent to
            </p>
            <p className="text-gray-900 font-semibold text-base">
              {formattedPhone}
            </p>
          </div>

          {error && (
            <div className="mb-6 w-full p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="w-full space-y-6">
            <div>
              <Label htmlFor="otp" className="text-gray-700 mb-2 block text-sm font-medium">
                Verification Code
              </Label>
              <div className="flex items-center border-2 border-gray-200 rounded-2xl overflow-hidden focus-within:border-[#FF8C42] focus-within:ring-4 focus-within:ring-[#FF8C42]/20 transition-all bg-white">
                <input
                  ref={otpInputRef}
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={handleOtpChange}
                  className="flex-1 py-4 px-4 text-lg text-center tracking-widest outline-none"
                  placeholder="Enter 6-digit code"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full py-4 bg-[#FF8C42] text-white text-lg font-semibold rounded-2xl hover:bg-[#FF7A29] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#FF8C42]/30"
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </form>

          <div className="mt-8 space-y-4 text-center">
            <button
              type="button"
              onClick={handleSendCode}
              disabled={loading || cooldownSeconds > 0}
              className="w-full text-[#FF8C42] hover:text-[#FF7A29] text-sm underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cooldownSeconds > 0
                ? `Resend Code (Wait ${cooldownSeconds}s)`
                : 'Resend Code'}
            </button>

            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Trouble with verification?{' '}
                <button type="button" onClick={() => setShowChatBot(true)} className="text-[#FF8C42] underline">Get Help</button>
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowOtpScreen(false);
                  setOtpCode('');
                  setError('');
                }}
                className="text-sm text-blue-600 underline"
              >
                &lt; Change phone number
              </button>
            </div>

            <div className="pt-8 space-y-1 text-xs text-gray-400">
              <p>WARMPAWS Provider v2.1.0</p>
              <p>© 2025 WARMPAWS Inc. All rights reserved</p>
            </div>
          </div>
        </div>
      </div>
      {legalDialog}
      {chatBotWidget}
      </Fragment>
    );
  }

  // PHONE NUMBER ENTRY SCREEN
  if (isSignUp && currentStep === 1 && !showOtpScreen) {
    return (
      <Fragment>
      <div
        className={`${fillShell} bg-[#FF8C42] flex flex-col safe-area-top ${usePublicAppShell ? 'mx-auto max-w-[430px]' : 'vendor-auth-column'}`}
      >
        {/* Orange Header Section */}
        <div className="px-6 pt-8 pb-20 flex flex-col items-center">
          {/* Logo */}
          <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-xl mb-6 p-2">
            <img src={logoImage} alt="Warmpawz" className="w-full h-full object-contain" />
          </div>

          {/* Welcome Message */}
          <h1 className="text-2xl font-bold text-black italic text-center">
            Welcome to
          </h1>
          <h2 className="text-3xl font-extrabold text-black tracking-wide">
            WARMPAWZ!
          </h2>
        </div>

        {/* White Content Card */}
        <div className="flex-1 -mt-8 bg-white rounded-t-[32px] px-6 pt-10 pb-12">
          <p className="text-gray-600 text-center mb-8 text-base leading-relaxed">
            Join our community of professional<br />pet care providers
          </p>

          {error && (
            <div className="mb-6 w-full p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSendCode} className="w-full space-y-6">
            <div>
              <Label htmlFor="phone" className="text-gray-700 mb-2 block text-sm font-medium">
                Phone Number
              </Label>
              <div className="flex items-stretch border-2 border-gray-200 rounded-2xl focus-within:border-[#FF8C42] focus-within:ring-4 focus-within:ring-[#FF8C42]/20 transition-all bg-white">
                <CountryCodeSelector
                  selectedCode={countryCode}
                  onSelect={setCountryCode}
                  disabled={false}
                  className="rounded-l-2xl"
                />
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  className="flex-1 py-4 px-4 text-lg outline-none rounded-r-2xl"
                  placeholder="74493 38923"
                  required
                  autoFocus
                />
              </div>
              <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                We currently onboard and support vendors in <span className="font-medium text-gray-600">India only</span> (+91).
              </p>
            </div>

            {/* Referral Code (optional) */}
            <div>
              {!showReferralInput ? (
                <button
                  type="button"
                  onClick={() => setShowReferralInput(true)}
                  className="text-sm text-[#FF8C42] hover:underline"
                >
                  Have a referral code?
                </button>
              ) : (
                <div className="space-y-2 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <Label className="text-gray-700 text-sm font-medium">Referral Code (Optional)</Label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => {
                        setReferralCode(e.target.value.toUpperCase());
                        setReferralApplied(false);
                      }}
                      placeholder="Enter referral code"
                      className="flex-1 py-2.5 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowReferralInput(false)}
                      className="text-gray-500 hover:text-gray-700 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                  {referralCode && !referralApplied && (
                    <button
                      type="button"
                      onClick={() => setReferralApplied(true)}
                      className="text-xs text-[#FF8C42] font-medium"
                    >
                      Apply
                    </button>
                  )}
                  {referralApplied && referralCode && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Referral code will be applied after signup.
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || phoneNumber.length !== 10 || cooldownSeconds > 0}
              className="w-full py-4 bg-[#FF8C42] text-white text-lg font-semibold rounded-2xl hover:bg-[#FF7A29] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#FF8C42]/30"
            >
              {loading 
                ? 'Sending...' 
                : cooldownSeconds > 0
                ? `Please wait ${cooldownSeconds}s`
                : 'Send Verification Code'}
            </button>
          </form>

          <div className="mt-8 space-y-4 text-center">
            <p className="text-sm text-gray-600">
              By continuing, you agree to our{' '}
              <button
                type="button"
                onClick={() => openLegal('vendor_terms_of_service')}
                className="text-[#FF8C42] underline"
              >
                Vendor Terms of Service
              </button>
              {' '}and{' '}
              <button
                type="button"
                onClick={() => openLegal('privacy_policy')}
                className="text-[#FF8C42] underline"
              >
                Privacy Policy
              </button>
            </p>
            
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <span>Already have an account?</span>
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="text-[#FF8C42] underline font-medium"
              >
                Sign In
              </button>
            </div>

            <div className="pt-6 space-y-1 text-xs text-gray-400 text-center">
              <button
                type="button"
                onClick={() => setShowChatBot(true)}
                className="text-[#FF8C42] underline block w-full text-center"
              >
                Need Help?
              </button>
              <p>WARMPAWS Provider v2.1.0</p>
              <p>&copy; 2025 WARMPAWZ Inc. All rights reserved</p>
            </div>
          </div>
        </div>
      </div>
      {legalDialog}
      {chatBotWidget}
      </Fragment>
    );
  }

  if (!isSignUp) {
    // Sign In Screen
    return (
      <Fragment>
      <div className={`${centerShell} bg-gradient-to-br from-orange-50 to-white`}>
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center mb-4">
                <img 
                  src={logoImage} 
                  alt="Warmpawz Logo" 
                  className="w-24 h-24 object-contain"
                />
              </div>
              <h1 className="text-3xl text-[#FF8C42] mb-2">Warmpawz</h1>
              <p className="text-gray-600">Vendor Portal</p>
            </div>

            {forgotSuccessBanner && !forgotOpen && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
                {forgotSuccessBanner}
              </div>
            )}

            {forgotOpen && (
              <p className="text-center text-sm text-gray-600 mb-6 leading-relaxed">
                {forgotStep === 3
                  ? 'Choose a new password for your account.'
                  : 'Reset your password using a code we send by SMS to your registered mobile number only.'}
              </p>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {forgotOpen ? (
              <div className="space-y-4">
                {forgotStep === 1 && (
                  <>
                    <label className="block text-gray-700 font-medium text-sm">Phone or email</label>
                    <input
                      type="text"
                      autoComplete="username"
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      placeholder="e.g. +91939893220 or you@example.com"
                      className="w-full py-3 px-4 text-base border-2 border-gray-200 rounded-2xl outline-none focus:border-[#FF8C42] focus:ring-4 focus:ring-[#FF8C42]/20"
                    />
                    <p className="text-xs text-gray-500 -mt-2">
                      Use your dialable mobile (country code + 10 digits, same as sign in) or the email on your vendor
                      account.
                    </p>
                    <button
                      type="button"
                      onClick={submitForgotPasswordRequest}
                      disabled={loading || !forgotUsername.trim() || forgotResendTimer > 0}
                      className="w-full py-4 bg-[#FF8C42] text-white text-lg font-semibold rounded-2xl hover:bg-[#FF7A29] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#FF8C42]/30"
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
                      className="w-full text-center text-sm text-gray-600 font-medium hover:underline pt-1"
                    >
                      Back to log in
                    </button>
                  </>
                )}
                {forgotStep === 2 && (
                  <>
                    {forgotInfo ? (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700">
                        {forgotInfo}
                      </div>
                    ) : null}
                    {uatRuntimeForgotHint ? (
                      <p className="text-xs text-gray-500">
                        UAT / dev: when the API is in forgot-password test mode, use OTP{' '}
                        <span className="font-mono font-medium">{UAT_FORGOT_OTP_HINT}</span>.
                      </p>
                    ) : null}
                    <label className="block text-gray-700 font-medium text-sm">6-digit code from SMS</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••••"
                      className="w-full py-3 px-4 text-lg tracking-widest border-2 border-gray-200 rounded-2xl outline-none focus:border-[#FF8C42] focus:ring-4 focus:ring-[#FF8C42]/20"
                    />
                    <button
                      type="button"
                      onClick={submitForgotPasswordVerifyOtp}
                      disabled={loading || forgotOtp.length !== 6}
                      className="w-full py-4 bg-[#FF8C42] text-white text-lg font-semibold rounded-2xl hover:bg-[#FF7A29] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#FF8C42]/30"
                    >
                      {loading ? 'Checking…' : 'Continue'}
                    </button>
                    <div className="text-center pt-1">
                      {forgotResendTimer > 0 ? (
                        <p className="text-sm text-gray-500">
                          {formatForgotCooldownMessage(forgotResendTimer, 'resend')}
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={submitForgotPasswordRequest}
                          disabled={loading}
                          className="text-sm text-[#FF8C42] font-medium hover:underline disabled:opacity-50"
                        >
                          Resend code
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={closeForgotPassword}
                      className="w-full text-center text-sm text-gray-600 font-medium hover:underline pt-1"
                    >
                      Entered wrong number?
                    </button>
                  </>
                )}
                {forgotStep === 3 && (
                  <>
                    <label className="block text-gray-700 font-medium text-sm">New password</label>
                    <div className="relative">
                      <input
                        type={showForgotNewPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full py-3 pl-4 pr-12 text-base border-2 border-gray-200 rounded-2xl outline-none focus:border-[#FF8C42] focus:ring-4 focus:ring-[#FF8C42]/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNewPassword((v) => !v)}
                        aria-label={showForgotNewPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                      >
                        {showForgotNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <label className="block text-gray-700 font-medium text-sm">Confirm password</label>
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full py-3 px-4 text-base border-2 border-gray-200 rounded-2xl outline-none focus:border-[#FF8C42] focus:ring-4 focus:ring-[#FF8C42]/20"
                    />
                    <button
                      type="button"
                      onClick={submitForgotPasswordReset}
                      disabled={
                        loading ||
                        forgotNewPassword.length < 8 ||
                        forgotNewPassword !== forgotConfirmPassword
                      }
                      className="w-full py-4 bg-[#FF8C42] text-white text-lg font-semibold rounded-2xl hover:bg-[#FF7A29] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#FF8C42]/30"
                    >
                      {loading ? 'Updating…' : 'Update password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotStep(2);
                        setError('');
                      }}
                      className="w-full text-center text-sm text-gray-600 font-medium hover:underline pt-1"
                    >
                      Back
                    </button>
                  </>
                )}
              </div>
            ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <Label htmlFor="login-phone">Phone number</Label>
                <div className="mt-1 flex items-stretch border-2 border-gray-200 rounded-lg bg-white focus-within:border-[#FF8C42] focus-within:ring-4 focus-within:ring-[#FF8C42]/20 transition-all">
                  <CountryCodeSelector
                    selectedCode={loginCountryCode}
                    onSelect={setLoginCountryCode}
                    disabled={loading}
                    triggerClassName="rounded-l-lg"
                  />
                  <input
                    id="login-phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="10-digit mobile"
                    value={loginPhoneDigits}
                    onChange={(e) =>
                      setLoginPhoneDigits(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))
                    }
                    required
                    maxLength={10}
                    className="min-w-0 flex-1 py-4 px-4 text-lg outline-none bg-transparent rounded-r-lg transition-colors duration-200"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Use the mobile number registered on your vendor account. After your first onboarding, you can use this
                  number with your password here; until then, use OTP from the registration flow.
                </p>
                {uatRuntimeForgotHint && (
                  <p className="mt-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                    UAT / dev: sign in with password <strong>12345678</strong> (same as customer app when the API runs
                    in UAT or non-prod with <code className="text-[11px]">X-UAT-Mode</code>).
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={openForgotPassword}
                  className="w-full text-right text-sm text-[#FF8C42] font-medium hover:underline pt-1"
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white h-11"
              >
                {loading ? 'Please wait...' : 'Sign In'}
              </Button>
            </form>
            )}

            {!forgotOpen && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError('');
                    setCurrentStep(1);
                  }}
                  className="text-[#FF8C42] hover:underline"
                >
                  New vendor? Register here
                </button>
              </div>
            )}

            <p className="text-center text-sm text-gray-500 mt-6">
              By signing in, you agree to our{' '}
              <button
                type="button"
                onClick={() => openLegal('vendor_terms_of_service')}
                className="text-[#FF8C42] hover:underline font-medium"
              >
                Vendor Terms of Service
              </button>
              {' '}and{' '}
              <button
                type="button"
                onClick={() => openLegal('privacy_policy')}
                className="text-[#FF8C42] hover:underline font-medium"
              >
                Privacy Policy
              </button>
            </p>
          </div>
        </div>
      </div>
      {legalDialog}
      {chatBotWidget}
      </Fragment>
    );
  }

  // Multi-step Registration Form (Steps 2+)
  return (
    <Fragment>
    <div
      className={`${usePublicAppShell ? 'min-h-0 w-full flex-1 overflow-y-auto' : 'min-h-screen'} bg-gradient-to-br from-orange-50 to-white py-8 px-4`}
    >
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            {currentStep > 2 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1">
              <h2 className="text-2xl text-[#FF8C42]">Vendor Registration</h2>
              <p className="text-sm text-gray-600">Step {currentStep - 1} of 4</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`flex-1 h-2 rounded-full ${
                  step <= currentStep - 1 ? 'bg-[#FF8C42]' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignUp}>
            {/* Step 2: Basic Info */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg mb-4">Basic Information</h3>
                
                <div>
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input
                    id="businessName"
                    placeholder="Enter business name"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="ownerName">Owner Name *</Label>
                  <Input
                    id="ownerName"
                    placeholder="Enter owner name"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Services */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg mb-4">Select Services You Offer *</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {serviceOptions.map((service) => (
                    <div
                      key={service}
                      onClick={() => toggleService(service)}
                      className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.services.includes(service)
                          ? 'border-[#FF8C42] bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          formData.services.includes(service)
                            ? 'bg-[#FF8C42] border-[#FF8C42]'
                            : 'border-gray-300'
                        }`}>
                          {formData.services.includes(service) && (
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <span className="text-sm">{service}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Address */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg mb-4">Business Address</h3>
                
                <div>
                  <Label htmlFor="address">Street Address *</Label>
                  <Input
                    id="address"
                    placeholder="Enter street address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      placeholder="City"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      placeholder="State"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      required
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input
                    id="pincode"
                    placeholder="Enter pincode"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* Step 5: Documents */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <h3 className="text-lg mb-4">Business Documents</h3>
                
                <div>
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input
                    id="gstin"
                    placeholder="Enter GSTIN"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="pan">PAN Card *</Label>
                  <Input
                    id="pan"
                    placeholder="Enter PAN number"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="aadhar">Aadhar Number *</Label>
                  <Input
                    id="aadhar"
                    placeholder="Enter Aadhar number"
                    value={formData.aadhar}
                    onChange={(e) => setFormData({ ...formData, aadhar: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="bankAccount">Bank Account Number *</Label>
                  <Input
                    id="bankAccount"
                    placeholder="Enter account number"
                    value={formData.bankAccount}
                    onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="ifsc">IFSC Code *</Label>
                  <Input
                    id="ifsc"
                    placeholder="Enter IFSC code"
                    value={formData.ifsc}
                    onChange={(e) => setFormData({ ...formData, ifsc: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div className="flex items-start gap-2 pt-4">
                  <Checkbox
                    id="terms"
                    checked={formData.agreedToTerms}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, agreedToTerms: checked as boolean })
                    }
                  />
                  <Label htmlFor="terms" className="text-sm leading-tight cursor-pointer">
                    I agree to the{' '}
                    <button
                      type="button"
                      className="text-[#FF8C42] underline font-medium"
                      onClick={(e) => {
                        e.preventDefault();
                        openLegal('vendor_terms_of_service');
                      }}
                    >
                      Vendor Terms of Service
                    </button>
                    ,{' '}
                    <button
                      type="button"
                      className="text-[#FF8C42] underline font-medium"
                      onClick={(e) => {
                        e.preventDefault();
                        openLegal('privacy_policy');
                      }}
                    >
                      Privacy Policy
                    </button>
                    , and confirm that all information provided is accurate
                  </Label>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-4 mt-8">
              {currentStep < 5 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (currentStep === 2) {
                        setIsSignUp(false);
                        setCurrentStep(1);
                      } else {
                        setCurrentStep(currentStep - 1);
                      }
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
                  >
                    Next
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || !formData.agreedToTerms}
                    className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
                  >
                    {loading ? 'Submitting...' : 'Submit Application'}
                  </Button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
    {legalDialog}
    {chatBotWidget}
    </Fragment>
  );
}
