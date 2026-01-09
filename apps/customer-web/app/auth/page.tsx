'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, isUatMode } from '@/lib/api-client';

// UAT Mode Configuration - uses runtime config (deploy-time) for static exports
const UAT_OTP = '123456'; // Static OTP for UAT testing

export default function AuthPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [uatHint, setUatHint] = useState(false);
  
  // UAT_MODE must be computed at runtime (after hydration) for static exports
  const [UAT_MODE, setUatMode] = useState(false);
  useEffect(() => {
    setUatMode(isUatMode());
  }, []);

  useEffect(() => {
    // Check if already logged in
    const storedPhone = localStorage.getItem('customerPhone');
    if (storedPhone) {
      router.push('/');
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

      await apiClient.post('/auth/otp/send', { phone });
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
        localStorage.setItem('customerPhone', phone);
        localStorage.setItem('authToken', 'uat-token-customer-' + Date.now());
        router.push('/');
        return;
      }

      // UAT Mode: Wrong OTP
      if (UAT_MODE && otp !== UAT_OTP) {
        setError(`Invalid OTP. For UAT testing, use: ${UAT_OTP}`);
        return;
      }

      const response = await apiClient.post<any>('/auth/otp/verify', { phone, otp });
      
      if (response.success || response.verified) {
        localStorage.setItem('customerPhone', phone);
        
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
        
        // Check if customer exists, if not create profile
        try {
          await apiClient.get(`/customer/profile/unified/${phone}`);
        } catch {
          // Create new customer profile
          await apiClient.post('/customer/profile', { phone });
        }
        
        router.push('/');
      } else {
        setError('Invalid OTP. Please try again.');
      }
    } catch (err: any) {
      // UAT Fallback: If API fails but OTP matches, allow login
      if (UAT_MODE && otp === UAT_OTP) {
        console.log('🔧 [UAT Fallback] API failed, using static OTP verification');
        localStorage.setItem('customerPhone', phone);
        localStorage.setItem('authToken', 'uat-token-customer-' + Date.now());
        router.push('/');
        return;
      }
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Orange Header Section - 40% of screen */}
      <div className="relative bg-primary h-[40vh] flex flex-col items-center justify-center px-6">
        {/* Warmpawz Logo */}
        <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-xl mb-6 p-2">
          <img src="/logo.png" alt="Warmpawz" className="w-full h-full object-contain" />
        </div>
        
        {/* Welcome Text */}
        <h1 className="text-3xl font-bold text-white mb-2">Welcome to</h1>
        <h2 className="text-4xl font-extrabold text-white tracking-wide">WARMPAWZ!</h2>
      </div>

      {/* White Card Section - overlaps orange header */}
      <div className="flex-1 -mt-8 relative">
        <div className="bg-white rounded-t-[2.5rem] min-h-full px-6 pt-8 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          {/* Subtitle */}
          <p className="text-center text-gray-600 mb-8 text-lg">
            Join our community of pet lovers and access{'\n'}the best care for your furry friends
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
            <div className="relative">
              <div className="flex items-center border-2 border-gray-200 rounded-2xl overflow-hidden focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20 transition-all bg-white">
                <span className="pl-4 pr-2 text-gray-600 font-medium">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="74493 38923"
                  disabled={otpSent}
                  className="flex-1 py-4 pr-4 text-lg outline-none disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
            </div>

            {!otpSent ? (
              <button
                onClick={sendOtp}
                disabled={loading || phone.length !== 10}
                className="w-full py-4 bg-primary text-white text-lg font-semibold rounded-2xl hover:bg-primary-dark active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all shadow-lg shadow-primary/30"
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
            ) : (
              <>
                {/* OTP Sent Message */}
                <div className="text-center py-2">
                  <p className="text-sm text-gray-500">
                    OTP sent to <span className="font-medium text-gray-700">+91 {formatPhoneDisplay(phone)}</span>
                  </p>
                  {uatHint && (
                    <p className="mt-2 px-4 py-2 bg-primary/10 rounded-xl text-primary text-sm font-medium inline-block">
                      🧪 UAT Mode: Use OTP <strong>{UAT_OTP}</strong>
                    </p>
                  )}
                  <button
                    onClick={() => { setOtpSent(false); setOtp(''); }}
                    className="mt-2 text-primary font-medium text-sm hover:underline block mx-auto"
                  >
                    Change number
                  </button>
                </div>

                {/* OTP Input */}
                <div className="flex gap-2 justify-center my-4">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <input
                      key={index}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={otp[index] || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = e.target.value.replace(/\D/g, '');
                        const newOtp = otp.split('');
                        newOtp[index] = value;
                        setOtp(newOtp.join(''));
                        if (value && index < 5) {
                          const next = e.target.nextElementSibling as HTMLInputElement;
                          next?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otp[index] && index > 0) {
                          const prev = (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement;
                          prev?.focus();
                        }
                      }}
                      className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all outline-none"
                    />
                  ))}
                </div>

                {/* Verify Button */}
                <button
                  onClick={verifyOtp}
                  disabled={loading || otp.length !== 6}
                  className="w-full py-4 bg-primary text-white text-lg font-semibold rounded-2xl hover:bg-primary-dark active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all shadow-lg shadow-primary/30"
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
                      className="text-primary font-medium text-sm hover:underline"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Terms Footer */}
          <p className="text-center text-sm text-gray-500 mt-6">
            By continuing, you agree to our{' '}
            <a href="#" className="text-primary hover:underline font-medium">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-primary hover:underline font-medium">Privacy Policy</a>
          </p>

          {/* Already have account */}
          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <button className="text-primary hover:underline font-medium">Sign In</button>
          </p>

          {/* Footer with Version Info */}
          <div className="mt-auto pt-8 text-center space-y-1">
            <button className="text-gray-500 text-sm hover:text-primary">Need Help?</button>
            <p className="text-gray-400 text-xs">WARMPAWZ Customer v2.1.0</p>
            <p className="text-gray-400 text-xs">© 2025 WARMPAWZ Inc. All rights reserved</p>
          </div>
        </div>
      </div>
    </div>
  );
}
