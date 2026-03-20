'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { storeSession } from '@/lib/session-manager';
import { CountryCodeSelector, COUNTRY_CODES } from '@/components/ui/CountryCodeSelector';

const logoImage = '/logo.png';

interface VendorAuthProps {
  onAuthSuccess: (session: any) => void;
}

export function VendorAuth({ onAuthSuccess }: VendorAuthProps) {
  const [isSignUp, setIsSignUp] = useState(true);
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
    'Mating Services'
  ];

  // Format phone number with spaces
  const formatPhoneDisplay = (num: string) => {
    if (num.length <= 5) return num;
    return `${num.slice(0, 5)} ${num.slice(5)}`;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Use API Gateway for email/password login
      const loginData = await apiClient.post<any>('/auth/login', {
        email: formData.email,
        password: formData.password,
        portal: 'vendor'
      });

      if (loginData.error) {
        throw new Error(loginData.error);
      }

      const vendorData = await apiClient.get('/vendor/profile') as any;
      
      if (vendorData && vendorData.vendor) {
        if (vendorData.vendor.status === 'pending') {
          setPendingApproval(true);
          setLoading(false);
          return;
        } else if (vendorData.vendor.status === 'rejected') {
          setError('Your vendor account has been rejected. Please contact support.');
          setLoading(false);
          return;
        }
      }

      // Store session
      if (loginData.session) {
        storeSession({
          phone: loginData.user?.phone || formData.email,
          accessToken: loginData.session.accessToken || loginData.session.token,
          user: loginData.user,
          profile: loginData.profile,
          vendorId: loginData.profile?.id || loginData.profile?.vendorId
        });
      }

      onAuthSuccess(loginData.session || loginData);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
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
        accessToken: accessToken,
        user: user,
        profile: profile,
        vendorId: user.id || profile.id
      });
      
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
      console.log('✅ [Vendor Session] sessionStorage flags set after login');
      
      // ✅ FIX: Use onboarding_status from verify-otp response directly (no separate API call needed)
      // The verify-otp endpoint already returns the correct onboarding_status
      console.log('✅ [VendorAuth] Using onboarding status from verify-otp response:', onboardingStatus);
      
      // Call onAuthSuccess immediately with the status from verify-otp response
      onAuthSuccess({
        phone: phoneNumber,
        accessToken: accessToken,
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
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex items-center justify-center p-4">
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
    );
  }

  // OTP VERIFICATION SCREEN - PIXEL PERFECT
  if (showOtpScreen) {
    const formattedPhone = phoneNumber.length === 10 
      ? `${countryCode} ${phoneNumber.slice(0, 5)} ${phoneNumber.slice(5)}`
      : `${countryCode} ${phoneNumber}`;

    return (
      <div className="min-h-screen bg-[#FF8C42] flex flex-col w-full max-w-[430px] mx-auto">


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
                <a href="#" className="text-[#FF8C42] underline">Get Help</a>
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
    );
  }

  // PHONE NUMBER ENTRY SCREEN
  if (isSignUp && currentStep === 1 && !showOtpScreen) {
    return (
      <div className="min-h-screen bg-[#FF8C42] flex flex-col w-full max-w-[430px] mx-auto">
        {/* Status Bar */}
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
              <div className="flex items-stretch border-2 border-gray-200 rounded-2xl overflow-hidden focus-within:border-[#FF8C42] focus-within:ring-4 focus-within:ring-[#FF8C42]/20 transition-all bg-white">
                <CountryCodeSelector
                  selectedCode={countryCode}
                  onSelect={setCountryCode}
                  disabled={false}
                />
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  className="flex-1 py-4 px-4 text-lg outline-none"
                  placeholder="74493 38923"
                  required
                  autoFocus
                />
              </div>
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
              <a href="#" className="text-[#FF8C42] underline">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-[#FF8C42] underline">Privacy Policy</a>
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

            <div className="pt-6 space-y-1 text-xs text-gray-400">
              <p>Need Help?</p>
              <p>WARMPAWS Provider v2.1.0</p>
              <p>© 2025 WARMPAWZ Inc. All rights reserved</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isSignUp) {
    // Sign In Screen
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex items-center justify-center p-4">
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

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white h-11"
              >
                {loading ? 'Please wait...' : 'Sign In'}
              </Button>
            </form>

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
          </div>
        </div>
      </div>
    );
  }

  // Multi-step Registration Form (Steps 2+)
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white py-8 px-4">
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
                
                <div className="grid grid-cols-2 gap-3">
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

                <div className="grid grid-cols-2 gap-4">
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
                    I agree to the terms and conditions and confirm that all information provided is accurate
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
  );
}
