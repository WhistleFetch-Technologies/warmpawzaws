import { useState, useEffect } from 'react';
import { SitterServicesLanding } from './SitterServicesLanding';
import { BookingFlowDispatcher } from './BookingFlowDispatcher';
import { ProblemGridSelector } from './ProblemGridSelector';
import { VendorDiscoveryByProblem } from './VendorDiscoveryByProblem';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

type ViewType = 
  | 'landing'
  | 'problem_grid'
  | 'problem_selected'
  | 'booking_flow';

interface SitterServiceRouterProps {
  onBack: () => void;
  phone: string;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  data?: any;
}

export function SitterServiceRouter({ onBack, phone, onNavigate, onViewBooking, data }: SitterServiceRouterProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [customerId, setCustomerId] = useState<string>('');
  const [customerData, setCustomerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProblem, setSelectedProblem] = useState<any>(null);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadCustomerData();
  }, [phone]);

  const loadCustomerData = async () => {
    try {
      const response = await fetch(`${API_BASE}/customer-by-phone/${phone}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setCustomerId(data.customerId);
        setCustomerData(data.customer);
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProblemDetails = async (problemId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/customer/universal-problem-discovery?problemGridId=${problemId}&roleId=pet_sitter`,
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
        setCurrentView('problem_selected');
      }
    } catch (error) {
      console.error('Error fetching problem:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (currentView === 'problem_grid') {
    return (
      <ProblemGridSelector
        roleId="pet_sitter"
        roleName="Pet Sitter"
        onBack={() => setCurrentView('landing')}
        onProblemSelect={(problem) => {
          setSelectedProblem(problem);
          setCurrentView('problem_selected');
        }}
        customerId={customerId}
        phone={phone}
      />
    );
  }

  if (currentView === 'problem_selected' && selectedProblem) {
    return (
      <VendorDiscoveryByProblem
        problem={selectedProblem}
        roleId="pet_sitter"
        roleName="Pet Sitter"
        onBack={() => setCurrentView('problem_grid')}
        onVendorSelect={(vendor) => {
          setSelectedVendor(vendor);
          setCurrentView('booking_flow');
        }}
        customerId={customerId}
        phone={phone}
      />
    );
  }

  if (currentView === 'booking_flow' && selectedVendor) {
    return (
      <BookingFlowDispatcher
        serviceType="sitter"
        vendorId={selectedVendor.id}
        vendorName={selectedVendor.businessName}
        onBack={() => setCurrentView('problem_selected')}
        onComplete={(booking) => {
          if (onViewBooking && booking?.id) {
            onViewBooking(booking.id, booking.petId);
          }
        }}
        customerId={customerId}
        phone={phone}
      />
    );
  }

  return (
    <SitterServicesLanding
      onBack={onBack}
      onNavigate={(screen, data) => {
        if (screen === 'problem_grid') {
          setCurrentView('problem_grid');
        } else if (screen === 'sitter_service' && data?.vendorId) {
          setSelectedVendor({ id: data.vendorId, businessName: data.vendorName });
          setCurrentView('booking_flow');
        } else if (onNavigate) {
          onNavigate(screen, data);
        }
      }}
      customerId={customerId}
      phone={phone}
    />
  );
}

