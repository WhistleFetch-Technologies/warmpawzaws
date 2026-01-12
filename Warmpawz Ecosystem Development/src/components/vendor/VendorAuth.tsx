import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { supabase } from '../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import logoImage from 'figma:asset/da6636b92da744b3db8eed5288ca6da9ab889afe.png';
import { storeSession } from '../../utils/session-manager'; // ✅ SECURITY FIX

interface VendorAuthProps {
  onAuthSuccess: (session: any) => void;
}

export function VendorAuth({ onAuthSuccess }: VendorAuthProps) {
  const [isSignUp, setIsSignUp] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    businessName: '',
    ownerName: '',
    phone: '',
    services: [] as string[],
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    pan: '',
    aadhar: '',
    bankAccount: '',
    ifsc: '',
    agreedToTerms: false
  });

  const serviceOptions = [
    'Pet Walking',
    'Grooming at Home',
    'Grooming Centre',
    'Vet Services at Home',
    'Vet Clinic',
    'Tele Consultation',
    'Pet Training',
    'Pet Food Delivery',
    'Medicine Delivery',
    'Pet Cafe',
    'Pet Insurance',
    'Mating Services'
  ];

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/profile`,
        {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.vendor.status === 'pending') {
          setPendingApproval(true);
          setLoading(false);
          return;
        } else if (result.vendor.status === 'rejected') {
          setError('Your vendor account has been rejected. Please contact support.');
          setLoading(false);
          return;
        }
      }

      onAuthSuccess(data.session);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      console.error('Sign in error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    setFormData({ ...formData, phone: phoneNumber });
    setShowOtpScreen(true);
    console.log('Sending OTP to:', phoneNumber);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    console.log('🔐 [VendorAuth] Verifying OTP:', otpCode);
    console.log('🔐 [VendorAuth] Phone number:', phoneNumber);
    
    // Helper to safely parse JSON response
    const safeFetch = async (url: string, options: any) => {
      const response = await fetch(url, options);
      const text = await response.text();
      
      console.log(`📡 [VendorAuth] Response from ${url}:`, response.status, response.statusText);
      
      try {
        // Try to parse as JSON
        return { 
          ok: response.ok, 
          status: response.status, 
          data: JSON.parse(text),
          raw: text 
        };
      } catch (err) {
        console.error(`❌ [VendorAuth] JSON Parse Error for ${url}:`, err);
        console.error(`   Raw body (${text.length} chars):`, text.substring(0, 200));
        throw new Error(`Server returned invalid JSON: ${text.substring(0, 50)}...`);
      }
    };

    // FIRST: Check if this phone belongs to a staff member
    console.log('🔍 [VendorAuth] Step 1: Checking if phone belongs to staff...');
    
    safeFetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/auth/check-phone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({ phone: phoneNumber })
    })
    .then(({ ok, status, data: staffCheckData }) => {
      if (!ok && status !== 404) {
        throw new Error(staffCheckData.error || `Staff check failed with status ${status}`);
      }
      
      console.log('📋 [VendorAuth] Staff check result:', staffCheckData);
      
      // If this is a staff member, log them in as staff
      if (staffCheckData && staffCheckData.exists && staffCheckData.staff) {
        console.log('✅ [VendorAuth] Staff member detected!');
        console.log('🔐 [VendorAuth] Step 2: Logging in as staff...');
        
        // Call staff login endpoint
        return safeFetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ phone: phoneNumber })
        })
        .then(({ ok, data }) => {
          if (ok && data.success && data.staff) {
            console.log('✅ [VendorAuth] Staff login successful!');
            onAuthSuccess({
              phone: phoneNumber,
              user: { isStaff: true },
              staff: data.staff,
              isStaffLogin: true
            });
          } else {
            throw new Error(data.error || 'Staff login failed');
          }
        });
      }
      
      // Not a staff member, proceed with regular vendor login
      console.log('📞 [VendorAuth] Not a staff member, proceeding with vendor login...');
      return safeFetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          phone: phoneNumber,
          portal: 'vendor'
        })
      })
      .then(({ ok, data }) => {
        if (ok && data.success && data.session) {
          console.log('✅ [VendorAuth] Vendor login successful!');
          
          // ✅ SECURITY FIX: Store session with access token
          storeSession({
            phone: phoneNumber,
            accessToken: data.session.accessToken,
            user: data.user,
            profile: data.profile,
            vendorId: data.profile?.id || data.profile?.vendorId
          });
          console.log('🔐 [VendorAuth] Session stored with access token');
          
          onAuthSuccess({
            ...data.session,
            user: data.user,
            profile: data.profile,
            state: data.state
          });
        } else {
          throw new Error(data.error || 'Login failed');
        }
      });
    })
    .catch(error => {
      console.error('❌ [VendorAuth] Login error:', error);
      setError(error.message || 'Network error. Please try again.');
      setLoading(false);
    });
  };
  
  // DEBUG: Test button to check database
  const handleDebugCheck = () => {
    console.log('🔍 DEBUG: Checking ALL vendor data...');
    fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/auth/diagnostic/all-vendors`, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`
      }
    })
    .then(response => {
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      return response.json();
    })
    .then(data => {
      console.log('📊 ========== RAW RESPONSE ==========');
      console.log('Full data:', JSON.stringify(data, null, 2));
      console.log('========================================');
      
      if (data.error) {
        console.error('Error from server:', data.error);
        alert(`Server Error: ${data.error}\n\nCheck console for full details.`);
        return;
      }
      
      if (!data || !data.data) {
        console.error('No data property in response:', data);
        alert('ERROR: Server returned invalid response structure.\n\nCheck console for full details.');
        return;
      }
      
      const { users, vendorProfiles, vendorVendors, applications } = data.data;
      
      console.log('📊 ========== ALL VENDOR DATA ==========');
      console.log('USERS:', users);
      console.log('VENDOR PROFILES:', vendorProfiles);
      console.log('VENDOR VENDORS:', vendorVendors);
      console.log('APPLICATIONS:', applications);
      console.log('========================================');
      
      alert(`Found:\n${users?.length || 0} users\n${vendorProfiles?.length || 0} vendor:profile entries\n${vendorVendors?.length || 0} vendor:vendor_ entries\n${applications?.length || 0} applications\n\nCheck console for details!`);
    })
    .catch(error => {
      console.error('❌ Debug error:', error);
      console.error('Error stack:', error.stack);
      alert(`Network Error: ${error.message}\n\nCheck console for full details.`);
    });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.agreedToTerms) {
      setError('Please agree to the terms and conditions');
      return;
    }

    setLoading(true);
    setError('');
  };

  const toggleService = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

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
          <Button
            onClick={() => {
              setPendingApproval(false);
              setIsSignUp(false);
            }}
            className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
          >
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  // OTP VERIFICATION SCREEN - PIXEL PERFECT
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
            <img src={logoImage} alt="Warmpawz" className="w-full h-full object-contain" />
          </div>

          <h1 className="text-2xl text-gray-900 mb-2 text-center">
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
                className="text-center text-2xl tracking-widest h-14 border-gray-300 focus:border-[#FF8C42] focus:ring-[#FF8C42]"
                placeholder="••••••"
                required
                autoFocus
              />
            </div>

            <Button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A29] text-white h-14 rounded-xl text-base disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </Button>

            <button
              type="button"
              onClick={handleSendCode}
              disabled={loading}
              className="w-full mt-4 text-[#FF8C42] hover:text-[#FF7A29] text-sm disabled:opacity-50"
            >
              Resend code
            </button>
          </form>
        </div>
      </div>
    );
  }

  // PHONE NUMBER ENTRY SCREEN
  if (isSignUp && currentStep === 1 && !showOtpScreen) {
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
            <img src={logoImage} alt="Warmpawz" className="w-full h-full object-contain" />
          </div>

          <h1 className="text-3xl text-gray-900 mb-2 text-center">
            Warmpawz Provider
          </h1>
          <p className="text-gray-600 text-center mb-10">
            Professional pet care services platform
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
                  className="flex-1 h-12 border-gray-300 focus:border-[#FF8C42] focus:ring-[#FF8C42]"
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
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A29] text-white h-14 rounded-xl text-base disabled:opacity-50"
            >
              {loading ? 'Sending code...' : 'Continue'}
            </Button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-10 max-w-xs">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    );
  }

  if (!isSignUp) {
    // Sign In Screen
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center mb-4">
                <img 
                  src={logoImage} 
                  alt="WarmPawz Logo" 
                  className="w-24 h-24 object-contain"
                />
              </div>
              <h1 className="text-3xl text-[#FF8C42] mb-2">WarmPawz</h1>
              <p className="text-gray-600">Vendor Portal</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white h-11"
              >
                {loading ? 'Please wait...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setError('');
                  setCurrentStep(1);
                }}
                className="text-[#FF8C42] hover:underline"
              >
                New vendor? Register here
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Multi-step Registration Form (Steps 2+)
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            {currentStep > 2 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1">
              <h2 className="text-2xl text-[#FF8C42]">Vendor Registration</h2>
              <p className="text-sm text-gray-600">Step {currentStep - 1} of 4</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`flex-1 h-2 rounded-full ${
                  step <= currentStep - 1 ? 'bg-[#FF8C42]' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignUp}>
            {/* Step 2: Basic Info */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg mb-4">Basic Information</h3>
                
                <div>
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input
                    id="businessName"
                    placeholder="Enter business name"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="ownerName">Owner Name *</Label>
                  <Input
                    id="ownerName"
                    placeholder="Enter owner name"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Services */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg mb-4">Select Services You Offer *</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {serviceOptions.map((service) => (
                    <div
                      key={service}
                      onClick={() => toggleService(service)}
                      className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.services.includes(service)
                          ? 'border-[#FF8C42] bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          formData.services.includes(service)
                            ? 'bg-[#FF8C42] border-[#FF8C42]'
                            : 'border-gray-300'
                        }`}>
                          {formData.services.includes(service) && (
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <span className="text-sm">{service}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Address */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg mb-4">Business Address</h3>
                
                <div>
                  <Label htmlFor="address">Street Address *</Label>
                  <Input
                    id="address"
                    placeholder="Enter street address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      placeholder="City"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      placeholder="State"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      required
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input
                    id="pincode"
                    placeholder="Enter pincode"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* Step 5: Documents */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <h3 className="text-lg mb-4">Business Documents</h3>
                
                <div>
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input
                    id="gstin"
                    placeholder="Enter GSTIN"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="pan">PAN Card *</Label>
                  <Input
                    id="pan"
                    placeholder="Enter PAN number"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="aadhar">Aadhar Number *</Label>
                  <Input
                    id="aadhar"
                    placeholder="Enter Aadhar number"
                    value={formData.aadhar}
                    onChange={(e) => setFormData({ ...formData, aadhar: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="bankAccount">Bank Account Number *</Label>
                  <Input
                    id="bankAccount"
                    placeholder="Enter account number"
                    value={formData.bankAccount}
                    onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="ifsc">IFSC Code *</Label>
                  <Input
                    id="ifsc"
                    placeholder="Enter IFSC code"
                    value={formData.ifsc}
                    onChange={(e) => setFormData({ ...formData, ifsc: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div className="flex items-start gap-2 pt-4">
                  <Checkbox
                    id="terms"
                    checked={formData.agreedToTerms}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, agreedToTerms: checked as boolean })
                    }
                  />
                  <Label htmlFor="terms" className="text-sm leading-tight cursor-pointer">
                    I agree to the terms and conditions and confirm that all information provided is accurate
                  </Label>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-4 mt-8">
              {currentStep < 5 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (currentStep === 2) {
                        setIsSignUp(false);
                        setCurrentStep(1);
                      } else {
                        setCurrentStep(currentStep - 1);
                      }
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
                  >
                    Next
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || !formData.agreedToTerms}
                    className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
                  >
                    {loading ? 'Submitting...' : 'Submit Application'}
                  </Button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}