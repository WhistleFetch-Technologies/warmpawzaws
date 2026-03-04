'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Video, Clock, Zap, Calendar, ChevronRight,
  User, Star, Shield, Phone, AlertCircle, PawPrint, Plus,
  Apple, UtensilsCrossed
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

import { UniversalServiceProviderList } from '../shared/UniversalServiceProviderList';
import { UniversalProviderProfile } from '../shared/UniversalProviderProfile';
import { InstantTeleQueue } from '../InstantTele/InstantTeleQueue';

// ============================================================================
// TYPES
// ============================================================================

interface Provider {
  providerId: string;
  providerType: 'vendor' | 'staff' | 'individual';
  vendorId?: string;
  vendorName?: string;
  staffId?: string;
  name: string;
  photo?: string;
  photos?: string[];
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  role?: string;
  specialization?: string;
  qualifications?: string;
  degree?: string;
  bio?: string;
  experienceYears?: number;
  rating: number;
  reviewCount: number;
  distance?: number | null;
  isVerified?: boolean;
  isOnline?: boolean;
  nextAvailableSlot?: string;
  services: any[];
  amenities?: string[];
  languages?: string[];
  consultationFee?: number;
}

interface PlatformService {
  id: string;
  serviceId: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
}

interface Pet {
  id: string;
  name: string;
  type: string;
  breed?: string;
  photo?: string;
}

interface NutritionistTeleRouterProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

type FlowStep = 
  | 'mode-selection'      // Choose Scheduled vs Instant
  | 'provider-list'       // For Scheduled: list of providers
  | 'provider-profile'    // For Scheduled: provider profile + services
  | 'instant-problem'     // For Instant: select problem/need
  | 'instant-pet'         // For Instant: select pet
  | 'instant-queue'       // For Instant: queue waiting
  | 'payment'             // Payment page
  | 'confirmation';       // Booking confirmed

// ============================================================================
// NUTRITIONIST PROBLEMS
// ============================================================================

const NUTRITION_PROBLEMS = [
  { id: 'weight-loss', name: 'Weight Loss', icon: '⚖️', description: 'Help your pet lose weight safely' },
  { id: 'weight-gain', name: 'Weight Gain', icon: '📈', description: 'Healthy weight gain plan' },
  { id: 'allergies', name: 'Food Allergies', icon: '🤧', description: 'Identify and manage food allergies' },
  { id: 'digestive', name: 'Digestive Issues', icon: '🥣', description: 'Stomach or digestion problems' },
  { id: 'senior-diet', name: 'Senior Pet Diet', icon: '👴', description: 'Nutrition for aging pets' },
  { id: 'puppy-kitten', name: 'Puppy/Kitten Diet', icon: '🐕', description: 'Proper nutrition for young pets' },
  { id: 'home-food', name: 'Home Cooked Meals', icon: '🍳', description: 'Homemade food recipes' },
  { id: 'general', name: 'General Consultation', icon: '🩺', description: 'Overall nutrition advice' },
];

// ============================================================================
// MODE SELECTION SCREEN
// ============================================================================

interface ModeSelectionProps {
  onSelectScheduled: () => void;
  onBack: () => void;
}

/** Nutritionist tele: scheduled only. Instant video calling is Vet-only. */
function ModeSelection({ onSelectScheduled, onBack }: ModeSelectionProps) {
  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto">
      {/* Header - Consistent Design */}
      <div className="px-4 pt-12 pb-8">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {/* Title Section with 2D Icon */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0">
            <UtensilsCrossed className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white leading-tight">Pet Nutritionist</h1>
            <p className="text-white/80 text-sm mt-0.5">Expert diet & nutrition advice</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center">
            <div className="text-lg font-bold text-white">24/7</div>
            <div className="text-white/70 text-xs">Available</div>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center">
            <div className="text-lg font-bold text-white">₹300</div>
            <div className="text-white/70 text-xs">Starts at</div>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold text-white">
              <Star className="w-3.5 h-3.5 fill-white" />
              4.9
            </div>
            <div className="text-white/70 text-xs">Rating</div>
          </div>
        </div>
      </div>

      {/* Main Content - White Card with Top Radius */}
      <div className="bg-white rounded-t-[32px] px-4 pt-6 min-h-[calc(100vh-260px)] pb-8">
        {/* Section Title */}
        <h2 className="text-base font-semibold text-gray-900 mb-4">Book a video consultation</h2>

        {/* Scheduled only - Instant is Vet-only */}
        <button
          className="w-full p-4 rounded-2xl text-left transition-all border-2 border-transparent hover:border-blue-400 hover:shadow-md bg-blue-50"
          onClick={onSelectScheduled}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base text-gray-900 mb-1">Scheduled Consultation</h3>
              <p className="text-sm text-gray-600 leading-snug">
                Choose your preferred nutritionist and book a time slot
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  Choose expert
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Book ahead
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
          </div>
        </button>

        {/* Info Card */}
        <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
          <Apple className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Includes:</span> Personalized diet plan, meal recommendations, and follow-up support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// INSTANT PROBLEM SELECTION
// ============================================================================

interface InstantProblemSelectionProps {
  onSelectProblem: (problemId: string, problemName: string) => void;
  onBack: () => void;
}

function InstantProblemSelection({ onSelectProblem, onBack }: InstantProblemSelectionProps) {
  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto">
      {/* Header */}
      <div className="px-4 pt-12 pb-8">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white leading-tight">Instant Consultation</h1>
            <p className="text-white/80 text-sm mt-0.5">What's your concern?</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-t-[32px] px-4 pt-6 min-h-[calc(100vh-180px)] pb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Select your concern</h2>
        
        <div className="grid grid-cols-2 gap-3">
          {NUTRITION_PROBLEMS.map((problem) => (
            <button
              key={problem.id}
              onClick={() => onSelectProblem(problem.id, problem.name)}
              className="p-4 rounded-2xl text-left transition-all border-2 border-transparent hover:border-[#FF8C42] hover:shadow-md bg-slate-50"
            >
              <div className="text-3xl mb-2">{problem.icon}</div>
              <h3 className="font-semibold text-sm text-gray-900">{problem.name}</h3>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{problem.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// INSTANT PET SELECTION
// ============================================================================

interface InstantPetSelectionProps {
  phone: string;
  selectedProblem: string;
  pets: Pet[];
  loading: boolean;
  onSelectPet: (pet: Pet) => void;
  onAddPet: () => void;
  onBack: () => void;
}

function InstantPetSelection({ phone, selectedProblem, pets, loading, onSelectPet, onAddPet, onBack }: InstantPetSelectionProps) {
  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto">
      {/* Header */}
      <div className="px-4 pt-12 pb-8">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0">
            <PawPrint className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white leading-tight">Select Pet</h1>
            <p className="text-white/80 text-sm mt-0.5">{selectedProblem} Consultation</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-t-[32px] px-4 pt-6 min-h-[calc(100vh-180px)] pb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Which pet needs nutrition advice?</h2>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF8C42] mx-auto mb-4" />
            <p className="text-slate-500">Loading pets...</p>
          </div>
        ) : pets.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl">
            <PawPrint className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-bold text-slate-900 mb-2">No Pets Added</h3>
            <p className="text-slate-500 text-sm mb-4">
              Please add your pet first to proceed with the consultation.
            </p>
            <Button onClick={onAddPet} className="bg-[#FF8C42] hover:bg-[#FF7029]">
              Add Pet
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {pets.map((pet) => (
              <button
                key={pet.id}
                className="p-4 rounded-2xl text-center transition-all border-2 border-transparent hover:border-[#FF8C42] hover:shadow-md bg-slate-50"
                onClick={() => onSelectPet(pet)}
              >
                <div className="w-16 h-16 bg-slate-200 rounded-full mx-auto mb-3 overflow-hidden">
                  {pet.photo ? (
                    <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      {pet.type?.toLowerCase() === 'dog' ? '🐕' : '🐈'}
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-slate-900">{pet.name}</h3>
                <p className="text-xs text-slate-500">{pet.breed || pet.type}</p>
              </button>
            ))}
            
            {/* Add Pet Card */}
            <button
              className="p-4 rounded-2xl text-center transition-all border-dashed border-2 border-slate-200 hover:border-[#FF8C42] hover:shadow-md flex flex-col items-center justify-center"
              onClick={onAddPet}
            >
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                <Plus className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="font-medium text-slate-600">Add Pet</h3>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function NutritionistTeleRouter({ phone, onBack, onNavigate }: NutritionistTeleRouterProps) {
  const [step, setStep] = useState<FlowStep>('mode-selection');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<{ id: string; name: string } | null>(null);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  
  // Data
  const [pets, setPets] = useState<Pet[]>([]);
  const [loadingPets, setLoadingPets] = useState(false);

  // Load customer ID on mount
  useEffect(() => {
    loadCustomerId();
    loadPets();
  }, [phone]);

  const loadCustomerId = async () => {
    try {
      const response = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
      if (response?.profile?.id || response?.id) {
        setCustomerId(response?.profile?.id || response?.id);
      }
    } catch (error) {
      console.error('Error loading customer ID:', error);
    }
  };

  const loadPets = async () => {
    try {
      setLoadingPets(true);
      const response = await apiClient.get(`/customer/pets/${phone}`) as any;
      if (response?.pets) {
        setPets(response.pets);
      }
    } catch (error) {
      console.error('Error loading pets:', error);
    } finally {
      setLoadingPets(false);
    }
  };

  // Handlers
  const handleSelectScheduled = () => {
    setStep('provider-list');
  };

  const handleSelectProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setStep('provider-profile');
  };

  const handleSelectProblem = (problemId: string, problemName: string) => {
    setSelectedProblem({ id: problemId, name: problemName });
    setStep('instant-pet');
  };

  const handleSelectPet = (pet: Pet) => {
    setSelectedPet(pet);
    setStep('instant-queue');
  };

  const handleProceedToPayment = (bookingData: any) => {
    onNavigate('payment', {
      ...bookingData,
      serviceType: 'tele',
      category: 'nutritionist',
      flowType: 'tele-scheduled',
    });
  };

  const handleQueueAccepted = (bookingId: string, meetingId?: string) => {
    onNavigate('video-call', { bookingId, meetingId });
  };

  const handleAddPet = () => {
    onNavigate('add-pet', { returnTo: 'nutritionist-tele' });
  };

  const handleBack = () => {
    switch (step) {
      case 'mode-selection':
        onBack();
        break;
      case 'provider-list':
      case 'instant-problem':
        setStep('mode-selection');
        break;
      case 'provider-profile':
        setSelectedProvider(null);
        setStep('provider-list');
        break;
      case 'instant-pet':
        setSelectedProblem(null);
        setStep('instant-problem');
        break;
      case 'instant-queue':
        setSelectedPet(null);
        setStep('instant-pet');
        break;
      default:
        onBack();
    }
  };

  // Render based on step
  switch (step) {
    case 'mode-selection':
      return (
        <ModeSelection
          onSelectScheduled={handleSelectScheduled}
          onBack={onBack}
        />
      );

    case 'provider-list':
      return (
        <UniversalServiceProviderList
          phone={phone}
          category="nutritionist"
          roleId="nutritionist"
          serviceStyle="tele"
          title="Pet Nutritionists"
          subtitle="Choose a nutritionist for video consultation"
          showProblemFilter={true}
          onBack={handleBack}
          onNavigate={onNavigate}
          onSelectProvider={handleSelectProvider}
        />
      );

    case 'provider-profile':
      if (!selectedProvider) {
        setStep('provider-list');
        return null;
      }
      return (
        <UniversalProviderProfile
          phone={phone}
          provider={selectedProvider}
          category="nutritionist"
          serviceStyle="tele"
          onBack={handleBack}
          onNavigate={onNavigate}
          onProceedToPayment={handleProceedToPayment}
        />
      );

    case 'instant-problem':
      return (
        <InstantProblemSelection
          onSelectProblem={handleSelectProblem}
          onBack={handleBack}
        />
      );

    case 'instant-pet':
      if (!selectedProblem) {
        setStep('instant-problem');
        return null;
      }
      return (
        <InstantPetSelection
          phone={phone}
          selectedProblem={selectedProblem.name}
          pets={pets}
          loading={loadingPets}
          onSelectPet={handleSelectPet}
          onAddPet={handleAddPet}
          onBack={handleBack}
        />
      );

    case 'instant-queue':
      if (!selectedProblem || !selectedPet || !customerId) {
        if (!customerId) {
          toast.error('Customer ID not found. Please try again.');
        }
        setStep('instant-pet');
        return null;
      }
      return (
        <div className="min-h-screen bg-gray-50">
          <InstantTeleQueue
            customerId={customerId}
            petId={selectedPet.id}
            roleId="nutritionist"
            category="nutritionist"
            onQueueJoined={(queueId) => {
              console.log('Joined nutritionist queue:', queueId);
            }}
            onAccepted={handleQueueAccepted}
          />
        </div>
      );

    default:
      return (
        <ModeSelection
          onSelectScheduled={handleSelectScheduled}
          onBack={onBack}
        />
      );
  }
}

export default NutritionistTeleRouter;
