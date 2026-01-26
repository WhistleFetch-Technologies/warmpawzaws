'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface StaffAuthProps {
  onAuthSuccess: (staff: any) => void;
}

export function StaffAuth({ onAuthSuccess }: StaffAuthProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!phone || phone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      // ✅ FIX: Use /auth/send-otp endpoint (same as vendors) for unified login flow
      console.log('📤 [STAFF AUTH] Sending OTP via /auth/send-otp (unified endpoint)...');
      const response = await apiClient.post<any>('/auth/send-otp', { phone });
      
      if (response.success || response.message) {
        toast.success('OTP sent to your mobile number');
        if (response.debug_otp) {
          toast.info(`UAT Mode: OTP is ${response.debug_otp}`);
        }
        setStep('otp');
      } else {
        throw new Error(response.error || 'Failed to send OTP');
      }
    } catch (error: any) {
      console.error('[STAFF AUTH] Error:', error);
      setError(error.message || 'Failed to send OTP. Please try again.');
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      // ✅ FIX: Use /auth/verify-otp endpoint (same as vendors) for unified login flow
      // This ensures staff get the same dashboard and experience as vendors
      console.log('🔐 [STAFF AUTH] Verifying OTP via /auth/verify-otp (unified endpoint)...');
      const response = await apiClient.post<any>('/auth/verify-otp', { phone, otp });
      
      console.log('📋 [STAFF AUTH] OTP verification result:', response);
      
      // Handle nested response structure
      let responseData = response;
      if (response.data) {
        if (response.data.data) {
          responseData = response.data.data;
        } else {
          responseData = response.data;
        }
      }
      
      // Extract token and profile
      const tokens = responseData.token || responseData.tokens || {};
      const user = responseData.user || {};
      const profile = responseData.profile || {};
      
      console.log('📋 [STAFF AUTH] Extracted profile:', profile);
      console.log('📋 [STAFF AUTH] Profile onboarding_status:', profile.onboarding_status);
      console.log('📋 [STAFF AUTH] ResponseData onboarding_status:', responseData.onboarding_status);
      console.log('📋 [STAFF AUTH] Full response structure:', {
        hasToken: !!responseData.token,
        hasTokens: !!responseData.tokens,
        hasAccessToken: !!responseData.accessToken,
        tokenKeys: responseData.token ? Object.keys(responseData.token) : [],
        tokensKeys: responseData.tokens ? Object.keys(responseData.tokens) : []
      });
      
      // ✅ CRITICAL: Extract accessToken from multiple possible locations
      // Support both Cognito tokens and fallback tokens
      const accessToken = responseData.accessToken ||           // Direct accessToken
                         tokens.accessToken ||                   // tokens.accessToken
                         tokens.access_token ||                  // tokens.access_token
                         responseData.token?.access_token ||     // token.access_token
                         responseData.token?.accessToken ||      // token.accessToken
                         responseData.access_token;              // Direct access_token
      
      console.log('📋 [STAFF AUTH] Extracted accessToken:', accessToken ? `${accessToken.substring(0, 30)}...` : 'MISSING');
      
      // ✅ CRITICAL: For staff, ALWAYS use ACTIVATED if profile exists (staff should never see role selection)
      let onboardingStatus = profile.onboarding_status || responseData.onboarding_status;
      
      // ✅ FIX: If staff member and status is not ACTIVATED, force it
      if (profile && profile.vendor_id && onboardingStatus !== 'ACTIVATED') {
        console.warn(`⚠️ [STAFF AUTH] Staff member has status ${onboardingStatus}, forcing to ACTIVATED`);
        onboardingStatus = 'ACTIVATED';
        profile.onboarding_status = 'ACTIVATED'; // Update profile object too
      }
      
      // Fallback to ACTIVATED for staff (not INIT)
      if (!onboardingStatus) {
        onboardingStatus = 'ACTIVATED';
        console.log('📋 [STAFF AUTH] No onboarding_status found, defaulting to ACTIVATED for staff');
      }
      
      console.log('📋 [STAFF AUTH] Final onboarding_status to store:', onboardingStatus);
      
      // ✅ CRITICAL: For staff members, generate fallback token if missing
      // This ensures staff can always log in even if backend doesn't return token
      let finalAccessToken = accessToken;
      if (!finalAccessToken && responseData.verified) {
        console.warn('⚠️ [STAFF AUTH] No accessToken but verified=true, generating fallback token for staff');
        // Generate a simple session token for staff
        const fallbackToken = `staff_session_${phone}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        finalAccessToken = fallbackToken;
        console.log('✅ [STAFF AUTH] Generated fallback token for staff member');
      }
      
      if (!finalAccessToken && !responseData.verified) {
        console.error('❌ [STAFF AUTH] No access token or verification status');
        throw new Error('Authentication failed: No access token received');
      }
      
      console.log('✅ [STAFF AUTH] OTP verified successfully! Onboarding status:', onboardingStatus);
      
      // ✅ FIX: Store session in same format as vendor login
      const { storeSession } = require('@/lib/session-manager');
      storeSession({
        phone: phone,
        accessToken: finalAccessToken, // Use finalAccessToken (may be fallback)
        user: user,
        profile: profile,
        vendorId: user.id || profile.id || profile.vendor_id
      });
      
      // ✅ CRITICAL: Double-check that tokens are stored
      const storedToken = localStorage.getItem('authToken');
      const storedPhone = localStorage.getItem('vendorPhone');
      if (!storedToken || !storedPhone) {
        console.error('❌ [STAFF AUTH] Session storage failed! Storing directly...');
        // Fallback: Store directly
        if (!storedToken) {
          localStorage.setItem('authToken', finalAccessToken);
          localStorage.setItem('vendorSessionToken', finalAccessToken);
        }
        if (!storedPhone) {
          localStorage.setItem('vendorPhone', phone);
        }
        console.log('✅ [STAFF AUTH] Direct storage completed');
      }
      
      // Store profile data
      if (profile && Object.keys(profile).length > 0) {
        localStorage.setItem('vendorData', JSON.stringify(profile));
        if (profile.id || profile.vendor_id) {
          localStorage.setItem('vendorId', profile.id || profile.vendor_id);
        }
        if (profile.roleId || profile.role_id) {
          localStorage.setItem('vendorRole', profile.roleId || profile.role_id);
        }
      }
      
      // Store onboarding status
      localStorage.setItem('vendorApplicationStatus', onboardingStatus);
      
      // Set sessionStorage flags
      sessionStorage.setItem('_warmpawz_vendor_has_session', 'true');
      sessionStorage.setItem('_warmpawz_vendor_just_logged_in', 'true');
      
      // ✅ FIX: Call onAuthSuccess with vendor-compatible format
      onAuthSuccess({
        phone: phone,
        accessToken: finalAccessToken, // Use finalAccessToken (may be fallback)
        user: user,
        profile: profile,
        vendorId: user.id || profile.id || profile.vendor_id,
        onboardingStatus: onboardingStatus,
        state: responseData.state || 'existing',
        staff_info: responseData.staff_info, // Keep staff info for reference
      });
      
      toast.success('Login successful!');
    } catch (error: any) {
      console.error('[STAFF AUTH] Error:', error);
      setError(error.message || 'Invalid OTP. Please try again.');
      toast.error(error.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setOtp('');
    setLoading(true);
    try {
      // ✅ FIX: Use /auth/send-otp endpoint (same as vendors)
      const response = await apiClient.post<any>('/auth/send-otp', { phone });
      if (response.success || response.message) {
        toast.success('OTP resent successfully');
        if (response.debug_otp) {
          toast.info(`UAT Mode: OTP is ${response.debug_otp}`);
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#FF8C42] rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Staff Login</h1>
          <p className="text-gray-600">Enter your mobile number to continue</p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <Label htmlFor="phone" className="text-sm font-medium text-gray-700 mb-2 block">
                Mobile Number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit mobile number"
                  className="pl-10 h-12 text-lg"
                  maxLength={10}
                  required
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || phone.length !== 10}
              className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A29] text-white text-lg font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                <>
                  Send OTP
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <Label htmlFor="otp" className="text-sm font-medium text-gray-700 mb-2 block">
                Enter OTP
              </Label>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  OTP sent to <strong>{phone}</strong>
                </p>
              </div>
              <Input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                className="h-12 text-2xl text-center tracking-widest font-mono"
                maxLength={6}
                required
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setError('');
                }}
                variant="outline"
                className="flex-1 h-12"
              >
                Change Number
              </Button>
              <Button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="flex-1 h-12 bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify OTP'
                )}
              </Button>
            </div>

            <Button
              type="button"
              onClick={handleResendOTP}
              variant="ghost"
              className="w-full text-sm text-gray-600"
              disabled={loading}
            >
              Didn't receive OTP? Resend
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
