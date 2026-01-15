'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { VendorRoleSelection } from './VendorRoleSelection';
import { DynamicVendorOnboardingForm } from './DynamicVendorOnboardingForm';
import { VendorApplicationSubmitted } from './VendorApplicationSubmitted';
import { VendorApplicationUnderReview } from './VendorApplicationUnderReview';
import { VendorApplicationRejected } from './VendorApplicationRejected';
import { VendorClarificationRequested } from './VendorClarificationRequested';
import { VendorLandingPage } from './VendorLandingPage';
import { VendorApprovedSetup } from './VendorApprovedSetup';
import { apiClient } from '@/lib/api-client';

interface VendorSession {
  phone: string;
  vendorId?: string;
  vendor?: any;
  sessionToken?: string;
  verified: boolean;
  isStaffLogin?: boolean;
  staff?: any;
}

interface VendorAppProps {
  initialSession: VendorSession;
}

type VendorStatus = 
  | 'new'                    
  | 'profile_incomplete'     
  | 'submitted'              
  | 'pending'                
  | 'approved'               
  | 'approved_services'      // Approved, needs service setup
  | 'rejected'               
  | 'clarification'          
  | 'active';               

export function VendorApp({ initialSession }: VendorAppProps) {
  const router = useRouter();
  const [session, setSession] = useState<VendorSession>(initialSession);
  const [status, setStatus] = useState<VendorStatus>('new');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [vendorData, setVendorData] = useState<any>(null);
  const [applicationData, setApplicationData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Load vendor status on mount
  useEffect(() => {
    checkVendorStatus();
  }, [session]);

  const checkVendorStatus = async () => {
    setIsLoading(true);
    
    try {
      // ✅ FIX: Check localStorage first for onboarding status (set by verify-otp)
      const storedStatus = localStorage.getItem('vendorApplicationStatus');
      console.log('📊 [VendorApp] Stored onboarding status from localStorage:', storedStatus);
      
      // If status is APPROVED or ACTIVATED, show dashboard directly (skip approved setup screen)
      if (storedStatus === 'APPROVED' || storedStatus === 'ACTIVATED') {
        console.log('✅ [VendorApp] Vendor is approved/activated, showing dashboard directly');
        setStatus('active'); // Set to 'active' to show dashboard, not 'approved' which shows setup screen
        setIsLoading(false);
        // Don't return - continue to set vendorData so dashboard can render
      }
      
      // Fetch onboarding status from API (correct endpoint)
      console.log('📊 [VendorApp] Fetching onboarding status for phone:', session.phone);
      
      const response = await apiClient.get<any>(`/vendor/onboarding/status?phone=${encodeURIComponent(session.phone)}`);
      
      // ✅ FIX: API returns {success: true, data: {identity, application, role}}
      // Extract data from response.data, not response directly
      const responseData = response?.data || response; // Support both structures for backward compatibility
      if (responseData && responseData.identity) {
        const { identity, application, role } = responseData;
        
        // Map onboarding status to frontend status
        const onboardingStatus = identity.onboarding_status;
        console.log('📊 [VendorApp] Onboarding status from API:', onboardingStatus);
        
        // ✅ FIX: Update localStorage with status from API
        if (onboardingStatus) {
          localStorage.setItem('vendorApplicationStatus', onboardingStatus);
        }
        
        // ✅ FIX: For APPROVED/ACTIVATED vendors, fetch vendor profile to get correct vendor.id
        let vendorId = identity.vendor_id || identity.id;
        let vendorRecordExists = false;
        if ((onboardingStatus === 'APPROVED' || onboardingStatus === 'ACTIVATED')) {
          try {
            console.log('📊 [VendorApp] Fetching vendor profile to get correct vendor ID...');
            const profileResponse = await apiClient.get<any>('/vendor/profile');
            // ✅ FIX: Check response structure (could be response.data or response directly)
            const profileData = profileResponse?.data || profileResponse;
            if (profileData?.vendor?.id) {
              // Check if vendor ID is different from identity ID (means vendor record exists in vendors table)
              if (profileData.vendor.id !== identity.id) {
                vendorId = profileData.vendor.id;
                vendorRecordExists = true;
                console.log('✅ [VendorApp] Got vendor ID from vendors table:', vendorId);
              } else {
                // Vendor ID same as identity ID means vendor record doesn't exist yet
                vendorId = identity.id;
                vendorRecordExists = false;
                console.log('⚠️ [VendorApp] Vendor record does not exist in vendors table yet. Using identity ID:', vendorId);
              }
              // Merge profile data with identity data
              Object.assign(identity, { vendor_id: vendorId });
            } else {
              // ✅ FIX: Profile returned null vendor - try to fetch vendor by phone directly from vendors list
              console.log('⚠️ [VendorApp] Profile returned null vendor, fetching vendor by phone...');
              try {
                const vendorsResponse = await apiClient.get<any>('/admin/vendors');
                const vendorsData = vendorsResponse?.data?.vendors || vendorsResponse?.vendors || [];
                const matchingVendor = vendorsData.find((v: any) => 
                  v.phone === identity.phone || 
                  v.phone === `+91${identity.phone}` || 
                  v.phone?.replace(/\D/g, '').endsWith(identity.phone?.replace(/\D/g, ''))
                );
                if (matchingVendor) {
                  vendorId = matchingVendor.id;
                  vendorRecordExists = true;
                  console.log('✅ [VendorApp] Found vendor by phone lookup:', vendorId);
                  Object.assign(identity, { vendor_id: vendorId });
                }
              } catch (vendorLookupError) {
                console.warn('⚠️ [VendorApp] Could not fetch vendors list:', vendorLookupError);
              }
            }
          } catch (profileError: any) {
            console.warn('⚠️ [VendorApp] Could not fetch vendor profile, using identity ID:', profileError.message);
            // Continue with identity.id as fallback
            vendorRecordExists = false;
          }
        }
        
        // Update localStorage with identity and application data
        // ✅ FIX: Resolve roleId from multiple sources with fallbacks
        const resolvedRoleId = 
          identity.selected_role_id || // 1. From identity table
          application?.role_id ||       // 2. From application record
          role?.id ||                   // 3. From role object
          localStorage.getItem('vendorRole') || // 4. From localStorage
          null;
        
        console.log('🔍 [VendorApp] Role ID resolution:', {
          'identity.selected_role_id': identity.selected_role_id,
          'application.role_id': application?.role_id,
          'role.id': role?.id,
          'localStorage.vendorRole': localStorage.getItem('vendorRole'),
          'resolvedRoleId': resolvedRoleId
        });
        
        const vendorData: any = {
          id: vendorId, // ✅ Use correct vendor ID (from vendors table if available, otherwise identity ID)
          phone: identity.phone,
          email: identity.email,
          onboarding_status: onboardingStatus,
          role_id: resolvedRoleId,
          roleId: resolvedRoleId, // ✅ FIX: Add camelCase for VendorDashboard compatibility
          vendor_type: identity.vendor_type,
          vendorType: identity.vendor_type, // ✅ FIX: Add camelCase for VendorDashboard compatibility
          application_id: application?.id,
          vendorRecordExists: vendorRecordExists, // Flag to indicate if vendor record exists in vendors table
          businessName: identity.business_name || identity.full_name || application?.application_payload?.businessName || 'Vendor',
          fullName: identity.full_name || identity.business_name || 'Vendor',
          address: identity.address || application?.application_payload?.address || 'India',
        };
        
        // Add application data if exists
        if (application) {
          vendorData.applicationStatus = application.status;
          vendorData.application = application;
          
          // Map application status
          if (application.status === 'APPROVED') {
            vendorData.status = 'approved';
            vendorData.isActive = true;
          } else if (application.status === 'REJECTED') {
            vendorData.status = 'rejected';
            vendorData.rejectionReason = application.rejection_reason;
          } else if (application.status === 'CLARIFICATION_REQUIRED') {
            vendorData.status = 'clarification';
            vendorData.clarificationNotes = application.admin_comments;
            vendorData.reviewerName = application.reviewed_by;
          }
          
          // Add application payload data
          if (application.application_payload) {
            Object.assign(vendorData, application.application_payload);
          }
        }
        
        // Add role data
        if (role) {
          vendorData.role = role;
          localStorage.setItem('vendorRole', role.id || role.name);
        } else if (resolvedRoleId) {
          // Store roleId even if we don't have the full role object
          localStorage.setItem('vendorRole', resolvedRoleId);
        }
        
        // Map onboarding status to frontend status
        if (onboardingStatus === 'ACTIVATED') {
          setStatus('active');
          vendorData.isActive = true;
          vendorData.status = 'active';
        } else if (onboardingStatus === 'APPROVED') {
          // ✅ FIX: Show dashboard directly for APPROVED vendors (not approved setup screen)
          console.log('✅ [VendorApp] Vendor is APPROVED, showing dashboard directly');
          setStatus('active'); // Set to 'active' to show dashboard, not 'approved' which shows setup screen
          vendorData.isActive = true; // Approved vendors are active
          vendorData.status = 'active';
          // Continue to set vendorData - don't return early
        } else if (onboardingStatus === 'UNDER_REVIEW') {
          setStatus('pending');
          vendorData.status = 'pending';
          vendorData.applicationStatus = 'under_review';
        } else if (onboardingStatus === 'REJECTED') {
          setStatus('rejected');
          vendorData.status = 'rejected';
          setApplicationData({
            rejectionReason: application?.rejection_reason || 'Your application was not approved.',
            allowResubmit: true
          });
        } else if (onboardingStatus === 'CLARIFICATION_REQUIRED') {
          setStatus('clarification');
          vendorData.status = 'clarification';
          setApplicationData({
            clarificationNotes: application?.admin_comments || 'Please provide additional information.',
            reviewerName: application?.reviewed_by || 'Admin'
          });
        } else if (onboardingStatus === 'FORM_PENDING' || onboardingStatus === 'ROLE_PENDING') {
          // Still in onboarding
          setStatus('new');
          if (identity.selected_role_id && role) {
            setSelectedRole(role.id || role.name);
            setShowOnboarding(true);
          }
        } else {
          // INIT or other
          setStatus('new');
        }
        
        // Store vendor data
        setVendorData(vendorData);
        localStorage.setItem('vendorData', JSON.stringify(vendorData));
        localStorage.setItem('vendorApplicationStatus', onboardingStatus);
        localStorage.setItem('vendorId', vendorData.id || identity.id);
        
        console.log('✅ [VendorApp] Status updated:', {
          onboardingStatus,
          frontendStatus: status,
          vendorId: vendorData.id
        });
      }
    } catch (err: any) {
      console.error('❌ [VendorApp] Error checking vendor status:', err);
      
      // ✅ FIX: Fallback to stored data on error, but prioritize APPROVED/ACTIVATED status
      const storedStatus = localStorage.getItem('vendorApplicationStatus');
      const storedVendor = localStorage.getItem('vendorData');
      
      if (storedStatus === 'APPROVED' || storedStatus === 'ACTIVATED') {
        console.log('✅ [VendorApp] Using stored APPROVED/ACTIVATED status from localStorage');
        setStatus('active');
        if (storedVendor) {
          try {
            const vendor = JSON.parse(storedVendor);
            setVendorData(vendor);
          } catch (parseErr) {
            console.error('Error parsing stored vendor data:', parseErr);
          }
        }
      } else if (storedVendor) {
        try {
          const vendor = JSON.parse(storedVendor);
          setVendorData(vendor);
          
          if (storedStatus) {
            // Map stored status to frontend status
            if (storedStatus === 'APPROVED' || storedStatus === 'ACTIVATED') {
              setStatus('active');
            } else if (storedStatus === 'UNDER_REVIEW') {
              setStatus('pending');
            } else if (storedStatus === 'REJECTED') {
              setStatus('rejected');
            } else if (storedStatus === 'CLARIFICATION_REQUIRED') {
              setStatus('clarification');
            } else {
              setStatus(storedStatus as VendorStatus);
            }
          } else if (vendor.isActive) {
            setStatus('active');
          } else if (vendor.status === 'approved') {
            setStatus('active'); // Approved vendors are active
          } else if (vendor.status === 'pending' || vendor.status === 'under_review') {
            setStatus('pending');
          } else {
            setStatus('new');
          }
        } catch (parseErr) {
          console.error('Error parsing stored vendor data:', parseErr);
          setStatus('new');
        }
      } else {
        // No stored data - show role selection
        setStatus('new');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleSelect = async (role: string) => {
    console.log('📋 Role selected:', role);
    
    // Get phone number from localStorage
    const phone = localStorage.getItem('vendorPhone');
    if (!phone) {
      console.error('❌ No phone number found');
      return;
    }
    
    try {
      // Step 1: Save selected role to backend
      console.log('📤 Saving role selection to backend...');
      await apiClient.post('/vendor/onboarding/select-role', { phone, role_id: role });
      console.log('✅ Role saved');
      
      // Step 2: Auto-set vendor type to "business" (lowercase, since we removed Solo/Business selection)
      console.log('📤 Setting vendor type to business...');
      await apiClient.post('/vendor/onboarding/select-vendor-type', { phone, vendor_type: 'business' });
      console.log('✅ Vendor type saved');
      
      // Now set state and show onboarding form
      setSelectedRole(role);
      localStorage.setItem('vendorRole', role);
      setShowOnboarding(true);
    } catch (error) {
      console.error('❌ Error saving role/vendor type:', error);
      // Still show onboarding form even if API fails
      setSelectedRole(role);
      localStorage.setItem('vendorRole', role);
      setShowOnboarding(true);
    }
  };

  const handleOnboardingComplete = (data: any) => {
    console.log('✅ Onboarding completed:', data);
    setVendorData(data);
    localStorage.setItem('vendorData', JSON.stringify(data));
    localStorage.setItem('vendorApplicationStatus', 'submitted');
    setStatus('submitted');
    setShowOnboarding(false);
  };

  const handleApplicationContinue = () => {
    setStatus('pending');
    localStorage.setItem('vendorApplicationStatus', 'pending');
  };

  const handleCorrectAndResubmit = () => {
    setShowOnboarding(true);
  };

  const handleStartFresh = () => {
    // Clear all vendor data and start fresh
    localStorage.removeItem('vendorData');
    localStorage.removeItem('vendorRole');
    localStorage.removeItem('vendorApplicationStatus');
    setVendorData(null);
    setSelectedRole(null);
    setStatus('new');
  };

  const handleLogout = () => {
    localStorage.removeItem('vendorPhone');
    localStorage.removeItem('authToken');
    localStorage.removeItem('vendorData');
    localStorage.removeItem('vendorRole');
    localStorage.removeItem('vendorApplicationStatus');
    router.push('/auth');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Application Submitted
  if (status === 'submitted') {
    return (
      <VendorApplicationSubmitted 
        applicationId={vendorData?.applicationId || 'PENDING'}
        onContinue={handleApplicationContinue}
      />
    );
  }

  // Application Under Review
  if (status === 'pending') {
    return (
      <VendorApplicationUnderReview 
        submittedAt={vendorData?.submittedAt || new Date().toISOString()}
        isReapproval={vendorData?.wasApprovedBefore}
        reapprovalReason={vendorData?.reapprovalReason}
      />
    );
  }

  // Application Rejected
  if (status === 'rejected') {
    return (
      <VendorApplicationRejected 
        applicationId={vendorData?.applicationId || 'N/A'}
        rejectionReason={applicationData?.rejectionReason || 'Your application was not approved.'}
        allowResubmit={applicationData?.allowResubmit !== false}
        onResubmit={handleStartFresh}
        onCorrectAndResubmit={handleCorrectAndResubmit}
      />
    );
  }

  // Clarification Requested
  if (status === 'clarification') {
    return (
      <VendorClarificationRequested 
        applicationId={vendorData?.applicationId || 'N/A'}
        clarificationNotes={applicationData?.clarificationNotes || 'Please provide additional information.'}
        reviewerName={applicationData?.reviewerName}
        onCorrectAndResubmit={handleCorrectAndResubmit}
      />
    );
  }

  // ✅ FIX: Skip approved setup screen - approved vendors go directly to VendorLandingPage (full portal)
  // VendorLandingPage includes VendorDashboard with all navigation handlers and sub-screens
  if (status === 'approved' || status === 'approved_services') {
    console.log('✅ [VendorApp] Approved vendor - showing VendorLandingPage (full portal)');
    return (
      <VendorLandingPage 
        vendorId={vendorData?.id || session.vendorId || ''}
        phone={session.phone}
        initialVendorData={vendorData}
        vendorType={vendorData?.vendorType}
        serviceStyle={vendorData?.serviceStyle}
      />
    );
  }

  // Active Vendor - Show VendorLandingPage (full portal)
  if (status === 'active') {
    return (
      <VendorLandingPage 
        vendorId={vendorData?.id || session.vendorId || ''}
        phone={session.phone}
        initialVendorData={vendorData}
        vendorType={vendorData?.vendorType}
        serviceStyle={vendorData?.serviceStyle}
      />
    );
  }

  // Onboarding Flow - Load dynamic form directly from DB based on selected role
  // No Solo/Business selection - all vendors use the same dynamic form for their role
  if (showOnboarding && selectedRole) {
    // Store role for onboarding flow to read
    localStorage.setItem('vendorSelectedRole', selectedRole);
    
    // Get initial data if vendor is re-editing (clarification requested)
    const initialFormData = vendorData?.application?.application_payload || null;
    
    return (
      <DynamicVendorOnboardingForm 
        roleId={selectedRole}
        vendorId={vendorData?.id || session.vendorId}
        initialData={initialFormData ? { formData: initialFormData } : undefined}
        isEditMode={!!initialFormData}
        onSubmit={async (submissionData) => {
          console.log('✅ [VendorApp] Onboarding form submitted:', submissionData);
          
          // Submit to backend
          try {
            const phone = session.phone || localStorage.getItem('vendorPhone');
            
            const payload = {
              phone,
              application_payload: {
                ...submissionData.formData,
                roleId: selectedRole,
                location: submissionData.coordinates,
                coordinates: submissionData.coordinates,
                specializations: submissionData.specializations || [],
                agreedToTerms: submissionData.agreedToTerms || true,
              },
              uploaded_documents: Object.entries(submissionData.documents || {}).map(([key, doc]: [string, any]) => ({
                type: key,
                name: doc?.name || key,
                url: doc?.url || '',
                size: doc?.size,
                mime_type: doc?.type,
              })),
            };

            const response = await apiClient.post<any>('/vendor/onboarding/submit-application', payload);
            
            if (response.success || response.applicationId) {
              handleOnboardingComplete({
                ...submissionData,
                applicationId: response.applicationId,
                vendorId: response.vendorId,
                status: 'submitted',
              });
            } else {
              console.error('❌ [VendorApp] Failed to submit:', response);
              alert(response.error || 'Failed to submit application');
            }
          } catch (error: any) {
            console.error('❌ [VendorApp] Error submitting application:', error);
            alert(error.message || 'Error submitting application');
          }
        }}
        onBack={() => {
          setShowOnboarding(false);
          setSelectedRole(null);
        }}
      />
    );
  }

  // New Vendor - Role Selection
  if (status === 'new' && !selectedRole) {
    return <VendorRoleSelection onRoleSelect={handleRoleSelect} />;
  }

  // Default: Show role selection
  return <VendorRoleSelection onRoleSelect={handleRoleSelect} />;
}

