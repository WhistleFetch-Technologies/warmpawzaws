import { useState, useEffect } from 'react';
import { VendorAuth } from './vendor/VendorAuth';
import { VendorRoleSelection } from './vendor/VendorRoleSelection';
import { EnhancedVendorOnboarding } from './vendor/onboarding/EnhancedVendorOnboarding';
import { VendorLandingPage } from './vendor/VendorLandingPage';
import { StaffDashboard } from './staff/StaffDashboard';
import { SellerPortal } from './vendor/seller/SellerPortal';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useVendorNotificationService } from './vendor/useVendorNotificationService';

export function VendorApp() {
  const [session, setSession] = useState<any>(null);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [vendorRole, setVendorRole] = useState<string | null>(null);
  const [vendorRoleName, setVendorRoleName] = useState<string>('');
  const [vendorData, setVendorData] = useState<any>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isNewVendor, setIsNewVendor] = useState(false);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [authDataProcessed, setAuthDataProcessed] = useState(false);
  const [justSubmittedApplication, setJustSubmittedApplication] = useState(false); // ✅ NEW: Track fresh submission

  // Enable notification service for vendors
  useVendorNotificationService({
    vendorId: vendorData?.id || '',
    enabled: !!vendorData?.id && !showOnboarding && !showRoleSelection,
    onNewNotification: (notification) => {
      console.log('📬 Vendor received new notification:', notification);
      // Toast will be shown automatically by the service
    }
  });

  // DON'T check vendor on session change if auth data was already processed
  useEffect(() => {
    if (session?.phone && !authDataProcessed) {
      // Only run if we have a legacy session without user data
      if (!session.user && !session.profile) {
        checkExistingVendor(session.phone);
      }
    }
  }, [session, authDataProcessed]);

  const checkExistingVendor = async (phone: string) => {
    try {
      setIsCheckingStatus(true);
      
      console.log(`🔍 Checking vendor status for phone: ${phone}`);
      
      // USE NEW STATUS ENDPOINT - Get real-time status
      const statusResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/status/${phone}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        
        console.log('✅ Status response:', statusData);
        console.log('   📊 Status Details:', {
          hasApplication: statusData.hasApplication,
          vendorId: statusData.vendorId,
          status: statusData.status,
          isActive: statusData.isActive,
          setupCompleted: statusData.setupCompleted
        });
        
        if (statusData.hasApplication && statusData.vendorId) {
          // VENDOR EXISTS - Get full vendor profile
          console.log('✅ EXISTING VENDOR found:', statusData.vendorId);
          console.log('   - Name:', statusData.fullName);
          console.log('   - Role:', statusData.roleName);
          console.log('   - Status:', statusData.status);
          console.log('   - IsActive:', statusData.isActive);
          console.log('   - SetupCompleted:', statusData.setupCompleted);
          
          // Fetch full vendor data
          const vendorResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/find-by-phone/${phone}`,
            {
              headers: { 'Authorization': `Bearer ${publicAnonKey}` }
            }
          );
          
          if (vendorResponse.ok) {
            const vendorDataResponse = await vendorResponse.json();
            
            console.log('✅ Find-by-phone response:', vendorDataResponse);
            
            if (vendorDataResponse.vendor) {
              const vendor = vendorDataResponse.vendor;
              
              console.log('✅ Vendor full data loaded:', {
                id: vendor.id,
                name: vendor.fullName,
                roleId: vendor.roleId,
                status: vendor.status,
                isActive: vendor.isActive,
                setupCompleted: vendor.setupCompleted
              });
              
              // ✅ MIGRATION: If vendor doesn't have roleId, migrate them seamlessly
              if (!vendor.roleId && vendor.vendorType) {
                console.log('🔄 Migrating vendor to new role-based system...');
                try {
                  const migrateResponse = await fetch(
                    `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor/migrate/${phone}`,
                    {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${publicAnonKey}` }
                    }
                  );
                  
                  if (migrateResponse.ok) {
                    const migrateData = await migrateResponse.json();
                    setVendorData(migrateData.vendor);
                    console.log('✅ Vendor migrated successfully! RoleId:', migrateData.vendor.roleId);
                  } else {
                    setVendorData(vendor);
                  }
                } catch (error) {
                  console.error('⚠️ Migration failed, continuing with existing data:', error);
                  setVendorData(vendor);
                }
              } else {
                setVendorData(vendor);
              }
              
              setVendorRole(vendor.roleId || 'service-provider');
              setIsNewVendor(false);
              
              // Don't show role selection for existing vendors!
              setShowRoleSelection(false);
            }
          }
        } else {
          // NEW VENDOR - no profile exists
          console.log('🆕 NEW VENDOR - no profile found, showing role selection');
          console.log('   ❌ statusData.hasApplication:', statusData.hasApplication);
          console.log('   ❌ statusData.vendorId:', statusData.vendorId);
          console.log('   📋 Full statusData:', statusData);
          setIsNewVendor(true);
          setShowRoleSelection(true);
        }
      } else {
        // Error or vendor not found
        console.log('❌ STATUS RESPONSE FAILED - HTTP Status:', statusResponse.status);
        console.log('   Response:', await statusResponse.text());
        console.log('🆕 NEW VENDOR - showing role selection');
        setIsNewVendor(true);
        setShowRoleSelection(true);
      }
    } catch (error) {
      console.error('❌ Error checking existing vendor:', error);
      // On error, treat as new vendor
      setIsNewVendor(true);
      setShowRoleSelection(true);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleAuthSuccess = (authSession: any) => {
    console.log('🔐 Auth success:', authSession);
    console.log('🔐 Auth session keys:', Object.keys(authSession));
    console.log('🔐 Has user?', !!authSession.user);
    console.log('🔐 Has profile?', !!authSession.profile);
    console.log('🔐 Has phone?', !!authSession.phone);
    console.log('🔐 Is staff login?', !!authSession.isStaffLogin);
    console.log('🔐 Has staff?', !!authSession.staff);
    setSession(authSession);
    
    // ✅ HANDLE STAFF LOGIN
    if (authSession.isStaffLogin && authSession.staff) {
      console.log('👨‍⚕️ Staff login detected:', authSession.staff);
      console.log('   Staff ID:', authSession.staff.id);
      console.log('   Staff Name:', authSession.staff.fullName);
      console.log('   Staff Role:', authSession.staff.role);
      console.log('   Vendor ID:', authSession.staff.vendorId);
      
      // Staff login complete - skip all vendor checks
      setIsCheckingStatus(false);
      setAuthDataProcessed(true);
      return; // Don't proceed with vendor checks
    }
    
    // Extract user data from new auth system
    if (authSession.user) {
      // New auth system response
      const userData = authSession.user;
      const profileData = authSession.profile;
      const currentState = authSession.state;
      
      console.log('📊 User data:', { userData, profileData, currentState });
      console.log('📊 Profile Data Status:', profileData?.status);
      console.log('📊 Profile Data Setup Completed:', profileData?.setupCompleted);
      console.log('📊 Profile Data RoleId:', profileData?.roleId);
      console.log('📊 Current State:', currentState);
      
      if (profileData) {
        // Existing vendor - use actual roleId from profile
        console.log('✅ Found existing profile in auth response');
        setVendorData(profileData);
        setVendorRole(profileData.roleId || 'service-provider'); // ✅ USE ACTUAL ROLE ID
        setIsNewVendor(false);
        setHasExistingProfile(true);
        
        // ✅ DON'T show role selection for existing vendors!
        setShowRoleSelection(false);
      } else {
        // New vendor
        console.log('🆕 No profile in auth response - new vendor');
        setIsNewVendor(true);
        setShowRoleSelection(true);
      }
      
      setIsCheckingStatus(false);
      setAuthDataProcessed(true);
    } else {
      // Legacy phone-only auth (fallback)
      console.log('📞 Using legacy phone-only auth, checking existing vendor...');
      checkExistingVendor(authSession.phone);
    }
  };

  const handleRoleSelect = async (role: string) => {
    console.log('👤 Role selected:', role);
    setVendorRole(role);
    setShowRoleSelection(false);
    
    // Fetch role details to get the name
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const selectedRole = data.roles.find((r: any) => r.id === role);
        if (selectedRole) {
          setVendorRoleName(selectedRole.name);
        }
      }
    } catch (error) {
      console.error('Error fetching role name:', error);
    }
    
    // Show dynamic onboarding for all roles
    setShowOnboarding(true);
  };

  const handleOnboardingComplete = (data: any) => {
    console.log('✅ [VendorApp] Onboarding complete:', data);
    console.log('✅ [VendorApp] Data structure:', {
      hasSuccess: !!data.success,
      hasStatus: !!data.status,
      statusValue: data.status,
      hasApplicationId: !!data.applicationId,
      hasVendorId: !!data.vendorId
    });
    
    // ✅ NEW: Check if this is a fresh submission
    if (data.success && data.status === 'submitted' && data.vendorId) {
      console.log('✅ [VendorApp] Fresh submission detected - routing to VendorLandingPage with submission data');
      
      // Create a minimal vendor data object for immediate routing
      const newVendorData = {
        id: data.vendorId,
        phone: session?.phone || '',
        roleId: data.roleId || vendorRole,
        applicationId: data.applicationId,
        status: 'pending', // Backend creates as 'pending'
        applicationStatus: 'pending',
        applicationSubmittedAt: new Date().toISOString(),
        isActive: false,
        setupCompleted: false,
        ...data
      };
      
      setVendorData(newVendorData);
      setIsNewVendor(false);
      setShowOnboarding(false);
      setJustSubmittedApplication(true); // ✅ Set justSubmittedApplication to true
      
      console.log('✅ [VendorApp] Vendor data set, will route to VendorLandingPage on next render');
      return;
    }
    
    // ✅ LEGACY: Reload vendor data for other cases
    console.log('📤 [VendorApp] Reloading vendor data from server...');
    if (session?.phone) {
      checkExistingVendor(session.phone);
    }
    
    setShowOnboarding(false);
  };

  // Loading state while checking
  if (!session) {
    return <VendorAuth onAuthSuccess={handleAuthSuccess} />;
  }

  if (isCheckingStatus) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // ✅ STAFF DASHBOARD - Show staff dashboard if this is a staff login
  if (session?.isStaffLogin && session?.staff) {
    console.log('🎯 Rendering StaffDashboard for:', session.staff.fullName);
    return (
      <StaffDashboard 
        staff={session.staff}
        onLogout={() => {
          console.log('👋 Staff logging out');
          setSession(null);
          setAuthDataProcessed(false);
        }}
      />
    );
  }

  // Show role selection ONLY for new vendors
  if (showRoleSelection && isNewVendor) {
    return <VendorRoleSelection onRoleSelect={handleRoleSelect} />;
  }

  // New vendor going through onboarding
  if (showOnboarding && isNewVendor) {
    return (
      <EnhancedVendorOnboarding 
        roleId={vendorRole || ''} 
        roleName={vendorRoleName || 'Vendor'} 
        phone={session.phone} 
        onComplete={handleOnboardingComplete}
        onBack={() => {
          // Go back to role selection
          setShowOnboarding(false);
          setShowRoleSelection(true);
          setVendorRole(null);
          setVendorRoleName('');
        }}
      />
    );
  }

  // EXISTING VENDOR - Check if pet_product seller or regular vendor
  if (vendorData && !isNewVendor) {
    console.log('🎯 Routing EXISTING vendor');
    console.log('   Vendor Role:', vendorData.roleId);
    console.log('   Vendor Status:', vendorData.status);
    console.log('   Is Active:', vendorData.isActive);
    console.log('   Setup Completed:', vendorData.setupCompleted);
    
    // ✅ PET PRODUCT SELLER - Route to Seller Portal if approved and active
    if (vendorData.roleId === 'pet_product' && vendorData.isActive && vendorData.status === 'approved') {
      console.log('🛍️ Routing to Seller Portal for pet_product seller');
      return (
        <SellerPortal
          vendorData={vendorData}
          onLogout={() => {
            console.log('👋 Seller logging out');
            setSession(null);
            setVendorData(null);
            setAuthDataProcessed(false);
          }}
        />
      );
    }
    
    // ✅ OTHER VENDORS - use VendorLandingPage for smart routing
    console.log('✅ Forwarding to VendorLandingPage for smart routing');
    
    // VendorLandingPage will handle all routing based on vendor status
    return (
      <VendorLandingPage
        vendorId={vendorData.id}
        phone={session.phone}
        vendorType={vendorData.vendorType}
        serviceStyle={vendorData.serviceStyle}
        initialVendorData={vendorData}
        justSubmitted={justSubmittedApplication} // ✅ Pass justSubmittedApplication
        onComplete={() => {
          // Reload vendor data after completing setup
          checkExistingVendor(session.phone);
        }}
      />
    );
  }

  // Fallback - show VendorLandingPage which will handle the routing
  return (
    <VendorLandingPage
      vendorId={''}
      phone={session?.phone || ''}
      vendorType={''}
      serviceStyle={''}
      initialVendorData={null}
      onComplete={() => {
        if (session?.phone) {
          checkExistingVendor(session.phone);
        }
      }}
    />
  );
}