'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface CustomerAuthProps {
  onAuthSuccess: (session: any) => void;
}

export function CustomerAuth({ onAuthSuccess }: CustomerAuthProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState(''); // ✅ NEW: Referral code state
  const [showReferralInput, setShowReferralInput] = useState(false); // ✅ NEW: Toggle referral input

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

      console.log('🔐 Requesting OTP for:', cleanPhone);
      
      const data = await apiClient.post('/customer/auth/request-otp', { phone: cleanPhone }) as any;
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
      
      console.log('🔐 Verifying OTP for:', cleanPhone);
      
      const data = await apiClient.post('/customer/auth/verify-otp', { phone: cleanPhone, otp: otpCode }) as any;
      console.log('✅ OTP verified:', data);
      
      // ✅ NEW: Apply referral code if provided
      if (referralCode && data.isNewUser) {
        try {
          console.log('🎁 Applying referral code:', referralCode);
          const referralData = await apiClient.post('/customer/referrals/apply', {
            referralCode: referralCode,
            newUserId: data.customer.id,
            userType: 'customer'
          }) as any;
          console.log('✅ Referral code applied:', referralData);
          toast.success('🎉 Referral code applied! You\'ll earn bonus points!', { duration: 4000 });
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
      
      // Pass complete session data
      onAuthSuccess({
        phone: cleanPhone,
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
    return (
      <div className="min-h-screen bg-white flex flex-col w-full max-w-[430px] mx-auto">
        {/* Status Bar */}
        <div className="px-6 pt-3 pb-2 flex justify-between items-center bg-white">
          <span className="text-sm">9:41</span>
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
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 16L6 10L12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm">Back</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
          {/* Logo */}
          <div className="w-20 h-20 mb-8">
            <img src="/logo.png" alt="Warmpawz" className="w-full h-full object-contain" />
          </div>

          <h1 className="text-gray-900 mb-2 text-center">
            Enter verification code
          </h1>
          <p className="text-gray-600 text-center mb-8">
            We've sent a code to +91 {phoneNumber}
          </p>

          {error && (
            <div className="mb-6 w-full max-w-sm p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="w-full max-w-sm">
            <div className="mb-6">
              <Label htmlFor="otp" className="text-gray-700 mb-2 block">
                6-digit code
              </Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                className="text-center text-2xl tracking-widest h-14 border-gray-300 focus:border-[#FF8C42] focus:ring-4 focus:ring-[#FF8C42]/20 transition-all"
                placeholder="••••••"
                required
                autoFocus
              />
            </div>

            <Button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white h-14 rounded-xl text-base disabled:opacity-50 shadow-lg shadow-[#FF8C42]/30 transition-all"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </Button>

            <button
              type="button"
              onClick={handleSendCode}
              disabled={loading}
              className="w-full mt-4 text-[#FF8C42] hover:text-[#FF6B9D] text-sm disabled:opacity-50 transition-colors"
            >
              Resend code
            </button>
          </form>
        </div>
      </div>
    );
  }

  // PHONE NUMBER SCREEN
  return (
    <div className="min-h-screen bg-white flex flex-col w-full max-w-[430px] mx-auto">
      {/* Status Bar */}
      <div className="px-6 pt-3 pb-2 flex justify-between items-center bg-white">
        <span className="text-sm">9:41</span>
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

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        {/* Logo */}
        <div className="w-32 h-32 mb-8">
          <img src="/logo.png" alt="Warmpawz" className="w-full h-full object-contain" />
        </div>

        <h1 className="text-gray-900 mb-2 text-center">
          Welcome to Warmpawz
        </h1>
        <p className="text-gray-600 text-center mb-10">
          Pet Care. Reimagined.
        </p>

        {error && (
          <div className="mb-6 w-full max-w-sm p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSendCode} className="w-full max-w-sm">
          <div className="mb-6">
            <Label htmlFor="phone" className="text-gray-700 mb-2 block">
              Mobile Number
            </Label>
            <div className="flex gap-3">
              <div className="bg-gray-100 border border-gray-300 rounded-xl px-4 py-3 flex items-center">
                <span className="text-gray-900">+91</span>
              </div>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                className="flex-1 h-12 border-gray-300 focus:border-[#FF8C42] focus:ring-4 focus:ring-[#FF8C42]/20 transition-all"
                placeholder="9876543210"
                required
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              🔐 UAT Mode: OTP is 123456 for all numbers
            </p>
          </div>

            <Button
              type="submit"
              disabled={loading || phoneNumber.length !== 10}
              className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white h-14 rounded-xl text-base disabled:opacity-50 shadow-lg shadow-[#FF8C42]/30 transition-all"
            >
            {loading ? 'Sending code...' : 'Continue'}
          </Button>

          {/* ✅ NEW: Referral Code Section */}
          <div className="mt-6">
            {!showReferralInput ? (
              <button
                type="button"
                onClick={() => setShowReferralInput(true)}
                className="w-full text-[#FF8C42] hover:text-[#FF6B9D] text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Have a referral code?
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="referral" className="text-gray-700 text-sm">
                    Referral Code (Optional)
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReferralInput(false);
                      setReferralCode('');
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
                <Input
                  id="referral"
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className="h-12 border-gray-300 focus:border-yellow-500 focus:ring-yellow-500 uppercase"
                  placeholder="Enter referral code"
                  maxLength={20}
                />
                {referralCode && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    You'll earn bonus points after signup!
                  </p>
                )}
              </div>
            )}
          </div>
        </form>

        <p className="text-xs text-gray-400 text-center mt-10 max-w-xs">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}