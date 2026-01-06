'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { apiClient, isUatMode } from '@/lib/api-client';

interface VendorAuthProps {
  onAuthSuccess: (session: any) => void;
}

const UAT_MODE = isUatMode();

export function VendorAuth({ onAuthSuccess }: VendorAuthProps) {
  const [isSignUp, setIsSignUp] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingApproval, setPendingApproval] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOtpScreen, setShowOtpScreen] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (UAT_MODE) {
        // UAT Mode: Skip OTP sending, go directly to OTP screen
        console.log('🔐 [UAT Mode] Skipping OTP send, showing OTP screen');
        setShowOtpScreen(true);
        setLoading(false);
        return;
      }

      // Send OTP via API
      await apiClient.post('/auth/send-otp', {
        phone: phoneNumber,
        portal: 'vendor'
      });

      setShowOtpScreen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
      console.error('Send OTP error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // UAT Mode: Accept static OTP
      if (UAT_MODE && otpCode === '123456') {
        console.log('🔐 [UAT Mode] Static OTP accepted');
        // In UAT mode, create a mock session
        const mockSession = {
          phone: phoneNumber,
          user: { phone: phoneNumber },
          profile: null,
          isUatMode: true
        };
        onAuthSuccess(mockSession);
        return;
      }

      // Verify OTP via API
      const response = await apiClient.post<any>('/auth/verify-otp', {
        phone: phoneNumber,
        otp: otpCode,
        portal: 'vendor'
      });

      if (response.success && response.session) {
        // Check if vendor status is pending
        if (response.profile?.status === 'pending') {
          setPendingApproval(true);
          setLoading(false);
          return;
        }

        if (response.profile?.status === 'rejected') {
          setError('Your vendor account has been rejected. Please contact support.');
          setLoading(false);
          return;
        }

        onAuthSuccess(response.session);
      } else {
        throw new Error(response.error || 'OTP verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
      console.error('Verify OTP error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Pending Approval Screen
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
          <button
            onClick={() => {
              setPendingApproval(false);
              setIsSignUp(false);
            }}
            className="w-full bg-primary hover:bg-primary-dark text-white py-3 px-4 rounded-lg font-medium transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // OTP Verification Screen
  if (showOtpScreen) {
    return (
      <div className="min-h-screen bg-white flex flex-col w-full max-w-[430px] mx-auto">
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
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
          {/* Logo */}
          <div className="w-20 h-20 mb-8">
            <Image src="/logo.png" alt="Warmpawz" width={80} height={80} className="w-full h-full object-contain" />
          </div>

          <h1 className="text-2xl text-gray-900 mb-2 text-center">
            Enter verification code
          </h1>
          <p className="text-gray-600 text-center mb-8">
            We've sent a code to +91 {phoneNumber}
          </p>

          {UAT_MODE && (
            <div className="mb-4 w-full max-w-sm p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm text-center">
              🔐 UAT Mode: Use OTP <strong>123456</strong>
            </div>
          )}

          {error && (
            <div className="mb-6 w-full max-w-sm p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="w-full max-w-sm">
            <div className="mb-6">
              <label htmlFor="otp" className="text-gray-700 mb-2 block text-sm font-medium">
                6-digit code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full text-center text-2xl tracking-widest h-14 border border-gray-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary outline-none px-4"
                placeholder="••••••"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full bg-primary hover:bg-primary-dark text-white h-14 rounded-xl text-base font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>

            <button
              type="button"
              onClick={handleSendCode}
              disabled={loading}
              className="w-full mt-4 text-primary hover:text-primary-dark text-sm disabled:opacity-50"
            >
              Resend code
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Phone Number Entry Screen (Sign Up)
  if (isSignUp) {
    return (
      <div className="min-h-screen bg-white flex flex-col w-full max-w-[430px] mx-auto">
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
          {/* Logo */}
          <div className="w-32 h-32 mb-8">
            <Image src="/logo.png" alt="Warmpawz" width={128} height={128} className="w-full h-full object-contain" />
          </div>

          <h1 className="text-3xl text-gray-900 mb-2 text-center">
            Warmpawz Provider
          </h1>
          <p className="text-gray-600 text-center mb-10">
            Professional pet care services platform
          </p>

          {UAT_MODE && (
            <div className="mb-4 w-full max-w-sm p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm text-center">
              🔐 UAT Mode: OTP is 123456 for all numbers
            </div>
          )}

          {error && (
            <div className="mb-6 w-full max-w-sm p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSendCode} className="w-full max-w-sm">
            <div className="mb-6">
              <label htmlFor="phone" className="text-gray-700 mb-2 block text-sm font-medium">
                Mobile Number
              </label>
              <div className="flex gap-3">
                <div className="bg-gray-100 border border-gray-300 rounded-xl px-4 py-3 flex items-center">
                  <span className="text-gray-900">+91</span>
                </div>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={phoneNumber}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  className="flex-1 h-12 border border-gray-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary outline-none px-4"
                  placeholder="9876543210"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || phoneNumber.length !== 10}
              className="w-full bg-primary hover:bg-primary-dark text-white h-14 rounded-xl text-base font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Sending code...' : 'Continue'}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-10 max-w-xs">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setError('');
              }}
              className="text-primary hover:underline text-sm"
            >
              Already registered? Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Sign In Screen (Email/Password - for existing vendors)
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <Image 
                src="/logo.png" 
                alt="WarmPawz Logo" 
                width={96} 
                height={96}
                className="object-contain"
              />
            </div>
            <h1 className="text-3xl text-primary mb-2">WarmPawz</h1>
            <p className="text-gray-600">Vendor Portal</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={() => {
                setIsSignUp(true);
                setError('');
              }}
              className="w-full bg-primary hover:bg-primary-dark text-white h-11 rounded-lg font-medium transition-colors"
            >
              Continue with Phone Number
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or</span>
              </div>
            </div>

            <p className="text-sm text-gray-600 text-center">
              For existing vendors, please use phone number authentication
            </p>
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setError('');
              }}
              className="text-primary hover:underline text-sm"
            >
              New vendor? Register here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

