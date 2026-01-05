'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

// UAT Mode Configuration - DEV ONLY
const UAT_MODE = process.env.NEXT_PUBLIC_UAT_MODE === 'true' || process.env.NODE_ENV === 'development';
const UAT_OTP = '123456'; // Static OTP for UAT testing

// ============================================================================
// TYPES
// ============================================================================

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon: string;
  capabilities: string[];
  service_styles: string[];
  form_fields?: FormField[];
}

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'file' | 'checkbox' | 'number';
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  accept?: string;
  validation?: string;
}

interface OnboardingState {
  step: 'phone' | 'otp' | 'role' | 'business_type' | 'form' | 'documents' | 'review' | 'submitted' | 'approved' | 'rejected' | 'clarification';
  phone: string;
  otpVerified: boolean;
  selectedRole: Role | null;
  businessType: 'solo' | 'business' | null;
  formData: Record<string, any>;
  documents: Record<string, File | null>;
  applicationId: string | null;
  vendorId: string | null;
  adminComment: string | null;
  rejectionReason: string | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VendorOnboardingFlow() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const [state, setState] = useState<OnboardingState>({
    step: 'phone',
    phone: '',
    otpVerified: false,
    selectedRole: null,
    businessType: null,
    formData: {},
    documents: {},
    applicationId: null,
    vendorId: null,
    adminComment: null,
    rejectionReason: null,
  });

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Check for existing application on mount
  useEffect(() => {
    const savedPhone = localStorage.getItem('onboarding_phone');
    if (savedPhone) {
      checkExistingApplication(savedPhone);
    }
  }, []);

  // Load roles when reaching role selection step
  useEffect(() => {
    if (state.step === 'role' && roles.length === 0) {
      loadRoles();
    }
  }, [state.step, roles.length]);

  // Resend OTP timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // ============================================================================
  // API CALLS
  // ============================================================================

  const loadRoles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ roles: Role[] }>('/config/roles');
      if (response.roles) {
        setRoles(response.roles);
      }
    } catch (err: any) {
      console.error('Error loading roles:', err);
      setError('Failed to load roles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkExistingApplication = async (phone: string) => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/check-phone/${phone}`);
      
      if (response.exists) {
        setState(prev => ({
          ...prev,
          phone,
          vendorId: response.vendorId,
          applicationId: response.applicationId,
        }));

        // Route to appropriate step based on status
        switch (response.status) {
          case 'pending':
            setState(prev => ({ ...prev, step: 'submitted' }));
            break;
          case 'approved':
            setState(prev => ({ ...prev, step: 'approved' }));
            break;
          case 'rejected':
            setState(prev => ({
              ...prev,
              step: 'rejected',
              rejectionReason: response.rejectionReason,
            }));
            break;
          case 'clarification_requested':
            setState(prev => ({
              ...prev,
              step: 'clarification',
              adminComment: response.adminComment,
            }));
            break;
          default:
            // Resume from where they left off
            if (response.onboardingProgress < 100) {
              resumeOnboarding(response);
            }
        }
      }
    } catch (err) {
      // No existing application, continue with new onboarding
      console.log('No existing application found');
    } finally {
      setLoading(false);
    }
  };

  const resumeOnboarding = (data: any) => {
    // Restore state from saved data
    if (data.roleId) {
      const role = roles.find(r => r.id === data.roleId);
      if (role) {
        setState(prev => ({
          ...prev,
          selectedRole: role,
          businessType: data.businessType,
          formData: data.formData || {},
          step: data.onboardingProgress < 50 ? 'role' : 'form',
        }));
      }
    }
  };

  const sendOtp = async () => {
    if (!state.phone || state.phone.length < 10) {
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
        localStorage.setItem('onboarding_phone', state.phone);
        return;
      }

      await apiClient.post('/auth/otp/send', { phone: state.phone });
      setOtpSent(true);
      setResendTimer(60);
      localStorage.setItem('onboarding_phone', state.phone);
    } catch (err: any) {
      // UAT Fallback: If API fails, allow UAT mode
      if (UAT_MODE) {
        console.log('🔧 [UAT Fallback] API failed, using static OTP:', UAT_OTP);
        setOtpSent(true);
        setResendTimer(60);
        localStorage.setItem('onboarding_phone', state.phone);
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
        localStorage.setItem('vendorAuthToken', 'uat-token-vendor-' + Date.now());
        setState(prev => ({
          ...prev,
          otpVerified: true,
          step: 'role',
        }));
        return;
      }

      // UAT Mode: Wrong OTP
      if (UAT_MODE && otp !== UAT_OTP) {
        setError(`Invalid OTP. For UAT testing, use: ${UAT_OTP}`);
        return;
      }

      const response = await apiClient.post<any>('/auth/otp/verify', {
        phone: state.phone,
        otp,
      });

      if (response.success || response.verified) {
        if (response.accessToken) {
          localStorage.setItem('vendorAuthToken', response.accessToken);
        }
        setState(prev => ({
          ...prev,
          otpVerified: true,
          step: 'role',
        }));
        await checkExistingApplication(state.phone);
      } else {
        setError('Invalid OTP. Please try again.');
      }
    } catch (err: any) {
      // UAT Fallback: If API fails but OTP matches, allow login
      if (UAT_MODE && otp === UAT_OTP) {
        console.log('🔧 [UAT Fallback] API failed, using static OTP verification');
        localStorage.setItem('vendorAuthToken', 'uat-token-vendor-' + Date.now());
        setState(prev => ({
          ...prev,
          otpVerified: true,
          step: 'role',
        }));
        return;
      }
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const submitApplication = async () => {
    try {
      setLoading(true);
      setError(null);

      // Upload documents via presigned URLs
      const uploadedDocs: Record<string, string> = {};
      for (const [key, file] of Object.entries(state.documents)) {
        if (!file) continue;

        // Request presigned URL from backend
        const presign = await apiClient.post<{ presignedUrl: string; publicUrl: string }>('/upload/presigned-url', {
          fileName: file.name,
          fileType: file.type,
          folder: 'vendor-documents',
        });

        // PUT the file to S3 using the presigned URL
        const putResp = await fetch(presign.presignedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!putResp.ok) {
          throw new Error(`Failed to upload ${key}`);
        }

        uploadedDocs[key] = presign.publicUrl;
      }

      // Submit application
      const response = await apiClient.post<any>('/vendor/apply', {
        roleId: state.selectedRole?.id,
        phone: state.phone,
        email: state.formData.email,
        serviceStyle: state.selectedRole?.service_styles?.[0],
        businessType: state.businessType,
        formData: state.formData,
        documents: uploadedDocs,
        location: {
          address: state.formData.address,
          city: state.formData.city,
          state: state.formData.state,
          pincode: state.formData.pincode,
          latitude: state.formData.latitude,
          longitude: state.formData.longitude,
        },
      });

      if (response.vendorId || response.applicationId) {
        setState(prev => ({
          ...prev,
          vendorId: response.vendorId,
          applicationId: response.applicationId,
          step: 'submitted',
        }));
        localStorage.setItem('vendorId', response.vendorId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const resubmitApplication = async () => {
    // For clarification requests, resubmit with updated data
    await submitApplication();
  };

  const goToGetStarted = () => {
    router.push('/');
  };

  const goBackToRoleSelection = () => {
    setState(prev => ({
      ...prev,
      step: 'role',
      selectedRole: null,
      businessType: null,
      formData: {},
      documents: {},
      rejectionReason: null,
    }));
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const updateFormField = (name: string, value: any) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, [name]: value },
    }));
  };

  const updateDocument = (name: string, file: File | null) => {
    setState(prev => ({
      ...prev,
      documents: { ...prev.documents, [name]: file },
    }));
  };

  const getFormFieldsForRole = (): FormField[] => {
    if (!state.selectedRole) return [];

    // Base fields for all roles
    const baseFields: FormField[] = [
      { name: 'fullName', label: 'Full Name', type: 'text', required: true, placeholder: 'Enter your full name' },
      { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Enter your email' },
    ];

    // Business-specific fields
    const businessFields: FormField[] = state.businessType === 'business' ? [
      { name: 'businessName', label: 'Business Name', type: 'text', required: true, placeholder: 'Enter business name' },
      { name: 'gstNumber', label: 'GST Number', type: 'text', required: false, placeholder: 'GST Number (optional)' },
    ] : [];

    // Location fields
    const locationFields: FormField[] = [
      { name: 'address', label: 'Address', type: 'textarea', required: true, placeholder: 'Full address' },
      { name: 'city', label: 'City', type: 'text', required: true, placeholder: 'City' },
      { name: 'state', label: 'State', type: 'text', required: true, placeholder: 'State' },
      { name: 'pincode', label: 'Pincode', type: 'text', required: true, placeholder: '6-digit pincode' },
    ];

    // Role-specific fields
    const roleSpecificFields = getRoleSpecificFields(state.selectedRole.name);

    return [...baseFields, ...businessFields, ...locationFields, ...roleSpecificFields];
  };

  const getRoleSpecificFields = (roleName: string): FormField[] => {
    const roleFieldsMap: Record<string, FormField[]> = {
      veterinarian: [
        { name: 'registrationNumber', label: 'Veterinary Registration Number', type: 'text', required: true, placeholder: 'VCI Registration Number' },
        { name: 'qualifications', label: 'Qualifications', type: 'textarea', required: true, placeholder: 'List your qualifications' },
        { name: 'experience', label: 'Years of Experience', type: 'number', required: true, placeholder: 'Years' },
        { name: 'specializations', label: 'Specializations', type: 'textarea', required: false, placeholder: 'e.g., Surgery, Dermatology' },
      ],
      groomer: [
        { name: 'certifications', label: 'Certifications', type: 'textarea', required: false, placeholder: 'List any certifications' },
        { name: 'experience', label: 'Years of Experience', type: 'number', required: true, placeholder: 'Years' },
        { name: 'serviceRadius', label: 'Service Radius (km)', type: 'number', required: true, placeholder: 'Distance you can travel' },
      ],
      trainer: [
        { name: 'certifications', label: 'Training Certifications', type: 'textarea', required: true, placeholder: 'List your certifications' },
        { name: 'trainingMethods', label: 'Training Methods', type: 'textarea', required: true, placeholder: 'Describe your training approach' },
        { name: 'experience', label: 'Years of Experience', type: 'number', required: true, placeholder: 'Years' },
      ],
      pet_cafe: [
        { name: 'cafeCapacity', label: 'Seating Capacity', type: 'number', required: true, placeholder: 'Number of tables' },
        { name: 'petPolicy', label: 'Pet Policy', type: 'textarea', required: true, placeholder: 'What pets are allowed?' },
        { name: 'fssaiLicense', label: 'FSSAI License Number', type: 'text', required: true, placeholder: 'FSSAI License' },
        { name: 'operatingHours', label: 'Operating Hours', type: 'text', required: true, placeholder: 'e.g., 9 AM - 9 PM' },
      ],
      resort: [
        { name: 'roomCount', label: 'Number of Rooms', type: 'number', required: true, placeholder: 'Total rooms' },
        { name: 'amenities', label: 'Amenities', type: 'textarea', required: true, placeholder: 'List amenities offered' },
        { name: 'checkInTime', label: 'Check-in Time', type: 'text', required: true, placeholder: 'e.g., 2:00 PM' },
        { name: 'checkOutTime', label: 'Check-out Time', type: 'text', required: true, placeholder: 'e.g., 11:00 AM' },
        { name: 'cancellationPolicy', label: 'Cancellation Policy', type: 'textarea', required: true, placeholder: 'Describe your cancellation policy' },
      ],
      boarding: [
        { name: 'capacity', label: 'Pet Capacity', type: 'number', required: true, placeholder: 'Max pets at a time' },
        { name: 'petTypes', label: 'Pet Types Accepted', type: 'text', required: true, placeholder: 'e.g., Dogs, Cats' },
        { name: 'nightlyRate', label: 'Nightly Rate (₹)', type: 'number', required: true, placeholder: 'Base rate per night' },
        { name: 'amenities', label: 'Amenities', type: 'textarea', required: false, placeholder: 'List amenities' },
      ],
      walker: [
        { name: 'experience', label: 'Years of Experience', type: 'number', required: true, placeholder: 'Years' },
        { name: 'maxPets', label: 'Max Pets per Walk', type: 'number', required: true, placeholder: 'Number' },
        { name: 'serviceRadius', label: 'Service Radius (km)', type: 'number', required: true, placeholder: 'Distance' },
        { name: 'availability', label: 'Availability', type: 'text', required: true, placeholder: 'e.g., Morning 6-9 AM, Evening 5-8 PM' },
      ],
      insurance: [
        { name: 'irdaLicense', label: 'IRDA License Number', type: 'text', required: true, placeholder: 'IRDA License' },
        { name: 'insuranceProducts', label: 'Insurance Products Offered', type: 'textarea', required: true, placeholder: 'List insurance products' },
        { name: 'claimProcessTime', label: 'Average Claim Process Time', type: 'text', required: true, placeholder: 'e.g., 7-10 days' },
      ],
      nutritionist: [
        { name: 'qualifications', label: 'Nutritionist Qualifications', type: 'textarea', required: true, placeholder: 'List qualifications' },
        { name: 'experience', label: 'Years of Experience', type: 'number', required: true, placeholder: 'Years' },
        { name: 'dietTypes', label: 'Diet Types Offered', type: 'textarea', required: false, placeholder: 'e.g., Weight management, Allergy-specific' },
        { name: 'deliveryRadius', label: 'Delivery Radius (km)', type: 'number', required: false, placeholder: 'For meal delivery' },
      ],
      breeder: [
        { name: 'breedingLicense', label: 'Breeding License Number', type: 'text', required: true, placeholder: 'License number' },
        { name: 'breeds', label: 'Breeds Offered', type: 'textarea', required: true, placeholder: 'List breeds you specialize in' },
        { name: 'healthGuarantee', label: 'Health Guarantee Period', type: 'text', required: true, placeholder: 'e.g., 1 year' },
        { name: 'vaccinationProtocol', label: 'Vaccination Protocol', type: 'textarea', required: true, placeholder: 'Describe your vaccination schedule' },
      ],
      adoption_center: [
        { name: 'ngoRegistration', label: 'NGO Registration Number', type: 'text', required: true, placeholder: 'Registration number' },
        { name: 'adoptionProcess', label: 'Adoption Process', type: 'textarea', required: true, placeholder: 'Describe the adoption process' },
        { name: 'capacity', label: 'Center Capacity', type: 'number', required: true, placeholder: 'Max animals' },
      ],
      pharmacy: [
        { name: 'drugLicense', label: 'Drug License Number', type: 'text', required: true, placeholder: 'License number' },
        { name: 'pharmacistName', label: 'Registered Pharmacist Name', type: 'text', required: true, placeholder: 'Pharmacist name' },
        { name: 'deliveryRadius', label: 'Delivery Radius (km)', type: 'number', required: true, placeholder: 'Distance' },
      ],
      diagnostics: [
        { name: 'labLicense', label: 'Lab License Number', type: 'text', required: true, placeholder: 'License number' },
        { name: 'testsOffered', label: 'Tests Offered', type: 'textarea', required: true, placeholder: 'List diagnostic tests' },
        { name: 'homeCollection', label: 'Home Collection Available', type: 'checkbox', required: false },
        { name: 'reportTurnaround', label: 'Report Turnaround Time', type: 'text', required: true, placeholder: 'e.g., 24-48 hours' },
      ],
      ambulance: [
        { name: 'vehicleCount', label: 'Number of Ambulances', type: 'number', required: true, placeholder: 'Vehicles' },
        { name: 'serviceRadius', label: 'Service Radius (km)', type: 'number', required: true, placeholder: 'Distance' },
        { name: 'availability', label: 'Availability', type: 'select', required: true, options: [
          { value: '24x7', label: '24x7' },
          { value: 'day_only', label: 'Day Only (6 AM - 10 PM)' },
        ]},
        { name: 'equipment', label: 'Equipment Available', type: 'textarea', required: true, placeholder: 'List medical equipment' },
      ],
      holidays: [
        { name: 'tourOperatorLicense', label: 'Tour Operator License', type: 'text', required: true, placeholder: 'License number' },
        { name: 'destinationsOffered', label: 'Destinations Offered', type: 'textarea', required: true, placeholder: 'List destinations' },
        { name: 'groupSize', label: 'Typical Group Size', type: 'text', required: true, placeholder: 'e.g., 10-20 pets with owners' },
      ],
    };

    return roleFieldsMap[roleName] || [];
  };

  const getRequiredDocuments = (): { key: string; label: string; required: boolean }[] => {
    if (!state.selectedRole) return [];

    const baseDocuments = [
      { key: 'idProof', label: 'ID Proof (Aadhaar/PAN)', required: true },
      { key: 'addressProof', label: 'Address Proof', required: true },
    ];

    const roleDocuments: Record<string, { key: string; label: string; required: boolean }[]> = {
      veterinarian: [
        { key: 'vciCertificate', label: 'VCI Registration Certificate', required: true },
        { key: 'degreeCertificate', label: 'Degree Certificate', required: true },
      ],
      pet_cafe: [
        { key: 'fssaiLicense', label: 'FSSAI License', required: true },
        { key: 'tradeLicense', label: 'Trade License', required: true },
      ],
      pharmacy: [
        { key: 'drugLicense', label: 'Drug License', required: true },
        { key: 'pharmacistCertificate', label: 'Pharmacist Certificate', required: true },
      ],
      insurance: [
        { key: 'irdaLicense', label: 'IRDA License', required: true },
      ],
      breeder: [
        { key: 'breedingLicense', label: 'Breeding License', required: true },
        { key: 'kennelPhotos', label: 'Kennel/Facility Photos', required: true },
      ],
      diagnostics: [
        { key: 'labLicense', label: 'Lab License', required: true },
      ],
    };

    const businessDocuments = state.businessType === 'business' ? [
      { key: 'gstCertificate', label: 'GST Certificate', required: false },
      { key: 'businessRegistration', label: 'Business Registration', required: true },
    ] : [];

    return [
      ...baseDocuments,
      ...(roleDocuments[state.selectedRole.name] || []),
      ...businessDocuments,
    ];
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-orange-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">
            🐾
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Warmpawz Partner</h1>
            <p className="text-sm text-gray-500">Become a service provider</p>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-2">
          {['phone', 'role', 'form', 'documents', 'review'].map((step, index) => {
            const stepNames = ['Verify', 'Role', 'Details', 'Documents', 'Review'];
            const steps = ['phone', 'role', 'form', 'documents', 'review'];
            const currentIndex = steps.indexOf(state.step);
            const isComplete = index < currentIndex || ['submitted', 'approved', 'rejected', 'clarification'].includes(state.step);
            const isCurrent = step === state.step || (state.step === 'otp' && step === 'phone') || (state.step === 'business_type' && step === 'role');
            
            return (
              <div key={step} className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  isComplete ? 'bg-green-500 text-white' :
                  isCurrent ? 'bg-orange-500 text-white ring-4 ring-orange-200' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {isComplete ? '✓' : index + 1}
                </div>
                <span className={`ml-2 text-xs font-medium ${isCurrent ? 'text-orange-600' : 'text-gray-500'}`}>
                  {stepNames[index]}
                </span>
                {index < 4 && <div className={`flex-1 h-0.5 mx-2 ${isComplete ? 'bg-green-500' : 'bg-gray-200'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Step: Phone Number */}
        {state.step === 'phone' && (
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">📱</div>
              <h2 className="text-2xl font-bold text-gray-900">Enter Your Mobile Number</h2>
              <p className="text-gray-500 mt-2">We'll send you a verification code</p>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={state.phone}
                  onChange={(e) => setState(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                  placeholder="Enter 10-digit mobile number"
                  className="w-full pl-14 pr-4 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition outline-none"
                />
              </div>
              
              <button
                onClick={sendOtp}
                disabled={loading || state.phone.length !== 10}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-lg font-semibold rounded-2xl hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-orange-200"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span> Sending OTP...
                  </span>
                ) : 'Send OTP'}
              </button>
            </div>
          </div>
        )}

        {/* Step: OTP Verification */}
        {state.step === 'phone' && otpSent && (
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6 mt-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900">Enter OTP</h3>
              <p className="text-gray-500 mt-1">Sent to +91 {state.phone}</p>
              {UAT_MODE && (
                <p className="mt-2 text-orange-500 font-medium text-sm">
                  🧪 UAT Mode: Use OTP <strong>{UAT_OTP}</strong>
                </p>
              )}
            </div>
            
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
                    // Auto-focus next input
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
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            
            <div className="text-center">
              {resendTimer > 0 ? (
                <p className="text-gray-500">Resend OTP in {resendTimer}s</p>
              ) : (
                <button onClick={sendOtp} className="text-orange-500 font-medium hover:text-orange-600">
                  Resend OTP
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step: Role Selection */}
        {state.step === 'role' && (
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">👤</div>
              <h2 className="text-2xl font-bold text-gray-900">Choose Your Role</h2>
              <p className="text-gray-500 mt-2">Select the service category you want to provide</p>
            </div>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin text-4xl mb-4">⏳</div>
                <p className="text-gray-500">Loading roles...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setState(prev => ({
                      ...prev,
                      selectedRole: role,
                      step: 'business_type',
                    }))}
                    className="p-6 border-2 border-gray-200 rounded-2xl hover:border-orange-500 hover:bg-orange-50 transition text-left group"
                  >
                    <div className="text-4xl mb-3">{role.icon || '🏢'}</div>
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600">{role.display_name}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{role.description}</p>
                    {role.service_styles && role.service_styles.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {role.service_styles.slice(0, 3).map((style) => (
                          <span key={style} className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full">
                            {style}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Business Type (Solo vs Business) */}
        {state.step === 'business_type' && (
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🏢</div>
              <h2 className="text-2xl font-bold text-gray-900">Select Business Type</h2>
              <p className="text-gray-500 mt-2">Are you an individual or a registered business?</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => setState(prev => ({ ...prev, businessType: 'solo', step: 'form' }))}
                className="p-8 border-2 border-gray-200 rounded-2xl hover:border-orange-500 hover:bg-orange-50 transition text-center group"
              >
                <div className="text-6xl mb-4">👤</div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-orange-600">Solo Provider</h3>
                <p className="text-gray-500 mt-2">Individual service provider without a registered business</p>
                <ul className="text-sm text-gray-600 mt-4 space-y-1 text-left">
                  <li>✓ Simplified registration</li>
                  <li>✓ Minimal documentation</li>
                  <li>✓ Work from home</li>
                </ul>
              </button>
              
              <button
                onClick={() => setState(prev => ({ ...prev, businessType: 'business', step: 'form' }))}
                className="p-8 border-2 border-gray-200 rounded-2xl hover:border-orange-500 hover:bg-orange-50 transition text-center group"
              >
                <div className="text-6xl mb-4">🏪</div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-orange-600">Business</h3>
                <p className="text-gray-500 mt-2">Registered business or clinic with staff</p>
                <ul className="text-sm text-gray-600 mt-4 space-y-1 text-left">
                  <li>✓ Business profile</li>
                  <li>✓ Staff management</li>
                  <li>✓ Multi-location support</li>
                </ul>
              </button>
            </div>

            <button
              onClick={() => setState(prev => ({ ...prev, step: 'role', selectedRole: null }))}
              className="w-full py-3 text-gray-500 hover:text-gray-700 font-medium"
            >
              ← Back to Role Selection
            </button>
          </div>
        )}

        {/* Step: Dynamic Form */}
        {state.step === 'form' && (
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">📝</div>
              <h2 className="text-2xl font-bold text-gray-900">Your Details</h2>
              <p className="text-gray-500 mt-2">Fill in the required information for {state.selectedRole?.display_name}</p>
            </div>
            
            <div className="space-y-4">
              {getFormFieldsForRole().map((field) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  
                  {field.type === 'textarea' ? (
                    <textarea
                      value={state.formData[field.name] || ''}
                      onChange={(e) => updateFormField(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition outline-none resize-none"
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={state.formData[field.name] || ''}
                      onChange={(e) => updateFormField(field.name, e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition outline-none"
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.formData[field.name] || false}
                        onChange={(e) => updateFormField(field.name, e.target.checked)}
                        className="w-5 h-5 border-2 border-gray-300 rounded text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-gray-700">Yes</span>
                    </label>
                  ) : (
                    <input
                      type={field.type}
                      value={state.formData[field.name] || ''}
                      onChange={(e) => updateFormField(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition outline-none"
                    />
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setState(prev => ({ ...prev, step: 'business_type' }))}
                className="flex-1 py-4 border-2 border-gray-200 text-gray-700 font-semibold rounded-2xl hover:bg-gray-50 transition"
              >
                ← Back
              </button>
              <button
                onClick={() => setState(prev => ({ ...prev, step: 'documents' }))}
                className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-2xl hover:from-orange-600 hover:to-orange-700 transition shadow-lg shadow-orange-200"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step: Documents */}
        {state.step === 'documents' && (
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">📄</div>
              <h2 className="text-2xl font-bold text-gray-900">Upload Documents</h2>
              <p className="text-gray-500 mt-2">Upload the required documents for verification</p>
            </div>
            
            <div className="space-y-4">
              {getRequiredDocuments().map((doc) => (
                <div key={doc.key} className="p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-orange-300 transition">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {doc.label} {doc.required && <span className="text-red-500">*</span>}
                      </p>
                      {state.documents[doc.key] && (
                        <p className="text-sm text-green-600 mt-1">
                          ✓ {state.documents[doc.key]?.name}
                        </p>
                      )}
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => updateDocument(doc.key, e.target.files?.[0] || null)}
                      />
                      <span className="px-4 py-2 bg-orange-100 text-orange-600 rounded-lg font-medium hover:bg-orange-200 transition">
                        {state.documents[doc.key] ? 'Change' : 'Upload'}
                      </span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setState(prev => ({ ...prev, step: 'form' }))}
                className="flex-1 py-4 border-2 border-gray-200 text-gray-700 font-semibold rounded-2xl hover:bg-gray-50 transition"
              >
                ← Back
              </button>
              <button
                onClick={() => setState(prev => ({ ...prev, step: 'review' }))}
                className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-2xl hover:from-orange-600 hover:to-orange-700 transition shadow-lg shadow-orange-200"
              >
                Review →
              </button>
            </div>
          </div>
        )}

        {/* Step: Review */}
        {state.step === 'review' && (
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-gray-900">Review Your Application</h2>
              <p className="text-gray-500 mt-2">Please verify all details before submitting</p>
            </div>
            
            <div className="space-y-6">
              {/* Role & Business Type */}
              <div className="p-4 bg-orange-50 rounded-xl">
                <h3 className="font-semibold text-gray-900 mb-2">Service Category</h3>
                <p className="text-gray-700">{state.selectedRole?.display_name}</p>
                <p className="text-sm text-gray-500 mt-1">Type: {state.businessType === 'solo' ? 'Solo Provider' : 'Business'}</p>
              </div>
              
              {/* Contact Info */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <h3 className="font-semibold text-gray-900 mb-2">Contact Information</h3>
                <p className="text-gray-700">Phone: +91 {state.phone}</p>
                <p className="text-gray-700">Email: {state.formData.email}</p>
              </div>
              
              {/* Form Data Summary */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <h3 className="font-semibold text-gray-900 mb-2">Details</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(state.formData).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-gray-500">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
                      <span className="text-gray-900">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Documents Summary */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <h3 className="font-semibold text-gray-900 mb-2">Documents</h3>
                <div className="space-y-1 text-sm">
                  {Object.entries(state.documents).filter(([_, file]) => file).map(([key, file]) => (
                    <p key={key} className="text-green-600">✓ {key}: {file?.name}</p>
                  ))}
                  {Object.values(state.documents).filter(f => f).length === 0 && (
                    <p className="text-gray-500">No documents uploaded</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setState(prev => ({ ...prev, step: 'documents' }))}
                className="flex-1 py-4 border-2 border-gray-200 text-gray-700 font-semibold rounded-2xl hover:bg-gray-50 transition"
              >
                ← Back
              </button>
              <button
                onClick={submitApplication}
                disabled={loading}
                className="flex-1 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-2xl hover:from-green-600 hover:to-green-700 disabled:opacity-50 transition shadow-lg shadow-green-200"
              >
                {loading ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        )}

        {/* Step: Submitted (Pending Review) */}
        {state.step === 'submitted' && (
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
            <div className="text-8xl mb-6">🎉</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Application Submitted!</h2>
            <p className="text-gray-500 text-lg mb-8">
              Your application is under review. We'll notify you once it's approved.
            </p>
            <div className="p-4 bg-yellow-50 rounded-xl mb-8">
              <p className="text-yellow-700 font-medium">⏳ Status: Pending Review</p>
              <p className="text-sm text-yellow-600 mt-1">Expected response within 24-48 hours</p>
            </div>
            {state.applicationId && (
              <p className="text-sm text-gray-400">Application ID: {state.applicationId}</p>
            )}
          </div>
        )}

        {/* Step: Approved */}
        {state.step === 'approved' && (
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
            <div className="text-8xl mb-6">✅</div>
            <h2 className="text-3xl font-bold text-green-600 mb-4">You're Approved!</h2>
            <p className="text-gray-500 text-lg mb-8">
              Congratulations! Your application has been approved. Start setting up your profile and services.
            </p>
            <button
              onClick={goToGetStarted}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white text-lg font-semibold rounded-2xl hover:from-green-600 hover:to-green-700 transition shadow-lg shadow-green-200"
            >
              🚀 Get Started
            </button>
          </div>
        )}

        {/* Step: Rejected */}
        {state.step === 'rejected' && (
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
            <div className="text-8xl mb-6">😔</div>
            <h2 className="text-3xl font-bold text-red-600 mb-4">Application Not Approved</h2>
            <p className="text-gray-500 text-lg mb-6">
              Unfortunately, your application was not approved at this time.
            </p>
            {state.rejectionReason && (
              <div className="p-4 bg-red-50 rounded-xl mb-8 text-left">
                <p className="text-red-700 font-medium">Reason:</p>
                <p className="text-red-600 mt-1">{state.rejectionReason}</p>
              </div>
            )}
            <button
              onClick={goBackToRoleSelection}
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-lg font-semibold rounded-2xl hover:from-orange-600 hover:to-orange-700 transition shadow-lg shadow-orange-200"
            >
              Apply Again
            </button>
          </div>
        )}

        {/* Step: Clarification Requested */}
        {state.step === 'clarification' && (
          <div className="bg-white rounded-3xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="text-8xl mb-6">📝</div>
              <h2 className="text-3xl font-bold text-yellow-600 mb-4">Clarification Needed</h2>
              <p className="text-gray-500 text-lg">
                Please update your application based on the feedback below.
              </p>
            </div>
            
            {state.adminComment && (
              <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl mb-8">
                <p className="text-yellow-700 font-medium">Admin Feedback:</p>
                <p className="text-yellow-800 mt-2">{state.adminComment}</p>
              </div>
            )}
            
            <div className="flex gap-4">
              <button
                onClick={() => setState(prev => ({ ...prev, step: 'form' }))}
                className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-2xl hover:from-orange-600 hover:to-orange-700 transition shadow-lg shadow-orange-200"
              >
                Update Application →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

