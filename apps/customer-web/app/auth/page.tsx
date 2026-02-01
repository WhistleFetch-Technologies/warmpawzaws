'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient, isUatMode } from '@/lib/api-client';
import { CountryCodeSelector, COUNTRY_CODES } from '@/components/ui/CountryCodeSelector';

// UAT Mode Configuration - uses runtime config (deploy-time) for static exports
const UAT_OTP = '123456'; // Static OTP for UAT testing

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectAfterLogin = searchParams?.get('redirect');
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
    const storedToken = localStorage.getItem('authToken') || localStorage.getItem('cognitoAccessToken');
    
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

  const sendOtp = async () => {
    if (!phone || phone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // UAT Mode: Skip API call, use static OTP
      if (UAT_MODE) {
        console.log('🔧 [UAT Mode] OTP bypassed. Use:', UAT_OTP);
        setOtpSent(true);
        setResendTimer(60);
        setUatHint(true);
        return;
      }

      await apiClient.post('/auth/otp/send', { phone: `${countryCode}${phone}` });
      setOtpSent(true);
      setResendTimer(60);
    } catch (err: any) {
      // UAT Fallback: If API fails, allow UAT mode
      if (UAT_MODE) {
        console.log('🔧 [UAT Fallback] API failed, using static OTP:', UAT_OTP);
        setOtpSent(true);
        setResendTimer(60);
        setUatHint(true);
        return;
      }
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // UAT Mode: Accept static OTP without API call
      if (UAT_MODE && otp === UAT_OTP) {
        console.log('🔧 [UAT Mode] OTP verified successfully (static)');
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        localStorage.setItem('customerPhone', cleanPhone);
        localStorage.setItem('customer_phone', cleanPhone);
        localStorage.setItem('phone', cleanPhone);
        localStorage.setItem('customerCountryCode', countryCode);
        localStorage.setItem('authToken', `uat-token-customer-${cleanPhone}-${Date.now()}`);
        
        // Store referral code if provided
        if (referralCode) {
          localStorage.setItem('pendingReferralCode', referralCode);
        }
        
        // ✅ FIX: Set sessionStorage flags BEFORE navigation to prevent hard refresh detection
        sessionStorage.setItem('_warmpawz_has_session', 'true');
        sessionStorage.setItem('_warmpawz_just_logged_in', 'true');
        console.log('✅ [Auth] UAT Mode - sessionStorage flags set before navigation');
        
        // Try to fetch profile to set onboarding state (non-blocking)
        try {
          const profileResponse = await apiClient.get<any>(`/customer/profile/unified/${phone}`);
          if (profileResponse?.profile) {
            localStorage.setItem('customerData', JSON.stringify(profileResponse.profile));
            localStorage.setItem('customerId', profileResponse.profile.id);
            localStorage.setItem('customerProfile', JSON.stringify(profileResponse.profile));
            
            const onboardingStatus = profileResponse.profile.onboarding_status || 'INIT';
            const profileCompleted = profileResponse.profile.profile_completed;
            
            // Check for pets
            try {
              const petsResponse = await apiClient.get<any>(`/customer/pets/${phone}`);
              if (petsResponse?.pets?.length > 0) {
                localStorage.setItem('customerPets', JSON.stringify(petsResponse.pets));
                localStorage.setItem('customerOnboardingComplete', 'true');
              }
            } catch {}
            
            if (onboardingStatus === 'COMPLETED' || profileCompleted) {
              localStorage.setItem('customerOnboardingComplete', 'true');
            }
          }
        } catch {
          // New customer - will go through onboarding
          localStorage.setItem('customerOnboardingComplete', 'false');
        }
        
        router.push(redirectAfterLogin && redirectAfterLogin.startsWith('/') ? redirectAfterLogin : '/');
        return;
      }

      // UAT Mode: Wrong OTP
      if (UAT_MODE && otp !== UAT_OTP) {
        setError(`Invalid OTP. For UAT testing, use: ${UAT_OTP}`);
        return;
      }

      const fullPhoneForApi = `${countryCode}${phone}`;
      const response = await apiClient.post<any>('/auth/otp/verify', { 
        phone: fullPhoneForApi, 
        otp,
        referralCode: referralCode || undefined 
      });
      
      if (response.success || response.verified) {
        const shortPhone = phone.replace(/\D/g, '').slice(-10);
        localStorage.setItem('customerPhone', shortPhone);
        localStorage.setItem('customer_phone', shortPhone);
        localStorage.setItem('phone', shortPhone);
        localStorage.setItem('customerCountryCode', countryCode);
        
        // Store Cognito tokens (AWS Serverless compatible)
        if (response.idToken && response.accessToken) {
          const { storeCognitoTokens, storeUserInfo } = require('@/lib/cognito-auth');
          storeCognitoTokens({
            accessToken: response.accessToken,
            idToken: response.idToken,
            refreshToken: response.refreshToken || '',
            expiresIn: response.expiresIn || 3600,
          });
          if (response.userId) {
            storeUserInfo({ userId: response.userId, phone, username: response.username });
          }
        } else if (response.accessToken) {
          // Fallback to legacy token
          localStorage.setItem('authToken', response.accessToken);
        }
        
        // Set sessionStorage flags to track that user is logged in
        // These flags are cleared on hard refresh, allowing us to detect it
        sessionStorage.setItem('_warmpawz_has_session', 'true');
        sessionStorage.setItem('_warmpawz_just_logged_in', 'true'); // ✅ FIX: Prevent session clearing right after login
        console.log('✅ [Auth] sessionStorage flags set after OTP verification');
        
        // Get customer profile and pets to check onboarding status
        try {
          const profileResponse = await apiClient.get<any>(`/customer/profile/unified/${phone}`);
          
          // Store customer state from database (not localStorage)
          if (profileResponse.profile) {
            const onboardingStatus = profileResponse.profile.onboarding_status || profileResponse.profile.onboardingStatus;
            const profileCompleted = profileResponse.profile.profile_completed || profileResponse.profile.onboardingComplete;
            const hasName = !!profileResponse.profile.name && profileResponse.profile.name !== `Customer ${phone.slice(-4)}`;
            
            // Store in localStorage for CustomerApp to use
            localStorage.setItem('customerData', JSON.stringify(profileResponse.profile));
            localStorage.setItem('customerId', profileResponse.profile.id);
            localStorage.setItem('customerProfile', JSON.stringify(profileResponse.profile));
            
            // Also check if customer has pets
            let hasPets = false;
            try {
              const petsResponse = await apiClient.get<any>(`/customer/pets/${phone}`);
              if (petsResponse?.pets && Array.isArray(petsResponse.pets) && petsResponse.pets.length > 0) {
                hasPets = true;
                localStorage.setItem('customerPets', JSON.stringify(petsResponse.pets));
              }
            } catch {
              // No pets yet
            }
            
            // Customer is onboarded if:
            // 1. Status is COMPLETED, OR
            // 2. profile_completed is true, OR  
            // 3. They have a real name AND have pets (legacy data fix)
            const isOnboarded = onboardingStatus === 'COMPLETED' || profileCompleted || (hasName && hasPets);
            
            if (isOnboarded) {
              localStorage.setItem('customerOnboardingComplete', 'true');
              localStorage.setItem('customerJourneyStage', 'have-pet');
            } else if (hasName && !hasPets) {
              // Has profile but no pets - skip to pet step
              localStorage.setItem('customerOnboardingComplete', 'false');
              localStorage.setItem('customerJourneyStage', 'have-pet');
              localStorage.setItem('customerProfile', JSON.stringify(profileResponse.profile));
            } else {
              localStorage.setItem('customerOnboardingComplete', 'false');
            }
          }
        } catch {
          // Customer doesn't exist yet - will be created by backend on first profile access
          localStorage.setItem('customerOnboardingComplete', 'false');
        }
        
        router.push(redirectAfterLogin && redirectAfterLogin.startsWith('/') ? redirectAfterLogin : '/');
      } else {
        setError('Invalid OTP. Please try again.');
      }
    } catch (err: any) {
      // UAT Fallback: If API fails but OTP matches, allow login
      if (UAT_MODE && otp === UAT_OTP) {
        console.log('🔧 [UAT Fallback] API failed, using static OTP verification');
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        localStorage.setItem('customerPhone', cleanPhone);
        localStorage.setItem('customer_phone', cleanPhone);
        localStorage.setItem('phone', cleanPhone);
        localStorage.setItem('customerCountryCode', countryCode);
        localStorage.setItem('authToken', 'uat-token-customer-' + Date.now());
        
        // Store referral code if provided
        if (referralCode) {
          localStorage.setItem('pendingReferralCode', referralCode);
        }
        
        // CRITICAL: Set session flag before navigation to prevent hard refresh detection
        sessionStorage.setItem('_warmpawz_has_session', 'true');
        
        // Also mark as just logged in to prevent session clearing
        sessionStorage.setItem('_warmpawz_just_logged_in', 'true');
        
        // Try to fetch profile to set onboarding state
        try {
          const profileResponse = await apiClient.get<any>(`/customer/profile/unified/${phone}`);
          if (profileResponse?.profile) {
            localStorage.setItem('customerData', JSON.stringify(profileResponse.profile));
            localStorage.setItem('customerId', profileResponse.profile.id);
            localStorage.setItem('customerProfile', JSON.stringify(profileResponse.profile));
            
            const onboardingStatus = profileResponse.profile.onboarding_status || 'INIT';
            const profileCompleted = profileResponse.profile.profile_completed;
            
            // Check for pets
            try {
              const petsResponse = await apiClient.get<any>(`/customer/pets/${phone}`);
              if (petsResponse?.pets?.length > 0) {
                localStorage.setItem('customerPets', JSON.stringify(petsResponse.pets));
                localStorage.setItem('customerOnboardingComplete', 'true');
              }
            } catch {}
            
            if (onboardingStatus === 'COMPLETED' || profileCompleted) {
              localStorage.setItem('customerOnboardingComplete', 'true');
            }
          }
        } catch {
          // New customer - will go through onboarding
          localStorage.setItem('customerOnboardingComplete', 'false');
        }
        
        router.push(redirectAfterLogin && redirectAfterLogin.startsWith('/') ? redirectAfterLogin : '/');
        return;
      }
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  // OTP VERIFICATION SCREEN
  if (otpSent) {
    return (
      <div className="min-h-screen flex justify-center bg-[#FF8C42]">
        {/* Centered Container */}
        <div className="w-full max-w-md min-h-screen flex flex-col bg-[#FF8C42]">
          {/* Status Bar Placeholder */}
          <div className="px-6 pt-3 pb-2 flex justify-between items-center">
            <span className="text-sm font-medium text-black">09:41</span>
            <div className="flex gap-1.5 items-center">
              <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
                <rect y="8" width="3" height="4" rx="0.5" fill="black"/>
                <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="black"/>
                <rect x="9" y="2" width="3" height="10" rx="0.5" fill="black"/>
                <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="black"/>
              </svg>
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                <path d="M0.5 7.5C2.5 5.5 5.5 4 8 4C10.5 4 13.5 5.5 15.5 7.5M3.5 10C5 8.5 6.5 8 8 8C9.5 8 11 8.5 12.5 10" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
                <rect x="0.75" y="1.5" width="20" height="9" rx="2" stroke="black" strokeWidth="1.5"/>
                <rect x="2.5" y="3" width="16.5" height="6" rx="1" fill="black"/>
                <rect x="22" y="4" width="2.5" height="4" rx="1" fill="black"/>
              </svg>
            </div>
          </div>

          {/* Orange Header Section */}
          <div className="px-6 pt-8 pb-20 flex flex-col items-center">
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
                    <a href="#" className="text-[#FF8C42] hover:underline font-medium">Get Help</a>
                  </p>
                  <button
                    onClick={() => { setOtpSent(false); setOtp(''); setError(null); }}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    &lt; Change phone number
                  </button>
                </div>
              </div>

              {/* Footer with Version Info */}
              <div className="mt-auto pt-10 text-center space-y-1">
                <p className="text-gray-400 text-xs">WARMPAWZ Provider v2.1.0</p>
                <p className="text-gray-400 text-xs">© 2025 WARMPAWS Inc. All rights reserved</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PHONE NUMBER ENTRY SCREEN
  return (
    <div className="min-h-screen flex justify-center bg-[#FF8C42]">
      {/* Centered Container */}
      <div className="w-full max-w-md min-h-screen flex flex-col bg-[#FF8C42]">
        {/* Status Bar Placeholder */}
        <div className="px-6 pt-3 pb-2 flex justify-between items-center">
          <span className="text-sm font-medium text-black">09:41</span>
          <div className="flex gap-1.5 items-center">
            <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
              <rect y="8" width="3" height="4" rx="0.5" fill="black"/>
              <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="black"/>
              <rect x="9" y="2" width="3" height="10" rx="0.5" fill="black"/>
              <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="black"/>
            </svg>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <path d="M0.5 7.5C2.5 5.5 5.5 4 8 4C10.5 4 13.5 5.5 15.5 7.5M3.5 10C5 8.5 6.5 8 8 8C9.5 8 11 8.5 12.5 10" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
              <rect x="0.75" y="1.5" width="20" height="9" rx="2" stroke="black" strokeWidth="1.5"/>
              <rect x="2.5" y="3" width="16.5" height="6" rx="1" fill="black"/>
              <rect x="22" y="4" width="2.5" height="4" rx="1" fill="black"/>
            </svg>
          </div>
        </div>

        {/* Orange Header Section */}
        <div className="px-6 pt-8 pb-20 flex flex-col items-center">
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
              Join our community of pet lovers and access<br />the best care for your furry friends
            </p>

            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <span className="text-red-500 text-xl">⚠️</span>
                <p className="text-red-600 text-sm flex-1">{error}</p>
              </div>
            )}

            {/* Phone Input Section */}
            <div className="space-y-4">
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
            </div>

            {/* Terms Footer */}
            <p className="text-center text-sm text-gray-500 mt-6">
              By continuing, you agree to our{' '}
              <a href="#" className="text-[#FF8C42] hover:text-[#FF6B9D] hover:underline font-medium transition-colors">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-[#FF8C42] hover:text-[#FF6B9D] hover:underline font-medium transition-colors">Privacy Policy</a>
            </p>

            {/* Already have account */}
            <p className="text-center text-sm text-gray-500 mt-4">
              Already have an account?{' '}
              <button className="text-[#FF8C42] hover:text-[#FF6B9D] hover:underline font-medium transition-colors">Sign In</button>
            </p>

            {/* Footer with Version Info */}
            <div className="mt-auto pt-8 text-center space-y-1">
              <button className="text-gray-500 text-sm hover:text-[#FF8C42] transition-colors">Need Help?</button>
              <p className="text-gray-400 text-xs">WARMPAWZ Customer v2.1.0</p>
              <p className="text-gray-400 text-xs">© 2025 WARMPAWZ Inc. All rights reserved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Code Modal Overlay - Alternative full-screen modal */}
      {/* This can be enabled if you prefer a modal approach */}
    </div>
  );
}
