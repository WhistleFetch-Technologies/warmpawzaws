'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertCircle, Loader2, RefreshCw, Building2, MapPin } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  formatGSTIN,
  isValidGSTIN,
  type GSTVerificationData,
} from '@/lib/gstin';

export type { GSTVerificationData };

interface GSTVerificationProps {
  vendorId: string;
  value?: string;
  onChange?: (value: string) => void;
  onVerified?: (data: GSTVerificationData) => void;
  disabled?: boolean;
  label?: string;
  helpText?: string;
  required?: boolean;
  conditional?: boolean; // If true, field is optional based on turnover
  className?: string;
  autoVerify?: boolean; // Verify on blur
  /** Pre-filled verified state when loading an already-verified GSTIN from profile/KYC */
  initialVerifiedData?: GSTVerificationData | null;
}

type VerificationStatus = 'idle' | 'verifying' | 'verified' | 'failed' | 'error';

export function GSTVerification({
  vendorId,
  value = '',
  onChange,
  onVerified,
  disabled = false,
  label = 'GST Number',
  helpText = 'GST will be verified automatically',
  required = false,
  conditional = true,
  className = '',
  autoVerify = true,
  initialVerifiedData = null,
}: GSTVerificationProps) {
  const [gstin, setGstin] = useState(value.toUpperCase());
  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [verifiedData, setVerifiedData] = useState<GSTVerificationData | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Verify GST
  const verifyGST = useCallback(async (gst: string) => {
    if (!isValidGSTIN(gst)) {
      return;
    }

    setStatus('verifying');
    setError(null);

    try {
      const response = await apiClient.post<{
        success: boolean;
        verified: boolean;
        data?: {
          gstin: string;
          legalName: string;
          tradeName?: string;
          status: 'Active' | 'Cancelled' | 'Suspended' | 'unknown';
          stateCode: string;
          stateName: string;
          registrationDate?: string;
          businessType?: string;
          address?: string;
        };
        error?: string;
        message?: string;
      }>('/kyc/gst/verify', {
        gstin: gst,
        vendorId,
      });

      if (response.success && response.verified && response.data) {
        const verificationData: GSTVerificationData = {
          verified: true,
          gstin: response.data.gstin,
          legalName: response.data.legalName,
          tradeName: response.data.tradeName,
          status: response.data.status,
          stateCode: response.data.stateCode,
          stateName: response.data.stateName,
          registrationDate: response.data.registrationDate,
          businessType: response.data.businessType,
          address: response.data.address,
        };
        setVerifiedData(verificationData);
        setStatus('verified');
        onVerified?.(verificationData);
      } else if (response.data?.status === 'Cancelled' || response.data?.status === 'Suspended') {
        setError(`GST registration is ${response.data.status}. Please update your GST status.`);
        setStatus('failed');
        setVerifiedData({
          verified: false,
          gstin: gst,
          legalName: response.data?.legalName || '',
          status: response.data.status,
          stateCode: response.data?.stateCode || '',
          stateName: response.data?.stateName || '',
        });
      } else {
        setError(response.error || response.message || 'GST verification failed');
        setStatus('failed');
      }
    } catch (err: any) {
      console.error('Error verifying GST:', err);
      setError(err.message || 'Failed to verify GST. Please try again.');
      setStatus('error');
    }
  }, [vendorId, onVerified]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatGSTIN(e.target.value);
    setGstin(formatted);
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
    if (autoVerify && isValidGSTIN(formatted)) {
      const timer = setTimeout(() => {
        verifyGST(formatted);
      }, 800); // 800ms debounce
      setDebounceTimer(timer);
    }
  };

  // Handle blur - verify if not already verified
  const handleBlur = () => {
    if (autoVerify && isValidGSTIN(gstin) && status === 'idle') {
      verifyGST(gstin);
    }
  };

  // Manual verify button click
  const handleVerify = () => {
    if (isValidGSTIN(gstin)) {
      verifyGST(gstin);
    } else {
      setError('Please enter a valid 15-character GSTIN');
    }
  };

  // Reset verification
  const handleReset = () => {
    setGstin('');
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
    if (value && value !== gstin) {
      setGstin(value.toUpperCase());
    }
  }, [value]);

  // Apply pre-filled verified state from profile/KYC load (once per load, not on user edits)
  useEffect(() => {
    if (!initialVerifiedData?.verified || !initialVerifiedData.gstin) return;
    setGstin(initialVerifiedData.gstin);
    setVerifiedData(initialVerifiedData);
    setStatus('verified');
    setError(null);
  }, [initialVerifiedData]);

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
        return <Building2 className="w-5 h-5 text-gray-400" />;
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

  // Get state name from state code
  const getStateFromGSTIN = (gst: string): string => {
    if (gst.length < 2) return '';
    const stateCode = gst.substring(0, 2);
    const stateMap: Record<string, string> = {
      '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
      '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
      '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
      '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
      '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
      '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
      '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
      '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
      '26': 'Dadra and Nagar Haveli', '27': 'Maharashtra', '29': 'Karnataka',
      '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
      '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar',
      '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
    };
    return stateMap[stateCode] || '';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
        {conditional && !required && (
          <span className="text-gray-400 text-xs ml-2">(if applicable)</span>
        )}
      </label>

      {/* Input with status */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={gstin}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Enter 15-character GSTIN"
              disabled={disabled || status === 'verifying'}
              className={`w-full px-4 py-3 pr-12 text-lg tracking-wider uppercase border rounded-lg focus:ring-2 focus:outline-none disabled:bg-gray-100 ${getInputBorderClass()}`}
              maxLength={15}
              autoComplete="off"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {getStatusIcon()}
            </div>
          </div>

          {/* Manual verify button (when not auto-verifying) */}
          {!autoVerify && status !== 'verified' && gstin.length > 0 && (
            <button
              type="button"
              onClick={handleVerify}
              disabled={disabled || status === 'verifying' || !isValidGSTIN(gstin)}
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

      {/* State indicator while typing */}
      {gstin.length >= 2 && status === 'idle' && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <MapPin className="w-4 h-4" />
          <span>State: {getStateFromGSTIN(gstin) || 'Invalid state code'}</span>
        </div>
      )}

      {/* Verification status messages */}
      {status === 'verified' && verifiedData && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">GST Verified - {verifiedData.status}</p>
              <p className="text-sm text-green-700 font-medium">{verifiedData.legalName}</p>
              {verifiedData.tradeName && verifiedData.tradeName !== verifiedData.legalName && (
                <p className="text-sm text-green-600">Trade Name: {verifiedData.tradeName}</p>
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
          
          <div className="grid grid-cols-2 gap-2 text-xs text-green-600 pt-2 border-t border-green-200">
            <div>
              <span className="text-green-500">State:</span> {verifiedData.stateName}
            </div>
            {verifiedData.businessType && (
              <div>
                <span className="text-green-500">Type:</span> {verifiedData.businessType}
              </div>
            )}
            {verifiedData.registrationDate && (
              <div>
                <span className="text-green-500">Registered:</span> {verifiedData.registrationDate}
              </div>
            )}
          </div>
          
          {verifiedData.address && (
            <p className="text-xs text-green-500 pt-2 border-t border-green-200">
              <span className="font-medium">Address:</span> {verifiedData.address}
            </p>
          )}
        </div>
      )}

      {status === 'verifying' && (
        <p className="text-sm text-blue-600 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Verifying GST...
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
      {gstin.length > 0 && !isValidGSTIN(gstin) && status === 'idle' && (
        <p className="text-sm text-amber-600">
          GSTIN format: 2 digits (state) + 10 char PAN + 1 entity + Z + 1 check digit
        </p>
      )}

      {/* Conditional field note */}
      {conditional && !required && !gstin && status === 'idle' && (
        <p className="text-xs text-gray-400">
          GST registration is required if your annual turnover exceeds the threshold or you are already registered.
        </p>
      )}
    </div>
  );
}

export default GSTVerification;
