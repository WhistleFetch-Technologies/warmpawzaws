import { useState, useEffect } from 'react';
import { BehavioralServicesLanding } from './BehavioralServicesLanding';
import { ProblemGridSelector } from './ProblemGridSelector';
import { VendorDiscoveryByProblem } from './VendorDiscoveryByProblem';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

type ViewType = 
  | 'landing'
  | 'behavioral_center'
  | 'behavioral_home'
  | 'problem_grid'
  | 'problem_selected';

interface BehavioralServiceRouterProps {
  onBack: () => void;
  phone: string;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  data?: any;
}

export function BehavioralServiceRouter({ onBack, phone, onNavigate, onViewBooking, data }: BehavioralServiceRouterProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [customerId, setCustomerId] = useState<string>('');
  const [customerData, setCustomerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // ✅ Problem grid state
  const [selectedProblem, setSelectedProblem] = useState<any>(null);

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    loadCustomerData();
  }, [phone]);

  const loadCustomerData = async () => {
    try {
      const response = await fetch(`${API_BASE}/customer-by-phone/${phone}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` }
      });
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
      console.log(`🎯 [BEHAVIORAL-ROUTER] Fetching problem details for: ${problemId}`);
      
      const response = await fetch(
        `${API_BASE}/customer/universal-problem-discovery?problemGridId=${problemId}&roleId=pet_behaviourist`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [BEHAVIORAL-ROUTER] Problem fetched successfully:', result);
        
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
      } else {
        console.error('❌ [BEHAVIORAL-ROUTER] Failed to fetch problem details');
      }
    } catch (error) {
      console.error('❌ [BEHAVIORAL-ROUTER] Error fetching problem:', error);
    }
  };

  const handleNavigateLocal = (screen: string, data?: any) => {
    console.log('📍 [BEHAVIORAL-ROUTER] Navigating to:', screen, data);
    
    if (screen === 'behavioral_center') {
      // TODO: Implement behavioral center list view
      console.log('🚧 Behavioral center view - coming soon');
      alert('Behavioral center booking coming soon!');
    } else if (screen === 'behavioral_home') {
      // TODO: Implement behavioral at-home service view
      console.log('🚧 Behavioral at-home view - coming soon');
      alert('Behavioral at-home booking coming soon!');
    } else if (screen === 'problem_grid') {
      setCurrentView('problem_grid');
    } else if (screen === 'problem_selected') {
      const problemId = data?.problemId;
      if (problemId) {
        fetchProblemDetails(problemId);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (currentView === 'problem_grid') {
    return (
      <ProblemGridSelector
        roleId="pet_behaviourist"
        roleName="Pet Behaviourist"
        onBack={() => setCurrentView('landing')}
        onProblemSelect={(problem) => {
          console.log('✅ [BEHAVIORAL-ROUTER] Problem selected from grid:', problem);
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
        roleId="pet_behaviourist"
        roleName="Pet Behaviourist"
        onBack={() => setCurrentView('problem_grid')}
        onVendorSelect={(vendor) => {
          console.log('✅ [BEHAVIORAL-ROUTER] Behaviorist selected:', vendor);
          // For now, show alert - can be replaced with actual booking flow
          alert(`Selected: ${vendor.vendorName || vendor.businessName}\nBooking flow coming soon!`);
        }}
        customerId={customerId}
        phone={phone}
      />
    );
  }

  return (
    <BehavioralServicesLanding
      onBack={onBack}
      onNavigate={handleNavigateLocal}
      customerId={customerId}
      phone={phone}
    />
  );
}