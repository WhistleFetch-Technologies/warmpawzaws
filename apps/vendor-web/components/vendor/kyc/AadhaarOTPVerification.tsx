'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, AlertCircle, Loader2, Send, RefreshCw, Shield } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface AadhaarOTPVerificationProps {
  vendorId: string;
  value?: string;
  onChange?: (value: string) => void;
  onVerified?: (data: AadhaarVerificationData) => void;
  disabled?: boolean;
  label?: string;
  helpText?: string;
  required?: boolean;
  className?: string;
}

interface AadhaarVerificationData {
  verified: boolean;
  maskedAadhaar: string;
  name?: string;
}

type VerificationStep = 'input' | 'otp_sent' | 'verifying' | 'verified' | 'error';

export function AadhaarOTPVerification({
  vendorId,
  value = '',
  onChange,
  onVerified,
  disabled = false,
  label = 'Aadhaar Number',
  helpText = 'Your Aadhaar will be verified via OTP sent to registered mobile',
  required = true,
  className = '',
}: AadhaarOTPVerificationProps) {
  const [aadhaarNumber, setAadhaarNumber] = useState(value);
  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [step, setStep] = useState<VerificationStep>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedData, setVerifiedData] = useState<AadhaarVerificationData | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [maskedAadhaar, setMaskedAadhaar] = useState<string>('');
  
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Focus OTP input when step changes to otp_sent
  useEffect(() => {
    if (step === 'otp_sent' && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  // Format Aadhaar number with spaces (XXXX XXXX XXXX)
  const formatAadhaarNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4));
    }
    return parts.join(' ');
  };

  // Handle Aadhaar input change
  const handleAadhaarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAadhaarNumber(e.target.value);
    const digits = formatted.replace(/\s/g, '');
    setAadhaarNumber(digits);
    onChange?.(digits);
    setError(null);
  };

  // Validate Aadhaar number
  const isValidAadhaar = (aadhaar: string): boolean => {
    return /^[0-9]{12}$/.test(aadhaar);
  };

  // Send OTP
  const handleSendOTP = async () => {
    if (!isValidAadhaar(aadhaarNumber)) {
      setError('Please enter a valid 12-digit Aadhaar number');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<{
        success: boolean;
        requestId?: string;
        maskedAadhaar?: string;
        message?: string;
        error?: string;
      }>('/kyc/aadhaar/generate-otp', {
        aadhaarNumber,
        vendorId,
      });

      if (response.success && response.requestId) {
        setRequestId(response.requestId);
        setMaskedAadhaar(response.maskedAadhaar || `XXXX XXXX ${aadhaarNumber.slice(-4)}`);
        setStep('otp_sent');
        setCountdown(60); // 60 seconds cooldown for resend
        setOtp('');
      } else {
        setError(response.error || response.message || 'Failed to send OTP');
        setStep('error');
      }
    } catch (err: any) {
      console.error('Error sending Aadhaar OTP:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    if (!requestId) {
      setError('Session expired. Please request OTP again.');
      setStep('input');
      return;
    }

    setLoading(true);
    setError(null);
    setStep('verifying');

    try {
      const response = await apiClient.post<{
        success: boolean;
        verified: boolean;
        data?: {
          name: string;
          maskedAadhaar: string;
        };
        error?: string;
        message?: string;
      }>('/kyc/aadhaar/verify-otp', {
        requestId,
        otp,
        vendorId,
        aadhaarNumber,
      });

      if (response.success && response.verified) {
        const verificationData: AadhaarVerificationData = {
          verified: true,
          maskedAadhaar: response.data?.maskedAadhaar || maskedAadhaar,
          name: response.data?.name,
        };
        setVerifiedData(verificationData);
        setStep('verified');
        onVerified?.(verificationData);
      } else {
        setError(response.error || response.message || 'Invalid OTP');
        setStep('otp_sent');
      }
    } catch (err: any) {
      console.error('Error verifying Aadhaar OTP:', err);
      setError(err.message || 'Failed to verify OTP. Please try again.');
      setStep('otp_sent');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input change
  const handleOTPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
    setError(null);
  };

  // Reset verification
  const handleReset = () => {
    setStep('input');
    setOtp('');
    setRequestId(null);
    setError(null);
    setVerifiedData(null);
  };

  // Render based on step
  const renderContent = () => {
    switch (step) {
      case 'verified':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-green-800">Aadhaar Verified</p>
                <p className="text-sm text-green-600">
                  {verifiedData?.maskedAadhaar}
                  {verifiedData?.name && ` - ${verifiedData.name}`}
                </p>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-green-600 hover:text-green-700 text-sm underline"
                >
                  Change
                </button>
              )}
            </div>
          </div>
        );

      case 'otp_sent':
      case 'verifying':
        return (
          <div className="space-y-4">
            {/* Masked Aadhaar display */}
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Shield className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800">OTP sent to mobile linked with {maskedAadhaar}</span>
            </div>

            {/* OTP Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter 6-digit OTP
              </label>
              <div className="flex gap-3">
                <input
                  ref={otpInputRef}
                  type="text"
                  value={otp}
                  onChange={handleOTPChange}
                  placeholder="Enter OTP"
                  maxLength={6}
                  disabled={loading}
                  className="flex-1 px-4 py-3 text-lg tracking-widest text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] disabled:bg-gray-100"
                  autoComplete="one-time-code"
                />
                <button
                  type="button"
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.length !== 6}
                  className="px-6 py-3 bg-[#FF8C42] text-white font-medium rounded-lg hover:bg-[#E67A30] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {step === 'verifying' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying
                    </>
                  ) : (
                    'Verify'
                  )}
                </button>
              </div>
            </div>

            {/* Resend OTP */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Didn't receive OTP?</span>
              {countdown > 0 ? (
                <span className="text-gray-400">Resend in {countdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={loading}
                  className="text-[#FF8C42] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-4 h-4" />
                  Resend OTP
                </button>
              )}
            </div>

            {/* Change Aadhaar */}
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Change Aadhaar Number
            </button>
          </div>
        );

      default: // 'input' or 'error'
        return (
          <div className="space-y-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={formatAadhaarNumber(aadhaarNumber)}
                onChange={handleAadhaarChange}
                placeholder="Enter 12-digit Aadhaar"
                disabled={disabled || loading}
                className="flex-1 px-4 py-3 text-lg tracking-wider border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] disabled:bg-gray-100"
                maxLength={14} // 12 digits + 2 spaces
              />
              <button
                type="button"
                onClick={handleSendOTP}
                disabled={disabled || loading || !isValidAadhaar(aadhaarNumber)}
                className="px-6 py-3 bg-[#FF8C42] text-white font-medium rounded-lg hover:bg-[#E67A30] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send OTP
                  </>
                )}
              </button>
            </div>

            {helpText && !error && (
              <p className="text-sm text-gray-500">{helpText}</p>
            )}
          </div>
        );
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Content based on step */}
      {renderContent()}

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}

export default AadhaarOTPVerification;
