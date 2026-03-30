'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { CountryCodeSelector, COUNTRY_CODES } from '@/components/ui/CountryCodeSelector';

interface CustomerAuthProps {
  onAuthSuccess: (session: any) => void;
}

export function CustomerAuth({ onAuthSuccess }: CustomerAuthProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91'); // Default to India
  const [otpCode, setOtpCode] = useState('');
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showReferralInput, setShowReferralInput] = useState(false);
  const [referralApplied, setReferralApplied] = useState(false);

  // Format phone number with spaces
  const formatPhoneDisplay = (num: string) => {
    if (num.length <= 5) return num;
    return `${num.slice(0, 5)} ${num.slice(5)}`;
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      
      if (cleanPhone.length !== 10) {
        setError('Please enter a valid 10-digit phone number');
        setLoading(false);
        return;
      }

      console.log('🔐 Requesting OTP for:', `${countryCode}${cleanPhone}`);
      
      const data = await apiClient.post('/auth/send-otp', { phone: `${countryCode}${cleanPhone}` }) as any;
      console.log('✅ OTP sent:', data);
      
      if (data.uatMode) {
        toast.success('OTP: 123456 (UAT Testing Mode)', { duration: 5000 });
      } else {
        toast.success('OTP sent to your phone');
      }
      
      setShowOtpScreen(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
      console.error('❌ Send code error:', err);
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      
      console.log('🔐 Verifying OTP for:', `${countryCode}${cleanPhone}`);
      
      const data = await apiClient.post('/auth/verify-otp', { 
        phone: `${countryCode}${cleanPhone}`, 
        otp: otpCode, 
        role: 'customer',
        referralCode: referralCode || undefined
      }) as any;
      console.log('✅ OTP verified:', data);
      
      // Apply referral code if provided (for new users)
      if (referralCode && data.isNewUser) {
        try {
          console.log('🎁 Applying referral code:', referralCode);
          const referralData = await apiClient.post('/referrals/apply', {
            referralCode: referralCode,
            newUserId: data.customer.id,
            userType: 'customer'
          }) as any;
          console.log('✅ Referral code applied:', referralData);
          toast.success('Referral code applied! You\'ll earn bonus points!', { duration: 4000 });
        } catch (refError: any) {
          console.error('❌ Referral code error:', refError);
          // Don't block signup if referral fails
        }
      }
      
      // Check if user has completed onboarding
      const hasCompletedOnboarding = data.customer.onboardingComplete;
      const hasPets = data.customer.petIds && data.customer.petIds.length > 0;
      
      console.log('📊 User state:', {
        isNewUser: data.isNewUser,
        hasCompletedOnboarding,
        hasPets,
        customer: data.customer
      });
      
      // Set sessionStorage flags for hard refresh detection
      sessionStorage.setItem('_warmpawz_has_session', 'true');
      sessionStorage.setItem('_warmpawz_just_logged_in', 'true');
      console.log('✅ [Session] sessionStorage flags set for customer login');
      
      // Store country code preference
      localStorage.setItem('customerCountryCode', countryCode);
      
      // Pass complete session data
      onAuthSuccess({
        phone: cleanPhone,
        countryCode: countryCode,
        customerId: data.customer.id,
        customer: data.customer,
        sessionToken: data.sessionToken,
        verified: true,
        isNewUser: data.isNewUser,
        hasCompletedOnboarding,
        hasPets
      });
      
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
      console.error('❌ Verify OTP error:', err);
      setLoading(false);
    }
  };

  // OTP VERIFICATION SCREEN
  if (showOtpScreen) {
    const formattedPhone = phoneNumber.length === 10 
      ? `${countryCode} ${phoneNumber.slice(0, 5)} ${phoneNumber.slice(5)}`
      : `${countryCode} ${phoneNumber}`;

    return (
      <div className="min-h-screen bg-[#FF8C42] flex flex-col w-full max-w-customer mx-auto">
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

        {/* Back Button */}
        <div className="px-6 py-4">
          <button
            onClick={() => {
              setShowOtpScreen(false);
              setOtpCode('');
              setError('');
            }}
            className="flex items-center gap-2 text-black hover:opacity-80"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 16L6 10L12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm font-medium">Back</span>
          </button>
        </div>

        {/* Orange Header Section */}
        <div className="px-6 pt-4 pb-16 flex flex-col items-center">
          {/* Logo */}
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mb-6 p-2">
            <img src="/logo.png" alt="Warmpawz" className="w-full h-full object-contain" />
          </div>

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
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
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
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>

            <button
              type="button"
              onClick={handleSendCode}
              disabled={loading}
              className="w-full text-[#FF8C42] hover:text-[#FF7A29] text-sm transition-colors underline"
            >
              Resend code
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
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

          <div className="pt-8 text-center space-y-1 text-xs text-gray-400">
            <p>WARMPAWZ Customer v2.1.0</p>
            <p>© 2025 WARMPAWS Inc. All rights reserved</p>
          </div>
        </div>
      </div>
    );
  }

  // PHONE NUMBER SCREEN
  return (
    <div className="min-h-screen bg-[#FF8C42] flex flex-col w-full max-w-customer mx-auto">
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
        <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-xl mb-6 p-3">
          <img src="/logo.png" alt="Warmpawz" className="w-full h-full object-contain" />
        </div>

        <h1 className="text-2xl font-bold text-black italic text-center">
          Welcome to
        </h1>
        <h2 className="text-3xl font-extrabold text-black tracking-wide">
          WARMPAWZ!
        </h2>
      </div>

      {/* White Content Card */}
      <div className="flex-1 -mt-8 bg-white rounded-t-[32px] px-6 pt-10 pb-12">
        <p className="text-gray-600 text-center mb-10 text-base leading-relaxed">
          Join our community of pet lovers and access<br />the best care for your furry friends
        </p>

        {error && (
          <div className="mb-6 w-full p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSendCode} className="w-full space-y-6">
          <div>
            <Label htmlFor="phone" className="text-gray-700 mb-2 block text-sm font-medium">
              Mobile Number
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
            <p className="text-xs text-gray-500 mt-2">
              🔐 UAT Mode: OTP is 123456 for all numbers
            </p>
          </div>

          {/* Referral Code Section */}
          <div>
            {!showReferralInput ? (
              <button
                type="button"
                onClick={() => setShowReferralInput(true)}
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
                  <Label className="text-gray-700 text-sm font-medium">
                    Referral Code (Optional)
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReferralInput(false);
                      setReferralCode('');
                      setReferralApplied(false);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
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
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm uppercase focus:border-[#FF8C42] focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/20"
                    placeholder="Enter referral code"
                    maxLength={20}
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

          <button
            type="submit"
            disabled={loading || phoneNumber.length !== 10}
            className="w-full py-4 bg-[#FF8C42] text-white text-lg font-semibold rounded-2xl hover:bg-[#FF7A29] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#FF8C42]/30"
          >
            {loading ? 'Sending code...' : 'Continue'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-10 max-w-xs mx-auto">
          By continuing, you agree to our{' '}
          <a href="#" className="text-[#FF8C42] underline">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-[#FF8C42] underline">Privacy Policy</a>
        </p>

        <div className="pt-6 text-center space-y-1 text-xs text-gray-400">
          <p>WARMPAWZ Customer v2.1.0</p>
          <p>© 2025 WARMPAWS Inc. All rights reserved</p>
        </div>
      </div>
    </div>
  );
}
