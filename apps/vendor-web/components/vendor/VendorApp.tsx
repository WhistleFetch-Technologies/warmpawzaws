'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
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

/** Compute initial state from session + localStorage so existing vendors never flash "choose role" or loading. */
function getInitialVendorState(session: VendorSession): { status: VendorStatus; vendorData: any; isLoading: boolean } {
  if (typeof window === 'undefined') return { status: 'new', vendorData: null, isLoading: true };
  const sv = session?.vendor;
  const sessionActive = sv && (
    sv.onboarding_status === 'ACTIVATED' || sv.onboarding_status === 'APPROVED' ||
    sv.onboardingStatus === 'ACTIVATED' || sv.onboardingStatus === 'APPROVED' ||
    sv.isActive === true
  );
  if (sessionActive && sv) {
    return { status: 'active', vendorData: { ...sv, isActive: true, status: 'active' }, isLoading: false };
  }
  const storedStatus = localStorage.getItem('vendorApplicationStatus');
  const storedVendorRaw = localStorage.getItem('vendorData');
  if (storedStatus === 'APPROVED' || storedStatus === 'ACTIVATED') {
    try {
      const v = storedVendorRaw ? JSON.parse(storedVendorRaw) : sv;
      if (v) return { status: 'active', vendorData: { ...v, isActive: true, status: 'active' }, isLoading: false };
    } catch (_) {}
  }
  if (storedVendorRaw) {
    try {
      const v = JSON.parse(storedVendorRaw);
      const active = v?.isActive === true || v?.onboarding_status === 'ACTIVATED' || v?.onboarding_status === 'APPROVED' || v?.onboardingStatus === 'ACTIVATED' || v?.onboardingStatus === 'APPROVED';
      if (active) return { status: 'active', vendorData: { ...v, isActive: true, status: 'active' }, isLoading: false };
    } catch (_) {}
  }
  return { status: 'new', vendorData: null, isLoading: true };
}

export function VendorApp({ initialSession }: VendorAppProps) {
  const router = useRouter();
  const [session] = useState<VendorSession>(initialSession);
  const initialRef = useRef<{ status: VendorStatus; vendorData: any; isLoading: boolean } | null>(null);
  if (initialRef.current === null) initialRef.current = getInitialVendorState(initialSession);
  const initial = initialRef.current;
  const [status, setStatus] = useState<VendorStatus>(initial.status);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [vendorData, setVendorData] = useState<any>(initial.vendorData);
  const [applicationData, setApplicationData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(initial.isLoading);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [resubmitInitialData, setResubmitInitialData] = useState<any>(null);

  const hasCheckedStatus = useRef(false);
  const isCheckingStatus = useRef(false);

  useEffect(() => {
    if (hasCheckedStatus.current || isCheckingStatus.current) return;
    if (!initial.isLoading) {
      hasCheckedStatus.current = true;
      return;
    }
    hasCheckedStatus.current = true;
    checkVendorStatus();
  }, []);

  const checkVendorStatus = async () => {
    if (isCheckingStatus.current) {
      console.log('⚠️ [VendorApp] Status check already in progress, skipping');
      return;
    }
    isCheckingStatus.current = true;
    setIsLoading(true);

    try {
      const storedStatus = localStorage.getItem('vendorApplicationStatus');
      const sessionVendor = session.vendor;
      const sessionVendorActive =
        sessionVendor &&
        (sessionVendor.onboarding_status === 'ACTIVATED' ||
          sessionVendor.onboarding_status === 'APPROVED' ||
          sessionVendor.onboardingStatus === 'ACTIVATED' ||
          sessionVendor.onboardingStatus === 'APPROVED' ||
          sessionVendor.isActive === true);
      console.log('📊 [VendorApp] Stored status:', storedStatus, 'session vendor active:', !!sessionVendorActive);

      // FAST PATH 1: Session already has active vendor (e.g. from root page localStorage)
      if (sessionVendorActive) {
        console.log('✅ [VendorApp] Existing vendor from session – showing dashboard (session FAST PATH)');
        const v = { ...sessionVendor, isActive: true, status: 'active' };
        setVendorData(v);
        setStatus('active');
        if (!storedStatus || (storedStatus !== 'ACTIVATED' && storedStatus !== 'APPROVED')) {
          localStorage.setItem('vendorApplicationStatus', sessionVendor.onboarding_status || sessionVendor.onboardingStatus || 'ACTIVATED');
        }
        setIsLoading(false);
        isCheckingStatus.current = false;
        return;
      }

      // FAST PATH 2: localStorage status is APPROVED or ACTIVATED
      // This prevents the infinite loading loop by short-circuiting before API calls
      if (storedStatus === 'APPROVED' || storedStatus === 'ACTIVATED') {
        console.log('✅ [VendorApp] Vendor is approved/activated, showing dashboard directly (FAST PATH)');
        
        // Load vendor data from localStorage for immediate display
        const storedVendor = localStorage.getItem('vendorData');
        const storedVendorId = localStorage.getItem('vendorId');
        
        if (storedVendor) {
          try {
            const vendor = JSON.parse(storedVendor);
            vendor.isActive = true;
            vendor.status = 'active';
            setVendorData(vendor);
            
            // ✅ CRITICAL FIX: Fetch profile in background to update vendorId if needed
            // This ensures we get the correct vendors table ID (not vendor_identity ID)
            if (storedVendorId) {
              apiClient.get<any>(`/vendor/${storedVendorId}/profile`)
                .then((profileResponse) => {
                  const profileData = profileResponse?.data || profileResponse;
                  if (profileData?.success && profileData?.vendor) {
                    const profileVendor = profileData.vendor;
                    const correctVendorId = profileVendor.id || storedVendorId;
                    
                    // ✅ CRITICAL FIX: ALWAYS merge profile data to get roleId and capabilities
                    // Preserve address and vendorConfiguration from localStorage when profile returns null/undefined
                    // (on reload, profile API can omit these and overwriting would hide address + flip to solo UI)
                    const updatedVendor = { 
                      ...vendor, 
                      ...profileVendor,
                      id: correctVendorId,
                      roleId: profileVendor.role_id ?? profileVendor.roleId ?? vendor.roleId,
                      role_id: profileVendor.role_id ?? profileVendor.roleId ?? vendor.role_id,
                      roleName: profileVendor.roleName ?? profileVendor.role_name ?? vendor.roleName ?? vendor.role_name,
                      role_name: profileVendor.role_name ?? profileVendor.roleName ?? vendor.role_name ?? vendor.roleName,
                      isActive: true,
                      status: 'active',
                      // Preserve from localStorage when profile omits or nulls (prevents reload bug)
                      address: (profileVendor.address != null && profileVendor.address !== '') ? profileVendor.address : (vendor.address ?? profileVendor.address),
                      vendorConfiguration: (profileVendor.vendorConfiguration ?? profileVendor.vendor_configuration) ?? (vendor.vendorConfiguration ?? vendor.vendor_configuration),
                    };
                    
                    console.log('✅ [VendorApp] FAST PATH: Merging profile data with roleId:', updatedVendor.roleId || updatedVendor.role_id);
                    
                    // Update localStorage
                    localStorage.setItem('vendorId', correctVendorId);
                    localStorage.setItem('vendorData', JSON.stringify(updatedVendor));
                    
                    // Update roleId in localStorage
                    const roleId = profileVendor.role_id || profileVendor.roleId;
                    if (roleId) {
                      localStorage.setItem('vendorRole', roleId);
                      console.log('✅ [VendorApp] FAST PATH: Updated vendorRole to', roleId);
                    }
                    
                    // ✅ CRITICAL: Update state to trigger re-render with roleId
                    setVendorData(updatedVendor);
                  }
                })
                .catch((err) => {
                  console.warn('⚠️ [VendorApp] FAST PATH: Could not fetch profile for ID update:', err);
                });
            }
          } catch (e) {
            console.warn('⚠️ [VendorApp] Could not parse stored vendor data');
          }
        }
        
        setStatus('active');
        setIsLoading(false);
        isCheckingStatus.current = false;
        return; // ✅ FIX: Return early to prevent further API calls
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
        let onboardingStatus = identity.onboarding_status;
        console.log('📊 [VendorApp] Onboarding status from API:', onboardingStatus);
        
        // ✅ CRITICAL: Check existing status - don't overwrite ACTIVATED/APPROVED with lower status
        const existingStatus = localStorage.getItem('vendorApplicationStatus');
        
        // ✅ CRITICAL FIX: Don't overwrite ACTIVATED/APPROVED with INIT or lower status
        if (onboardingStatus) {
          if (existingStatus === 'ACTIVATED' || existingStatus === 'APPROVED') {
            // Only update if new status is also ACTIVATED/APPROVED (don't downgrade)
            if (onboardingStatus === 'ACTIVATED' || onboardingStatus === 'APPROVED') {
              localStorage.setItem('vendorApplicationStatus', onboardingStatus);
              console.log('✅ [VendorApp] Updated status to', onboardingStatus);
            } else {
              console.log('⚠️ [VendorApp] Keeping existing ACTIVATED/APPROVED status, not overwriting with', onboardingStatus);
            }
          } else {
            // No existing status or lower status - update normally
            localStorage.setItem('vendorApplicationStatus', onboardingStatus);
            console.log('📊 [VendorApp] Updated status to', onboardingStatus);
          }
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
              // Profile returned null vendor - use identity.id (vendors must not call /admin/vendors; 403)
              console.log('⚠️ [VendorApp] Profile returned null vendor, using identity ID:', identity.id);
              vendorId = identity.id;
              vendorRecordExists = false;
            }
          } catch (profileError: any) {
            console.warn('⚠️ [VendorApp] Could not fetch vendor profile, using identity ID:', profileError.message);
            // Continue with identity.id as fallback
            vendorRecordExists = false;
          }
        }
        
        // Update localStorage with identity and application data
        // ✅ FIX GAP 1.1: Simplified and prioritized role ID resolution
        // PRIORITY: API response is the source of truth, localStorage is ONLY for offline fallback
        // The backend should always return role from identity.selected_role_id
        const resolvedRoleId = 
          identity.selected_role_id || // 1. PRIMARY: From identity table (backend source of truth)
          role?.id ||                   // 2. From role object returned by API
          application?.role_id ||       // 3. From application record
          null;
        
        // ✅ ONLY use localStorage as a last resort when API fails (handled in catch block)
        // Do NOT include localStorage in the primary resolution chain
        // This prevents stale localStorage data from overriding fresh API data
        
        console.log('🔍 [VendorApp] Role ID resolution (simplified):', {
          'identity.selected_role_id': identity.selected_role_id,
          'role.id': role?.id,
          'application.role_id': application?.role_id,
          'resolvedRoleId': resolvedRoleId,
          'source': identity.selected_role_id ? 'identity' : (role?.id ? 'role_object' : 'application'),
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
          // Wireframe: Show "You're approved" screen with Get Started, then dashboard
          console.log('✅ [VendorApp] Vendor is APPROVED, showing approved setup screen (Get Started)');
          setStatus('approved');
          vendorData.isActive = true;
          vendorData.status = 'approved';
          // Don't set to 'active' here - user must click Get Started first
        } else if (onboardingStatus === 'UNDER_REVIEW') {
          setStatus('pending');
          vendorData.status = 'pending';
          vendorData.applicationStatus = 'under_review';
        } else if (onboardingStatus === 'REJECTED') {
          setStatus('rejected');
          vendorData.status = 'rejected';
          // ✅ FIX GAP VO-2: Use feedback object for rejection reason
          const feedback = (application as any)?.feedback;
          setApplicationData({
            rejectionReason: feedback?.rejectionReason || application?.rejection_reason || 'Your application was not approved.',
            allowResubmit: true,
            reviewedAt: feedback?.reviewedAt || application?.reviewed_at,
          });
        } else if (onboardingStatus === 'CLARIFICATION_REQUIRED') {
          setStatus('clarification');
          vendorData.status = 'clarification';
          // ✅ FIX GAP VO-1: Use feedback object from API response (preferred) or fallback to application fields
          const feedback = (application as any)?.feedback;
          setApplicationData({
            clarificationNotes: feedback?.clarificationNote || application?.admin_comments || application?.clarification_notes || 'Please provide additional information.',
            reviewerName: feedback?.reviewedBy || application?.reviewed_by || 'Admin',
            reviewedAt: feedback?.reviewedAt || application?.reviewed_at,
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
        const bizName = (vendorData as any).business_name || (vendorData as any).businessName || '';
        if (bizName) {
          localStorage.setItem('vendorName', bizName);
          localStorage.setItem('businessName', bizName);
        }
        
        console.log('✅ [VendorApp] Status updated:', {
          onboardingStatus,
          frontendStatus: status,
          vendorId: vendorData.id
        });
      }
    } catch (err: any) {
      console.error('❌ [VendorApp] Error checking vendor status:', err);
      
      // ✅ FIX: Fallback to stored data on error (e.g. 401 from onboarding/status); never leave user stuck on loading
      const storedStatus = localStorage.getItem('vendorApplicationStatus');
      const storedVendor = localStorage.getItem('vendorData');
      const knownStatuses: VendorStatus[] = ['new', 'profile_incomplete', 'submitted', 'pending', 'approved', 'approved_services', 'rejected', 'clarification', 'active'];

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
          const onboardingFromVendor = vendor.onboarding_status || vendor.onboardingStatus;
          const isActiveFromVendor = vendor.isActive === true || vendor.status === 'active' || vendor.status === 'approved';

          if (storedStatus) {
            if (storedStatus === 'APPROVED' || storedStatus === 'ACTIVATED') {
              setStatus('active');
            } else if (storedStatus === 'UNDER_REVIEW') {
              setStatus('pending');
            } else if (storedStatus === 'REJECTED') {
              setStatus('rejected');
            } else if (storedStatus === 'CLARIFICATION_REQUIRED') {
              setStatus('clarification');
            } else if (knownStatuses.includes(storedStatus as VendorStatus)) {
              setStatus(storedStatus as VendorStatus);
            } else {
              // INIT, FORM_PENDING, ROLE_PENDING etc. → show role/onboarding (avoid stuck "Loading your profile...")
              setStatus('new');
            }
          } else if (isActiveFromVendor || onboardingFromVendor === 'ACTIVATED' || onboardingFromVendor === 'APPROVED') {
            setStatus('active');
            localStorage.setItem('vendorApplicationStatus', onboardingFromVendor || 'ACTIVATED');
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
        setStatus('new');
      }
    } finally {
      setIsLoading(false);
      isCheckingStatus.current = false;
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
      const roleResponse = await apiClient.post<any>('/vendor/onboarding/select-role', { phone, role_id: role });
      console.log('✅ Role saved');
      
      // Step 2: Determine vendor type based on role configuration
      // Fetch role details to check supported vendor types
      let vendorType = 'business'; // Default fallback
      try {
        const rolesResponse = await apiClient.get<any>('/config/roles');
        if (rolesResponse?.roles) {
          const selectedRoleData = rolesResponse.roles.find((r: any) => 
            r.id === role || r.name === role || r.roleCode === role
          );
          if (selectedRoleData) {
            const vendorConfig = selectedRoleData.vendorConfiguration;
            const supportedTypes = selectedRoleData.config?.vendorTypes || [];
            
            // If role has vendorConfiguration set (solo or business), use it
            if (vendorConfig === 'solo') {
              vendorType = 'solo';
            } else if (vendorConfig === 'business') {
              vendorType = 'business';
            } else if (supportedTypes.length === 1) {
              // If only one type is supported, use it
              vendorType = supportedTypes[0];
            } else if (!supportedTypes.includes('business') && supportedTypes.includes('solo')) {
              // Role only supports solo
              vendorType = 'solo';
            }
            console.log('📋 Role vendor configuration:', { vendorConfig, supportedTypes, resolvedType: vendorType });
          }
        }
      } catch (roleErr) {
        console.warn('⚠️ Could not fetch role details, using default vendor type:', roleErr);
      }
      
      console.log('📤 Setting vendor type to:', vendorType);
      await apiClient.post('/vendor/onboarding/select-vendor-type', { phone, vendor_type: vendorType });
      console.log('✅ Vendor type saved');
      
      // Now set state and show onboarding form
      setSelectedRole(role);
      localStorage.setItem('vendorRole', role);
      localStorage.setItem('vendorType', vendorType);
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

  const handleCorrectAndResubmit = async () => {
    const roleId = vendorData?.roleId || vendorData?.role_id || (typeof window !== 'undefined' ? localStorage.getItem('vendorRole') : null);
    if (!roleId) {
      console.error('[VendorApp] No roleId for clarification resubmit');
      alert('Could not determine your role. Please refresh the page.');
      return;
    }
    const applicationId = vendorData?.application_id || vendorData?.application?.id || applicationData?.id || vendorData?.id || session.vendorId;
    try {
      if (applicationId) {
        const data = await apiClient.get<any>(`/vendor/application/status/${applicationId}`);
        const app = data?.application;
        const payload = app?.form_data ?? app?.application_payload ?? app ?? null;
        setResubmitInitialData(payload && typeof payload === 'object' ? payload : null);
      } else {
        setResubmitInitialData(vendorData?.application?.application_payload || null);
      }
    } catch (e) {
      console.warn('[VendorApp] Could not fetch application for pre-fill, using cached:', e);
      setResubmitInitialData(vendorData?.application?.application_payload || null);
    }
    setSelectedRole(roleId);
    setShowOnboarding(true);
    setStatus('new');
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
        onGoBack={() => {
          setStatus('new');
          setSelectedRole(null);
          setShowOnboarding(false);
          setVendorData(null);
          setApplicationData(null);
          localStorage.removeItem('vendorData');
          localStorage.removeItem('vendorApplicationStatus');
          localStorage.removeItem('vendorRole');
        }}
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

  // Approved: show "You're approved" screen with Get Started; on complete → dashboard
  if (status === 'approved' || status === 'approved_services') {
    return (
      <VendorApprovedSetup
        vendorId={vendorData?.id || session.vendorId || ''}
        roleId={vendorData?.roleId || vendorData?.role_id}
        onComplete={() => {
          setStatus('active');
          localStorage.setItem('vendorApplicationStatus', 'ACTIVATED');
        }}
      />
    );
  }

  // Active Vendor - Show VendorLandingPage (full portal), lazy-loaded to avoid TDZ in dashboard chunk
  if (status === 'active') {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        }
      >
        <VendorLandingPage
          vendorId={vendorData?.id || session.vendorId || ''}
          phone={session.phone}
          initialVendorData={vendorData}
          vendorType={vendorData?.vendorType}
          serviceStyle={vendorData?.serviceStyle}
        />
      </Suspense>
    );
  }

  // Onboarding Flow - Load dynamic form directly from DB based on selected role
  // No Solo/Business selection - all vendors use the same dynamic form for their role
  if (showOnboarding && selectedRole) {
    // Store role for onboarding flow to read
    localStorage.setItem('vendorSelectedRole', selectedRole);
    
    // Pre-fill from resubmit (Go back to onboarding form) or from cached application
    const initialFormData = resubmitInitialData ?? vendorData?.application?.application_payload ?? null;
    
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
            
            // ✅ FIX: Sanitize formData to remove invalid/placeholder fields
            const sanitizedFormData: Record<string, any> = {};
            const invalidFieldPatterns = ['new_field', 'newfield', 'new-field'];
            const invalidValuePatterns = ['xxxxxxxx', 'placeholder'];
            
            for (const [key, value] of Object.entries(submissionData.formData || {})) {
              // Skip fields with placeholder names
              if (invalidFieldPatterns.some(pattern => key.toLowerCase().includes(pattern))) {
                console.warn(`⚠️ [VendorApp] Skipping invalid field: ${key}`);
                continue;
              }
              
              // Skip boolean values for fields that should be strings (e.g., phone: true)
              if (key === 'phone' && typeof value === 'boolean') {
                console.warn(`⚠️ [VendorApp] Skipping boolean phone field`);
                continue;
              }
              
              // Skip placeholder values
              if (typeof value === 'string' && invalidValuePatterns.some(pattern => value.toLowerCase().includes(pattern))) {
                console.warn(`⚠️ [VendorApp] Skipping placeholder value for ${key}: ${value}`);
                continue;
              }
              
              // Skip empty/null values (but keep false booleans and 0 numbers)
              if (value === null || value === undefined || value === '') {
                continue;
              }
              
              sanitizedFormData[key] = value;
            }
            
            // ✅ FIX: Sanitize documents to only include valid entries with URLs
            const validDocuments = Object.entries(submissionData.documents || {})
              .filter(([key, doc]: [string, any]) => {
                // Skip invalid document types
                if (invalidFieldPatterns.some(pattern => key.toLowerCase().includes(pattern))) {
                  console.warn(`⚠️ [VendorApp] Skipping invalid document type: ${key}`);
                  return false;
                }
                // Only include documents with valid URLs
                if (!doc?.url || doc.url.trim() === '') {
                  console.warn(`⚠️ [VendorApp] Skipping document without URL: ${key}`);
                  return false;
                }
                return true;
              })
              .map(([key, doc]: [string, any]) => ({
                type: key,
                name: doc?.name || key,
                url: doc?.url || '',
                size: doc?.size,
                mime_type: doc?.type,
              }));
            
            const payload = {
              phone,
              application_payload: {
                ...sanitizedFormData,
                roleId: selectedRole,
                location: submissionData.coordinates,
                coordinates: submissionData.coordinates,
                specializations: submissionData.specializations || [],
                agreedToTerms: submissionData.agreedToTerms || true,
              },
              uploaded_documents: validDocuments,
            };
            
            console.log('📤 [VendorApp] Sanitized payload:', JSON.stringify(payload, null, 2));

            const response = await apiClient.post<any>('/vendor/onboarding/submit-application', payload);
            
            if (response.success || response.applicationId) {
              setResubmitInitialData(null);
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
            // ✅ FIX: Properly extract error message from various error formats
            let errorMessage = 'Error submitting application';
            if (typeof error === 'string') {
              errorMessage = error;
            } else if (error?.message && typeof error.message === 'string') {
              errorMessage = error.message;
            } else if (error?.error && typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (error?.response?.data?.error) {
              errorMessage = error.response.data.error;
            } else if (typeof error === 'object') {
              try {
                errorMessage = JSON.stringify(error);
              } catch (e) {
                errorMessage = 'Error submitting application (unknown error)';
              }
            }
            console.error('❌ [VendorApp] Error message:', errorMessage);
            alert(errorMessage);
          }
        }}
        onBack={() => {
          setShowOnboarding(false);
          setSelectedRole(null);
          setResubmitInitialData(null);
        }}
      />
    );
  }

  // New Vendor - Role Selection (when loading done and status is 'new', or we have vendorData but unknown status – e.g. after 401 fallback)
  if (!isLoading && !selectedRole && (status === 'new' || vendorData)) {
    return <VendorRoleSelection onRoleSelect={handleRoleSelect} />;
  }

  // Default: still determining status – show loading only when we truly have no data (avoid infinite "Loading your profile..." after 401)
  return (
    <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600">Loading your profile...</p>
      </div>
    </div>
  );
}

