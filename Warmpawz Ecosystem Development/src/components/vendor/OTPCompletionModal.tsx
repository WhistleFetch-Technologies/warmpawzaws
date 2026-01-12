import { useState } from 'react';
import { Button } from '../ui/button';
import { X, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { authenticatedFetch } from '../../utils/session-manager'; // ✅ SECURITY FIX

interface OTPCompletionModalProps {
  bookingId: string;
  occurrenceId?: string;
  sessionNumber?: number;
  staffId?: string;
  mode?: 'start' | 'complete'; // Mode determines which OTP to enter
  requiresStartOTP?: boolean; // Whether this service requires START OTP
  onClose: () => void;
  onSuccess: () => void;
}

export function OTPCompletionModal({
  bookingId,
  occurrenceId,
  sessionNumber,
  staffId,
  mode = 'complete',
  requiresStartOTP = false,
  onClose,
  onSuccess
}: OTPCompletionModalProps) {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleOTPChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value[0];
    }

    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 4);
    
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = pastedData.split('').concat(['', '', '', '']).slice(0, 4);
    setOtp(newOtp);

    // Focus the last filled input
    const lastIndex = Math.min(pastedData.length, 3);
    const lastInput = document.getElementById(`otp-${lastIndex}`);
    lastInput?.focus();
  };

  const handleComplete = async () => {
    const otpValue = otp.join('');
    
    if (otpValue.length !== 4) {
      setError('Please enter a 4-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Determine the endpoint based on mode
      let endpoint: string;
      
      if (mode === 'start') {
        endpoint = occurrenceId
          ? `/booking/${bookingId}/occurrence/${occurrenceId}/start`
          : `/booking/${bookingId}/start`;
      } else {
        endpoint = occurrenceId
          ? `/booking/${bookingId}/occurrence/${occurrenceId}/complete`
          : `/booking/${bookingId}/complete`;
      }

      const response = await authenticatedFetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475${endpoint}`,
        {
          method: 'POST',
          body: JSON.stringify({
            otp: otpValue,
            staffId
          })
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setError(result.error || 'Invalid OTP. Please try again.');
        setOtp(['', '', '', '']);
        document.getElementById('otp-0')?.focus();
      }
    } catch (error) {
      console.error(`Error ${mode === 'start' ? 'starting' : 'completing'} booking:`, error);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center">
          <div className={`w-16 h-16 ${mode === 'start' ? 'bg-blue-100' : 'bg-green-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <CheckCircle className={`w-10 h-10 ${mode === 'start' ? 'text-blue-600' : 'text-green-600'}`} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {mode === 'start' ? 'Service Started!' : 'Service Completed!'}
          </h2>
          <p className="text-gray-600">
            {mode === 'start' ? (
              occurrenceId && sessionNumber
                ? `Session ${sessionNumber} has started. Complete when done.`
                : 'Service has started. Complete when done.'
            ) : (
              occurrenceId && sessionNumber
                ? `Session ${sessionNumber} has been marked as completed.`
                : 'The booking has been marked as completed.'
            )}
          </p>
          {mode === 'complete' && (
            <p className="text-sm text-gray-500 mt-2">
              Earnings have been updated in your dashboard.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">
            {mode === 'start' ? (
              occurrenceId && sessionNumber
                ? `Start Session ${sessionNumber}`
                : 'Start Service'
            ) : (
              occurrenceId && sessionNumber
                ? `Complete Session ${sessionNumber}`
                : 'Complete Service'
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 mb-6 text-center">
            {mode === 'start'
              ? 'Ask the customer for their START OTP to begin the service'
              : 'Ask the customer for their COMPLETION OTP to finish the service'}
          </p>

          {/* OTP Input */}
          <div className="flex gap-3 justify-center mb-6">
            {otp.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOTPChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className={`w-14 h-14 text-center text-2xl font-bold border-2 ${
                  mode === 'start' ? 'border-green-300 focus:border-green-500' : 'border-orange-300 focus:border-[#FF8C42]'
                } rounded-lg focus:outline-none transition-colors`}
                autoFocus={index === 0}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Info */}
          <div className={`mb-6 p-4 ${mode === 'start' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'} border rounded-lg`}>
            <p className={`text-sm ${mode === 'start' ? 'text-green-900' : 'text-blue-900'}`}>
              <strong>Note:</strong> Customer can find their {mode === 'start' ? 'START' : 'COMPLETION'} OTP in \"My Bookings\" section of their profile.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={otp.join('').length !== 4 || loading}
              className={`flex-1 text-white ${
                mode === 'start' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-[#FF8C42] hover:bg-[#FF7029]'
              }`}
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                mode === 'start' ? 'Start Service' : 'Complete Service'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}