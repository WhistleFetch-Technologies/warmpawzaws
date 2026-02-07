import { useState, useEffect } from 'react';
import { UniversalServicesLanding } from './UniversalServicesLanding';
import { VetClinicListViewEnhanced } from './vet/VetClinicListViewEnhanced'; // We can reuse this or make a universal list view
import { VetCenterProfileView } from './vet/VetCenterProfileView'; // We can reuse this or make a universal profile view
import { VendorDiscoveryByProblem } from './VendorDiscoveryByProblem';
import { ProblemGridSelector } from './ProblemGridSelector';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

// Reusing Vet/Grooming components for booking flow for now
// ideally we should have UniversalBookingFlow
import { VetBookingRouter } from './vet/VetBookingRouter'; 
import { VetDoctorDetails } from './vet/VetDoctorDetails';

type ViewType = 
  | 'landing'
  | 'problem_grid'
  | 'vendor_discovery'
  | 'vendor_list'
  | 'vendor_profile'
  | 'staff_details'
  | 'booking_flow';

interface UniversalServiceRouterProps {
  roleId: string;
  roleName: string;
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
}

export function UniversalServiceRouter({ 
  roleId, 
  roleName, 
  phone, 
  onBack, 
  onNavigate,
  onViewBooking 
}: UniversalServiceRouterProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [customerId, setCustomerId] = useState<string>('');
  const [selectedProblem, setSelectedProblem] = useState<any>(null);
  const [bookingFlow, setBookingFlow] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    loadCustomerData();
  }, [phone]);

  const loadCustomerData = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/customer-by-phone/${phone}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setCustomerId(data.customerId);
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateInternal = (screen: string, data?: any) => {
    console.log(`📍 [UNIVERSAL-ROUTER:${roleId}] Navigating to:`, screen, data);

    if (screen === 'problem_grid') {
      setCurrentView('problem_grid');
    } else if (screen === 'problem_selected') {
      const problemId = data?.problemId;
      if (problemId) {
        fetchProblemDetails(problemId);
      }
    } else if (screen === 'vendor_list' || screen === 'clinic_visit' || screen === 'center_visit') {
      // Generic list view
      setCurrentView('vendor_list');
      setBookingFlow(prev => ({ ...prev, serviceType: 'center' }));
    } else if (screen === 'home_visit') {
      // Generic list view but for home service
      // For now we reuse vendor list but with filters? 
      // actually VetClinicListViewEnhanced handles search nicely.
      setCurrentView('vendor_list'); 
      setBookingFlow(prev => ({ ...prev, serviceType: 'home' }));
    } else if (screen === 'vendor_profile' || screen === 'clinic_profile') {
      setCurrentView('vendor_profile');
      setBookingFlow(prev => ({
        ...prev,
        vendorId: data?.vendorId || data?.clinicId || data?.id,
        vendorName: data?.businessName || data?.name
      }));
    } else if (screen === 'staff_details' || screen === 'doctor_details') {
      setCurrentView('staff_details');
      setBookingFlow(prev => ({
        ...prev,
        staffId: data?.id || data?.doctorId,
        staff: data?.doctor || data,
        vendorId: data?.vendorId || data?.clinicId // Ensure vendor context
      }));
    } else if (screen === 'booking' || screen === 'vet_booking') {
      setCurrentView('booking_flow');
      setBookingFlow(prev => ({
        ...prev,
        selectedService: data?.service,
        serviceType: data?.serviceType || prev.serviceType || 'center'
      }));
    } else {
      // Pass up if not handled here
      if (onNavigate) onNavigate(screen, data);
    }
  };

  const fetchProblemDetails = async (problemId: string) => {
    try {
        // Reusing the universal problem discovery endpoint
        const response = await fetch(
            `${API_BASE}/customer/universal-problem-discovery?problemGridId=${problemId}&roleId=${roleId}`,
            { headers: { Authorization: `Bearer ${publicAnonKey}` } }
        );
        
        if (response.ok) {
            const result = await response.json();
            const problemData = {
                id: result.problemGrid?.id || problemId,
                displayName: result.problemGrid?.displayName || problemId,
                description: result.problemGrid?.description || '',
                icon: result.problemGrid?.icon || '',
                specialists: result.specialists || [],
                totalCount: result.totalCount || 0
            };
            setSelectedProblem(problemData);
            setCurrentView('vendor_discovery');
        }
    } catch (error) {
        console.error('Error fetching problem details:', error);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  // --- VIEWS ---

  if (currentView === 'problem_grid') {
    return (
      <ProblemGridSelector
        roleId={roleId}
        roleName={roleName}
        onBack={() => setCurrentView('landing')}
        onProblemSelect={(problem) => {
            setSelectedProblem(problem);
            setCurrentView('vendor_discovery');
        }}
        customerId={customerId}
        phone={phone}
      />
    );
  }

  if (currentView === 'vendor_discovery' && selectedProblem) {
      return (
          <VendorDiscoveryByProblem
            roleId={roleId}
            roleName={roleName}
            problem={selectedProblem}
            onBack={() => setCurrentView('problem_grid')}
            onVendorSelect={(vendor) => {
                if (vendor.specialists && vendor.specialists.length > 0) {
                     handleNavigateInternal('staff_details', vendor.specialists[0]);
                } else {
                     handleNavigateInternal('vendor_profile', vendor);
                }
            }}
            customerId={customerId}
            phone={phone}
          />
      );
  }

  if (currentView === 'vendor_list') {
      // Reuse VetClinicListViewEnhanced but pass roleId to filter
      // We might need to update VetClinicListViewEnhanced to accept roleId prop
      // For now, let's assume we can pass it.
      // Actually, VetClinicListViewEnhanced is hardcoded for clinics. 
      // We should probably create a UniversalVendorListView.
      // For now, let's use a placeholder or reuse if possible.
      
      return (
          <VetClinicListViewEnhanced 
             phone={phone}
             onBack={() => setCurrentView('landing')}
             onNavigate={handleNavigateInternal}
             // We need to update this component to accept roleId filter!
             // For now it shows clinics.
          />
      );
  }

  if (currentView === 'vendor_profile' && bookingFlow.vendorId) {
      // Reuse VetCenterProfileView 
      return (
          <VetCenterProfileView
            phone={phone}
            centerId={bookingFlow.vendorId}
            onBack={() => setCurrentView('vendor_list')}
            onNavigate={handleNavigateInternal}
          />
      );
  }

  if (currentView === 'staff_details' && bookingFlow.staffId) {
      // Reuse VetDoctorDetails
      return (
          <VetDoctorDetails
            phone={phone}
            doctorId={bookingFlow.staffId}
            doctor={bookingFlow.staff}
            onBack={() => setCurrentView('vendor_profile')} // or list
            onNavigate={handleNavigateInternal}
          />
      );
  }

  if (currentView === 'booking_flow' && bookingFlow.staffId) {
      // Reuse VetBookingRouter
      return (
          <VetBookingRouter
             phone={phone}
             doctorId={bookingFlow.staffId}
             selectedService={bookingFlow.selectedService}
             serviceType={bookingFlow.serviceType}
             onBack={() => setCurrentView('staff_details')}
             onNavigate={handleNavigateInternal}
             onViewBooking={onViewBooking}
          />
      );
  }

  return (
    <UniversalServicesLanding
      roleId={roleId}
      roleName={roleName}
      onBack={onBack}
      onNavigate={handleNavigateInternal}
      customerId={customerId}
      phone={phone}
    />
  );
}
