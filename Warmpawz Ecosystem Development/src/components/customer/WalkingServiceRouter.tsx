import { useState, useEffect } from 'react';
import { WalkingServicesLanding } from './WalkingServicesLanding';
import { WalkerService } from './WalkerService';
import { ProblemGridSelector } from './ProblemGridSelector';
import { VendorDiscoveryByProblem } from './VendorDiscoveryByProblem';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

type ViewType = 
  | 'landing'
  | 'walker_service'
  | 'problem_grid'
  | 'problem_selected';

interface WalkingServiceRouterProps {
  onBack: () => void;
  phone: string;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  data?: any;
}

export function WalkingServiceRouter({ onBack, phone, onNavigate, onViewBooking, data }: WalkingServiceRouterProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [customerId, setCustomerId] = useState<string>('');
  const [customerData, setCustomerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // ✅ Problem grid state
  const [selectedProblem, setSelectedProblem] = useState<any>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

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
      console.log(`🎯 [WALKING-ROUTER] Fetching problem details for: ${problemId}`);
      
      const response = await fetch(
        `${API_BASE}/customer/universal-problem-discovery?problemGridId=${problemId}&roleId=pet_walker`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [WALKING-ROUTER] Problem fetched successfully:', result);
        
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
        console.error('❌ [WALKING-ROUTER] Failed to fetch problem details');
      }
    } catch (error) {
      console.error('❌ [WALKING-ROUTER] Error fetching problem:', error);
    }
  };

  const handleNavigateLocal = (screen: string, data?: any) => {
    console.log('📍 [WALKING-ROUTER] Navigating to:', screen, data);
    
    if (screen === 'walker_service') {
      setCurrentView('walker_service');
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (currentView === 'walker_service') {
    return (
      <WalkerService
        phone={phone}
        onBack={() => setCurrentView('landing')}
      />
    );
  }

  if (currentView === 'problem_grid') {
    return (
      <ProblemGridSelector
        roleId="pet_walker"
        roleName="Dog Walker"
        onBack={() => setCurrentView('landing')}
        onProblemSelect={(problem) => {
          console.log('✅ [WALKING-ROUTER] Problem selected from grid:', problem);
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
        roleId="pet_walker"
        roleName="Dog Walker"
        onBack={() => setCurrentView('problem_grid')}
        onVendorSelect={(vendor) => {
          console.log('✅ [WALKING-ROUTER] Walker selected:', vendor);
          // Navigate to walker service with pre-selected walker
          setCurrentView('walker_service');
        }}
        customerId={customerId}
        phone={phone}
      />
    );
  }

  return (
    <WalkingServicesLanding
      onBack={onBack}
      onNavigate={handleNavigateLocal}
      customerId={customerId}
      phone={phone}
    />
  );
}