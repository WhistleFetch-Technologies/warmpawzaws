'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { storeSession } from '@/lib/session-manager'; // ✅ SECURITY FIX

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
  const [otpCode, setOtpCode] = useState('');
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  
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
    setLoading(true);
    setError('');
    
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter a valid phone number');
      setLoading(false);
      return;
    }
    
    try {
      console.log('📤 [VendorAuth] Sending OTP to:', phoneNumber);
      
      // Send OTP using the correct endpoint
      const sendOtpData = await apiClient.post<any>('/auth/send-otp', {
        phone: phoneNumber,
        role: 'vendor'
      });
      
      console.log('✅ [VendorAuth] OTP sent successfully:', sendOtpData);
      
      // Show OTP screen
      setFormData({ ...formData, phone: phoneNumber });
      setShowOtpScreen(true);
      setLoading(false);
    } catch (error: any) {
      console.error('❌ [VendorAuth] Failed to send OTP:', error);
      setError(error.message || 'Failed to send OTP. Please try again.');
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    console.log('🔐 [VendorAuth] Verifying OTP:', otpCode);
    console.log('🔐 [VendorAuth] Phone number:', phoneNumber);
    
    try {
      // Verify OTP using the correct endpoint
      console.log('🔐 [VendorAuth] Step 1: Verifying OTP...');
      const verifyData = await apiClient.post<any>('/auth/verify-otp', {
        phone: phoneNumber,
        otp: otpCode,
        role: 'vendor'
      });
      
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
      
      // Get access token from various possible locations
      const accessToken = tokens.access_token || 
                         tokens.accessToken || 
                         responseData.token?.access_token ||
                         responseData.access_token;
      
      console.log('🔍 [VendorAuth] Extracted token:', { 
        hasToken: !!accessToken, 
        tokenPreview: accessToken ? accessToken.substring(0, 30) + '...' : 'none',
        user: user 
      });
      
      if (!accessToken) {
        console.error('❌ [VendorAuth] Token extraction failed. Response structure:', JSON.stringify(verifyData, null, 2));
        throw new Error('Authentication failed: No access token received');
      }
      
      console.log('✅ [VendorAuth] OTP verified successfully!');
      
      // Store session with access token IMMEDIATELY before any async calls
      // This ensures localStorage is set before redirect
      storeSession({
        phone: phoneNumber,
        accessToken: accessToken,
        user: user,
        vendorId: user.id
      });
      
      // Double-check storage immediately
      const storedPhoneCheck = localStorage.getItem('vendorPhone');
      const storedTokenCheck = localStorage.getItem('authToken');
      console.log('🔐 [VendorAuth] Session stored:', {
        phone: !!storedPhoneCheck,
        token: !!storedTokenCheck,
        phoneValue: storedPhoneCheck,
        tokenPreview: storedTokenCheck ? storedTokenCheck.substring(0, 30) + '...' : 'none'
      });
      
      if (!storedPhoneCheck || !storedTokenCheck) {
        console.error('❌ [VendorAuth] Session storage failed! Storing directly...');
        // Fallback: Store directly
        localStorage.setItem('vendorPhone', phoneNumber);
        localStorage.setItem('authToken', accessToken);
        if (user.id) {
          localStorage.setItem('vendorId', user.id);
        }
        localStorage.setItem('vendorUser', JSON.stringify(user));
      }
      
      // Set sessionStorage flag to track that user is logged in
      // This flag is cleared on hard refresh, allowing us to detect it
      sessionStorage.setItem('_warmpawz_vendor_has_session', 'true');
      
      // Fetch vendor onboarding status to get vendor profile
      try {
        console.log('📊 [VendorAuth] Fetching vendor status...');
        const statusData = await apiClient.get<any>('/vendor/onboarding/status?phone=' + encodeURIComponent(phoneNumber));
        
        if (statusData && statusData.identity) {
          const vendorProfile = statusData.identity.vendor || statusData.vendor;
          
          // Update stored session with vendor profile
          if (vendorProfile) {
            localStorage.setItem('vendorData', JSON.stringify(vendorProfile));
            if (vendorProfile.id) {
              localStorage.setItem('vendorId', vendorProfile.id);
            }
          }
          
          // Store onboarding status
          if (statusData.identity.onboarding_status) {
            localStorage.setItem('vendorApplicationStatus', statusData.identity.onboarding_status);
          }
          
          // Verify all session data is stored before calling onAuthSuccess
          const finalPhoneCheck = localStorage.getItem('vendorPhone');
          const finalTokenCheck = localStorage.getItem('authToken');
          console.log('✅ [VendorAuth] Final session check before redirect:', {
            phone: !!finalPhoneCheck,
            token: !!finalTokenCheck
          });
          
          onAuthSuccess({
            phone: phoneNumber,
            accessToken: accessToken,
            user: user,
            profile: vendorProfile,
            vendorId: user.id || vendorProfile?.id,
            onboardingStatus: statusData.identity.onboarding_status
          });
        } else {
          // No vendor profile yet, but OTP is verified
          localStorage.setItem('vendorApplicationStatus', 'INIT');
          
          // Verify session before redirect
          const finalPhoneCheck = localStorage.getItem('vendorPhone');
          const finalTokenCheck = localStorage.getItem('authToken');
          console.log('✅ [VendorAuth] Final session check (no profile) before redirect:', {
            phone: !!finalPhoneCheck,
            token: !!finalTokenCheck
          });
          
          onAuthSuccess({
            phone: phoneNumber,
            accessToken: accessToken,
            user: user,
            vendorId: user.id,
            onboardingStatus: 'INIT'
          });
        }
      } catch (statusError: any) {
        console.warn('⚠️ [VendorAuth] Could not fetch vendor status:', statusError);
        // OTP verified, proceed without status (user will go through onboarding)
        localStorage.setItem('vendorApplicationStatus', 'INIT');
        
        // Verify session before redirect
        const finalPhoneCheck = localStorage.getItem('vendorPhone');
        const finalTokenCheck = localStorage.getItem('authToken');
        console.log('✅ [VendorAuth] Final session check (error) before redirect:', {
          phone: !!finalPhoneCheck,
          token: !!finalTokenCheck
        });
        
        // Always call onAuthSuccess even if status fetch fails
        console.log('✅ [VendorAuth] Proceeding to onboarding despite status fetch failure');
        onAuthSuccess({
          phone: phoneNumber,
          accessToken: accessToken,
          user: user,
          vendorId: user.id,
          onboardingStatus: 'INIT'
        });
      }
    } catch (error: any) {
      console.error('❌ [VendorAuth] Login error:', error);
      setError(error.message || 'Network error. Please try again.');
      setLoading(false);
    }
  };
  
  // DEBUG: Test button to check database
  const handleDebugCheck = async () => {
    console.log('🔍 DEBUG: Checking ALL vendor data...');
    try {
      const data = await apiClient.get('/make-server-3dd53475/auth/diagnostic/all-vendors') as any;
      
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
            Thank you for registering with WarmPawz! Your vendor application is being reviewed by our admin team. 
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
      ? `+91 ${phoneNumber.slice(0, 5)} ${phoneNumber.slice(5)}`
      : `+91 ${phoneNumber}`;

    return (
      <div className="min-h-screen bg-white flex flex-col w-full max-w-[430px] mx-auto">
        {/* Status Bar */}
        <div className="px-6 pt-3 pb-2 flex justify-between items-center bg-[#FF8C42]">
          <span className="text-sm text-white">9:41</span>
          <div className="flex gap-1.5 items-center">
            <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
              <rect y="8" width="3" height="4" rx="0.5" fill="white"/>
              <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="white"/>
              <rect x="9" y="2" width="3" height="10" rx="0.5" fill="white"/>
              <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="white"/>
            </svg>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <path d="M0.5 7.5C2.5 5.5 5.5 4 8 4C10.5 4 13.5 5.5 15.5 7.5M3.5 10C5 8.5 6.5 8 8 8C9.5 8 11 8.5 12.5 10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
              <rect x="0.75" y="1.5" width="20" height="9" rx="2" stroke="white" strokeWidth="1.5"/>
              <rect x="2.5" y="3" width="16.5" height="6" rx="1" fill="white"/>
              <rect x="22" y="4" width="2.5" height="4" rx="1" fill="white"/>
            </svg>
          </div>
        </div>

        {/* Orange Header Section */}
        <div className="bg-[#FF8C42] px-6 pt-8 pb-12 flex flex-col items-center">
          {/* Logo */}
          <div className="w-20 h-20 mb-6">
            <img src={logoImage} alt="Warmpawz" className="w-full h-full object-contain" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-black text-center">
            Verify Your Number
          </h1>
        </div>

        {/* White Content Card */}
        <div className="flex-1 -mt-8 bg-white rounded-t-[32px] px-6 pt-8 pb-12">
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
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full h-14 text-center text-lg tracking-widest border-[#FF8C42]/30 focus:border-[#FF8C42] focus:ring-[#FF8C42] rounded-xl"
                placeholder="Enter 6-digit code"
                required
                autoFocus
              />
            </div>

            <Button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A29] text-white h-14 rounded-xl text-base font-bold disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </Button>
          </form>

          <div className="mt-8 space-y-4 text-center">
            <button
              type="button"
              onClick={handleSendCode}
              disabled={loading}
              className="w-full text-[#FF8C42] hover:text-[#FF7A29] text-sm underline disabled:opacity-50"
            >
              Resend Code
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
      <div className="min-h-screen bg-white flex flex-col w-full max-w-[430px] mx-auto">
        {/* Status Bar */}
        <div className="px-6 pt-3 pb-2 flex justify-between items-center bg-[#FF8C42]">
          <span className="text-sm text-white">9:41</span>
          <div className="flex gap-1.5 items-center">
            <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
              <rect y="8" width="3" height="4" rx="0.5" fill="white"/>
              <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="white"/>
              <rect x="9" y="2" width="3" height="10" rx="0.5" fill="white"/>
              <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="white"/>
            </svg>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <path d="M0.5 7.5C2.5 5.5 5.5 4 8 4C10.5 4 13.5 5.5 15.5 7.5M3.5 10C5 8.5 6.5 8 8 8C9.5 8 11 8.5 12.5 10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
              <rect x="0.75" y="1.5" width="20" height="9" rx="2" stroke="white" strokeWidth="1.5"/>
              <rect x="2.5" y="3" width="16.5" height="6" rx="1" fill="white"/>
              <rect x="22" y="4" width="2.5" height="4" rx="1" fill="white"/>
            </svg>
          </div>
        </div>

        {/* Orange Header Section */}
        <div className="bg-[#FF8C42] px-6 pt-8 pb-16 flex flex-col items-center">
          {/* Logo */}
          <div className="w-24 h-24 mb-6">
            <img src={logoImage} alt="Warmpawz" className="w-full h-full object-contain" />
          </div>

          {/* Welcome Message */}
          <h1 className="text-3xl font-bold text-white mb-2 text-center">
            Welcome to WARMPAWZ!
          </h1>
        </div>

        {/* White Content Card */}
        <div className="flex-1 -mt-8 bg-white rounded-t-[32px] px-6 pt-8 pb-12">
          <p className="text-gray-600 text-center mb-8 text-base">
            Join our community of professional pet care providers
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
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full h-14 border-[#FF8C42]/30 focus:border-[#FF8C42] focus:ring-[#FF8C42] rounded-xl text-base"
                placeholder="+91 74493 38923"
                required
                autoFocus
              />
            </div>

            <Button
              type="submit"
              disabled={loading || phoneNumber.length !== 10}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A29] text-white h-14 rounded-xl text-base font-bold disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Verification Code'}
            </Button>
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
                  alt="WarmPawz Logo" 
                  className="w-24 h-24 object-contain"
                />
              </div>
              <h1 className="text-3xl text-[#FF8C42] mb-2">WarmPawz</h1>
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