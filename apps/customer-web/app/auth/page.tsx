'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export default function AuthPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

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

  const sendOtp = async () => {
    if (!phone || phone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await apiClient.post('/auth/otp/send', { phone });
      setOtpSent(true);
      setResendTimer(60);
    } catch (err: any) {
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
      const response = await apiClient.post<any>('/auth/otp/verify', { phone, otp });
      
      if (response.success || response.verified) {
        localStorage.setItem('customerPhone', phone);
        
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
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex flex-col">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">
            🐾
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Warmpawz</h1>
            <p className="text-sm text-gray-500">Pet care, simplified</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center">
              <div className="text-6xl mb-4">👋</div>
              <h2 className="text-2xl font-bold text-gray-900">Welcome</h2>
              <p className="text-gray-500 mt-2">Sign in to book services for your furry friend</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Phone Input */}
            <div className="space-y-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter mobile number"
                  disabled={otpSent}
                  className="w-full pl-14 pr-4 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition outline-none disabled:bg-gray-50"
                />
              </div>

              {!otpSent ? (
                <button
                  onClick={sendOtp}
                  disabled={loading || phone.length !== 10}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-lg font-semibold rounded-2xl hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-orange-200"
                >
                  {loading ? 'Sending...' : 'Get OTP'}
                </button>
              ) : (
                <>
                  <p className="text-center text-sm text-gray-500">
                    OTP sent to +91 {phone}
                    <button
                      onClick={() => { setOtpSent(false); setOtp(''); }}
                      className="text-orange-500 ml-2 font-medium"
                    >
                      Change
                    </button>
                  </p>

                  <div className="flex gap-2 justify-center">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <input
                        key={index}
                        type="text"
                        maxLength={1}
                        value={otp[index] || ''}
                        onChange={(e) => {
                          const newOtp = otp.split('');
                          newOtp[index] = e.target.value;
                          setOtp(newOtp.join(''));
                          if (e.target.value && index < 5) {
                            const next = e.target.nextElementSibling as HTMLInputElement;
                            next?.focus();
                          }
                        }}
                        className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition outline-none"
                      />
                    ))}
                  </div>

                  <button
                    onClick={verifyOtp}
                    disabled={loading || otp.length !== 6}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-lg font-semibold rounded-2xl hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition shadow-lg shadow-orange-200"
                  >
                    {loading ? 'Verifying...' : 'Verify & Continue'}
                  </button>

                  <div className="text-center">
                    {resendTimer > 0 ? (
                      <p className="text-gray-500 text-sm">Resend OTP in {resendTimer}s</p>
                    ) : (
                      <button onClick={sendOtp} className="text-orange-500 font-medium text-sm">
                        Resend OTP
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </main>
    </div>
  );
}

