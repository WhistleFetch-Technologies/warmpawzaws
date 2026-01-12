import { useState, useEffect } from 'react';
import { AdoptionCenterListView } from './adoption/AdoptionCenterListView';
import { AdoptionCenterProfileView } from './adoption/AdoptionCenterProfileView';
import { AdoptionPetListView } from './adoption/AdoptionPetListView';
import { AdoptionApplicationForm } from './adoption/AdoptionApplicationForm';
import { AdoptionConfirmation } from './adoption/AdoptionConfirmation';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { ArrowLeft, Heart, MapPin, Star } from 'lucide-react';

type ViewType = 
  | 'landing'
  | 'center_list'
  | 'center_profile'
  | 'pet_list'
  | 'application'
  | 'confirmation';

interface AdoptionServiceRouterProps {
  onBack: () => void;
  phone: string;
  onNavigate?: (screen: string, data?: any) => void;
}

export function AdoptionServiceRouter({ onBack, phone }: AdoptionServiceRouterProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [customerId, setCustomerId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  const [adoptionFlow, setAdoptionFlow] = useState<any>({
    centerId: null,
    centerName: null,
    petId: null,
    petData: null,
    applicationId: null
  });

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
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setAdoptionFlow({
      centerId: null,
      centerName: null,
      petId: null,
      petData: null,
      applicationId: null
    });
  };

  const handleNavigateLocal = (screen: string, data?: any) => {
    if (screen === 'center-details') {
      setAdoptionFlow((prev: any) => ({ 
        ...prev, 
        centerId: data?.id,
        centerName: data?.businessName 
      }));
      setCurrentView('center_profile');
    } else if (screen === 'view_pets') {
      setCurrentView('pet_list');
    } else if (screen === 'apply') {
      setAdoptionFlow((prev: any) => ({ 
        ...prev, 
        petId: data?.petId,
        petData: data?.petData 
      }));
      setCurrentView('application');
    }
  };

  const handleApplicationSubmit = async (applicationData: any) => {
    try {
      const payload = {
        customerPhone: phone,
        centerId: adoptionFlow.centerId,
        centerName: adoptionFlow.centerName,
        petId: adoptionFlow.petId,
        petName: adoptionFlow.petData?.name,
        petBreed: adoptionFlow.petData?.breed,
        petAge: adoptionFlow.petData?.age,
        ...applicationData
      };

      const response = await fetch(`${API_BASE}/customer/adoption-application`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        setAdoptionFlow((prev: any) => ({
          ...prev,
          applicationId: result.applicationId
        }));
        setCurrentView('confirmation');
      } else {
        alert('Failed to submit application. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting application:', error);
      alert('An error occurred. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  if (currentView === 'confirmation' && adoptionFlow.applicationId) {
    return (
      <AdoptionConfirmation
        applicationId={adoptionFlow.applicationId}
        petData={adoptionFlow.petData}
        centerName={adoptionFlow.centerName}
        onBackToHome={() => { resetFlow(); setCurrentView('landing'); }}
      />
    );
  }

  if (currentView === 'application' && adoptionFlow.petData) {
    return (
      <AdoptionApplicationForm
        phone={phone}
        petData={adoptionFlow.petData}
        onBack={() => setCurrentView('pet_list')}
        onSubmit={handleApplicationSubmit}
      />
    );
  }

  if (currentView === 'pet_list' && adoptionFlow.centerId) {
    return (
      <AdoptionPetListView
        phone={phone}
        centerId={adoptionFlow.centerId}
        centerName={adoptionFlow.centerName}
        onBack={() => setCurrentView('center_profile')}
        onNavigate={handleNavigateLocal}
      />
    );
  }

  if (currentView === 'center_profile' && adoptionFlow.centerId) {
    return (
      <AdoptionCenterProfileView
        phone={phone}
        centerId={adoptionFlow.centerId}
        onBack={() => setCurrentView('center_list')}
        onNavigate={handleNavigateLocal}
      />
    );
  }

  if (currentView === 'center_list') {
    return (
      <AdoptionCenterListView
        phone={phone}
        onBack={() => { resetFlow(); setCurrentView('landing'); }}
        onNavigate={handleNavigateLocal}
      />
    );
  }

  // Landing Page
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white max-w-md mx-auto">
      <div className="bg-gradient-to-br from-pink-500 to-rose-600 text-white px-6 pt-8 pb-16 relative">
        <button onClick={onBack} className="mb-4 flex items-center gap-2 text-white/90 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Adopt a Pet</h1>
            <p className="text-white/80 text-sm">Give a loving home</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
            <div className="text-2xl font-bold">200+</div>
            <div className="text-white/80 text-xs">Pets Available</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
            <div className="text-2xl font-bold">500+</div>
            <div className="text-white/80 text-xs">Adopted</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
            <div className="flex items-center gap-1 text-2xl font-bold">
              <Star className="w-4 h-4 fill-white" />
              4.9
            </div>
            <div className="text-white/80 text-xs">Happy Homes</div>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-white" 
             style={{
               borderTopLeftRadius: '50% 100%',
               borderTopRightRadius: '50% 100%',
             }}
        />
      </div>

      <div className="px-6 py-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-4">
          <h3 className="font-semibold mb-2">Why Adopt?</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <Heart className="w-4 h-4 text-pink-500 mt-0.5" />
              <span>Give a pet a second chance at life</span>
            </li>
            <li className="flex items-start gap-2">
              <Heart className="w-4 h-4 text-pink-500 mt-0.5" />
              <span>All pets are vaccinated & health-checked</span>
            </li>
            <li className="flex items-start gap-2">
              <Heart className="w-4 h-4 text-pink-500 mt-0.5" />
              <span>Free 30-day vet consultations</span>
            </li>
          </ul>
        </div>

        <button
          onClick={() => setCurrentView('center_list')}
          className="w-full bg-gradient-to-r from-pink-500 to-rose-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transition-all"
        >
          Find Your Perfect Match
        </button>
      </div>
    </div>
  );
}
