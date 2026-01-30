'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertCircle, Loader2, RefreshCw, CreditCard } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface PANVerificationProps {
  vendorId: string;
  value?: string;
  name?: string; // Optional name for matching
  onChange?: (value: string) => void;
  onVerified?: (data: PANVerificationData) => void;
  disabled?: boolean;
  label?: string;
  helpText?: string;
  required?: boolean;
  className?: string;
  autoVerify?: boolean; // Verify on blur
}

interface PANVerificationData {
  verified: boolean;
  panNumber: string;
  name: string;
  status: 'active' | 'inactive' | 'unknown';
  nameMatchScore?: number;
  category?: string;
}

type VerificationStatus = 'idle' | 'verifying' | 'verified' | 'failed' | 'error';

export function PANVerification({
  vendorId,
  value = '',
  name,
  onChange,
  onVerified,
  disabled = false,
  label = 'PAN Number',
  helpText = 'PAN will be verified automatically',
  required = true,
  className = '',
  autoVerify = true,
}: PANVerificationProps) {
  const [panNumber, setPanNumber] = useState(value.toUpperCase());
  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [verifiedData, setVerifiedData] = useState<PANVerificationData | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // PAN validation regex
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

  // Validate PAN format
  const isValidPAN = (pan: string): boolean => {
    return panRegex.test(pan);
  };

  // Format PAN input (uppercase)
  const formatPAN = (value: string): string => {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  };

  // Verify PAN
  const verifyPAN = useCallback(async (pan: string) => {
    if (!isValidPAN(pan)) {
      return;
    }

    setStatus('verifying');
    setError(null);

    try {
      const response = await apiClient.post<{
        success: boolean;
        verified: boolean;
        data?: {
          panNumber: string;
          name: string;
          status: 'active' | 'inactive' | 'unknown';
          nameMatchScore?: number;
          category?: string;
        };
        error?: string;
        message?: string;
      }>('/kyc/pan/verify', {
        panNumber: pan,
        name,
        vendorId,
      });

      if (response.success && response.verified && response.data) {
        const verificationData: PANVerificationData = {
          verified: true,
          panNumber: response.data.panNumber,
          name: response.data.name,
          status: response.data.status,
          nameMatchScore: response.data.nameMatchScore,
          category: response.data.category,
        };
        setVerifiedData(verificationData);
        setStatus('verified');
        onVerified?.(verificationData);
      } else if (response.data?.status === 'inactive') {
        setError('PAN is marked as inactive. Please contact your tax consultant.');
        setStatus('failed');
        setVerifiedData({
          verified: false,
          panNumber: pan,
          name: response.data?.name || '',
          status: 'inactive',
        });
      } else {
        setError(response.error || response.message || 'PAN verification failed');
        setStatus('failed');
      }
    } catch (err: any) {
      console.error('Error verifying PAN:', err);
      setError(err.message || 'Failed to verify PAN. Please try again.');
      setStatus('error');
    }
  }, [vendorId, name, onVerified]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPAN(e.target.value);
    setPanNumber(formatted);
    onChange?.(formatted);
    
    // Reset verification status when input changes
    if (status !== 'idle') {
      setStatus('idle');
      setError(null);
      setVerifiedData(null);
    }

    // Clear existing debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Auto-verify after user stops typing (if enabled and valid)
    if (autoVerify && isValidPAN(formatted)) {
      const timer = setTimeout(() => {
        verifyPAN(formatted);
      }, 800); // 800ms debounce
      setDebounceTimer(timer);
    }
  };

  // Handle blur - verify if not already verified
  const handleBlur = () => {
    if (autoVerify && isValidPAN(panNumber) && status === 'idle') {
      verifyPAN(panNumber);
    }
  };

  // Manual verify button click
  const handleVerify = () => {
    if (isValidPAN(panNumber)) {
      verifyPAN(panNumber);
    } else {
      setError('Please enter a valid PAN number (e.g., ABCDE1234F)');
    }
  };

  // Reset verification
  const handleReset = () => {
    setPanNumber('');
    setStatus('idle');
    setError(null);
    setVerifiedData(null);
    onChange?.('');
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  // Sync with external value changes
  useEffect(() => {
    if (value && value !== panNumber) {
      setPanNumber(value.toUpperCase());
    }
  }, [value]);

  // Get status icon
  const getStatusIcon = () => {
    switch (status) {
      case 'verifying':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'verified':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <CreditCard className="w-5 h-5 text-gray-400" />;
    }
  };

  // Get input border color based on status
  const getInputBorderClass = () => {
    switch (status) {
      case 'verified':
        return 'border-green-500 focus:border-green-500 focus:ring-green-200';
      case 'failed':
      case 'error':
        return 'border-red-500 focus:border-red-500 focus:ring-red-200';
      case 'verifying':
        return 'border-blue-500 focus:border-blue-500 focus:ring-blue-200';
      default:
        return 'border-gray-300 focus:border-[#FF8C42] focus:ring-[#FF8C42]/20';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Input with status */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={panNumber}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Enter PAN (e.g., ABCDE1234F)"
              disabled={disabled || status === 'verifying'}
              className={`w-full px-4 py-3 pr-12 text-lg tracking-wider uppercase border rounded-lg focus:ring-2 focus:outline-none disabled:bg-gray-100 ${getInputBorderClass()}`}
              maxLength={10}
              autoComplete="off"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {getStatusIcon()}
            </div>
          </div>

          {/* Manual verify button (when not auto-verifying) */}
          {!autoVerify && status !== 'verified' && (
            <button
              type="button"
              onClick={handleVerify}
              disabled={disabled || status === 'verifying' || !isValidPAN(panNumber)}
              className="px-4 py-3 bg-[#FF8C42] text-white font-medium rounded-lg hover:bg-[#E67A30] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {status === 'verifying' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Verify'
              )}
            </button>
          )}

          {/* Retry button on error */}
          {(status === 'failed' || status === 'error') && (
            <button
              type="button"
              onClick={handleVerify}
              disabled={disabled}
              className="px-4 py-3 text-[#FF8C42] border border-[#FF8C42] font-medium rounded-lg hover:bg-[#FF8C42]/10 flex items-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Verification status messages */}
      {status === 'verified' && verifiedData && (
        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">PAN Verified</p>
            <p className="text-sm text-green-600">
              Name: {verifiedData.name}
              {verifiedData.nameMatchScore !== undefined && verifiedData.nameMatchScore < 80 && (
                <span className="text-amber-600 ml-2">
                  (Name match: {verifiedData.nameMatchScore}%)
                </span>
              )}
            </p>
            {verifiedData.category && (
              <p className="text-xs text-green-500">Category: {verifiedData.category}</p>
            )}
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
      )}

      {status === 'verifying' && (
        <p className="text-sm text-blue-600 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Verifying PAN...
        </p>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Help text */}
      {!error && status === 'idle' && helpText && (
        <p className="text-sm text-gray-500">{helpText}</p>
      )}

      {/* Format hint */}
      {panNumber.length > 0 && !isValidPAN(panNumber) && status === 'idle' && (
        <p className="text-sm text-amber-600">
          PAN format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)
        </p>
      )}
    </div>
  );
}

export default PANVerification;
