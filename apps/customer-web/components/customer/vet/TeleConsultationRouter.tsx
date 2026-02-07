'use client';

import React, { useState, useEffect } from 'react';
import {
  Video, Clock, Zap, Calendar, ChevronRight,
  User, Star, Shield, Phone, AlertCircle, PawPrint, Plus, Stethoscope
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

import { UniversalServiceProviderList } from '../shared/UniversalServiceProviderList';
import { UniversalProviderProfile } from '../shared/UniversalProviderProfile';
import { InstantTeleQueue } from '../InstantTeleQueue';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';

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

interface TeleConsultationRouterProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

type FlowStep = 
  | 'mode-selection'      // Choose Scheduled vs Instant
  | 'provider-list'       // For Scheduled: list of providers
  | 'provider-profile'    // For Scheduled: provider profile + services
  | 'instant-service'     // For Instant: select service
  | 'instant-pet'         // For Instant: select pet
  | 'instant-queue'       // For Instant: queue waiting
  | 'payment'             // Payment page
  | 'confirmation';       // Booking confirmed

// ============================================================================
// MODE SELECTION SCREEN
// ============================================================================

interface ModeSelectionProps {
  onSelectScheduled: () => void;
  onSelectInstant: () => void;
  onBack: () => void;
}

function ModeSelection({ onSelectScheduled, onSelectInstant, onBack }: ModeSelectionProps) {
  // ✅ FIX: Prepare stats for ServiceDashboardHeader
  const dashboardStats = [
    { value: '24/7', label: 'Available', icon: <Clock className="w-4 h-4" /> },
    { value: '<5min', label: 'Avg Wait' },
    { value: '4.8', label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ FIX: Use ServiceDashboardHeader for consistent Frame UI */}
      <ServiceDashboardHeader
        serviceName="Tele Consultation"
        serviceSubtitle="Video consultation with vets"
        serviceIcon={Video}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />

      {/* Main Content */}
      <div className="px-4 pt-4 pb-8">
        {/* Section Title */}
        <h2 className="text-base font-semibold text-gray-900 mb-4">How would you like to consult?</h2>

        {/* Instant Consultation */}
        <button
          className="w-full p-4 mb-3 rounded-2xl text-left transition-all border-2 border-transparent hover:border-green-400 hover:shadow-md bg-green-50"
          onClick={onSelectInstant}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold text-base text-gray-900">Instant Consultation</h3>
                <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full font-medium">Live Now</span>
              </div>
              <p className="text-sm text-gray-600 leading-snug">
                Connect immediately with the next available vet
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  &lt;5 min wait
                </span>
                <span className="flex items-center gap-1">
                  <Video className="w-3.5 h-3.5" />
                  Video call
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
          </div>
        </button>

        {/* Scheduled Consultation */}
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
                Choose your preferred vet and book a time slot
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  Choose your vet
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
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Note:</span> Both options include video consultation, prescription, and follow-up support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// INSTANT SERVICE SELECTION
// ============================================================================

interface InstantServiceSelectionProps {
  phone: string;
  services: PlatformService[];
  loading: boolean;
  onSelectService: (service: PlatformService) => void;
  onBack: () => void;
}

function InstantServiceSelection({ phone, services, loading, onSelectService, onBack }: InstantServiceSelectionProps) {
  const dashboardStats = [
    { value: '24/7', label: 'Available', icon: <Clock className="w-4 h-4" /> },
    { value: `${services.length}`, label: 'Services' },
    { value: '4.8', label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> }
  ];

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* ✅ FIX: Add ServiceDashboardHeader for consistent UI */}
      <ServiceDashboardHeader
        serviceName="Instant Consultation"
        serviceSubtitle="Choose a service"
        serviceIcon={Zap}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />
      
      {/* Main Content */}
      <div className="px-4 pt-4 pb-8">

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF8C42] mx-auto mb-4" />
            <p className="text-slate-500">Loading services...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl">
            <Video className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-bold text-slate-900 mb-2">No Services Available</h3>
            <p className="text-slate-500 text-sm">
              No instant consultation services are currently available. Please try scheduled consultation.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <button
                key={service.id}
                className="w-full p-4 rounded-2xl text-left transition-all border-2 border-transparent hover:border-[#FF8C42] hover:shadow-md bg-slate-50"
                onClick={() => onSelectService(service)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base text-slate-900">{service.name}</h3>
                    {service.description && (
                      <p className="text-sm text-slate-500 mt-1 leading-snug">{service.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {service.duration} mins
                      </span>
                      <span className="flex items-center gap-1">
                        <Video className="w-3.5 h-3.5" />
                        Video call
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="font-bold text-lg text-[#FF8C42]">₹{service.price}</p>
                    <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// INSTANT PET SELECTION
// ============================================================================

interface InstantPetSelectionProps {
  phone: string;
  selectedService: PlatformService;
  pets: Pet[];
  loading: boolean;
  onSelectPet: (pet: Pet) => void;
  onAddPet: () => void;
  onBack: () => void;
}

function InstantPetSelection({ phone, selectedService, pets, loading, onSelectPet, onAddPet, onBack }: InstantPetSelectionProps) {
  const dashboardStats = [
    { value: '24/7', label: 'Available', icon: <Clock className="w-4 h-4" /> },
    { value: `₹${selectedService.price}`, label: 'Price' },
    { value: '4.8', label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> }
  ];

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* ✅ FIX: Add ServiceDashboardHeader for consistent UI */}
      <ServiceDashboardHeader
        serviceName="Select Pet"
        serviceSubtitle={selectedService.name}
        serviceIcon={PawPrint}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />
      
      {/* Main Content */}
      <div className="px-4 pt-4 pb-8">

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
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TeleConsultationRouter({ phone, onBack, onNavigate }: TeleConsultationRouterProps) {
  const [step, setStep] = useState<FlowStep>('mode-selection');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedService, setSelectedService] = useState<PlatformService | null>(null);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  
  // Data
  const [platformServices, setPlatformServices] = useState<PlatformService[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
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

  const loadPlatformServices = async () => {
    try {
      setLoadingServices(true);
      // Fetch platform-level tele services for vet role
      const response = await apiClient.get(
        '/customer/services/platform?roleId=vet&serviceStyle=tele'
      ) as any;
      
      if (response.success && response.services) {
        setPlatformServices(response.services);
      } else {
        // Fallback
        setPlatformServices([
          {
            id: 'instant-general',
            serviceId: 'instant-general',
            name: 'General Consultation',
            description: 'Quick video consultation for general health concerns',
            price: 399,
            duration: 15,
          },
          {
            id: 'instant-emergency',
            serviceId: 'instant-emergency',
            name: 'Emergency Consultation',
            description: 'Urgent consultation for critical health issues',
            price: 699,
            duration: 20,
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading platform services:', error);
      // Fallback
      setPlatformServices([
        {
          id: 'instant-general',
          serviceId: 'instant-general',
          name: 'General Consultation',
          description: 'Quick video consultation for general health concerns',
          price: 399,
          duration: 15,
        },
      ]);
    } finally {
      setLoadingServices(false);
    }
  };

  // Handlers
  const handleSelectScheduled = () => {
    setStep('provider-list');
  };

  const handleSelectInstant = () => {
    loadPlatformServices();
    setStep('instant-service');
  };

  const handleSelectProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setStep('provider-profile');
  };

  const handleSelectInstantService = (service: PlatformService) => {
    setSelectedService(service);
    setStep('instant-pet');
  };

  const handleSelectPet = (pet: Pet) => {
    setSelectedPet(pet);
    setStep('instant-queue');
  };

  const handleProceedToPayment = (bookingData: any) => {
    // Navigate to universal payment page
    onNavigate('payment', {
      ...bookingData,
      serviceType: 'tele',
      category: 'vet',
      flowType: 'tele-scheduled',
    });
  };

  const handleQueueAccepted = (bookingId: string, meetingId?: string) => {
    onNavigate('video-call', { bookingId, meetingId });
  };

  const handleAddPet = () => {
    onNavigate('add-pet', { returnTo: 'tele-consultation' });
  };

  const handleBack = () => {
    switch (step) {
      case 'mode-selection':
        onBack();
        break;
      case 'provider-list':
      case 'instant-service':
        setStep('mode-selection');
        break;
      case 'provider-profile':
        setSelectedProvider(null);
        setStep('provider-list');
        break;
      case 'instant-pet':
        setSelectedService(null);
        setStep('instant-service');
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
          onSelectInstant={handleSelectInstant}
          onBack={onBack}
        />
      );

    case 'provider-list':
      return (
        <UniversalServiceProviderList
          phone={phone}
          category="vet"
          roleId="veterinarian"
          serviceStyle="tele"
          title="Tele Consultation"
          subtitle="Choose a vet for video consultation"
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
          category="vet"
          serviceStyle="tele"
          onBack={handleBack}
          onNavigate={onNavigate}
          onProceedToPayment={handleProceedToPayment}
        />
      );

    case 'instant-service':
      return (
        <InstantServiceSelection
          phone={phone}
          services={platformServices}
          loading={loadingServices}
          onSelectService={handleSelectInstantService}
          onBack={handleBack}
        />
      );

    case 'instant-pet':
      if (!selectedService) {
        setStep('instant-service');
        return null;
      }
      return (
        <InstantPetSelection
          phone={phone}
          selectedService={selectedService}
          pets={pets}
          loading={loadingPets}
          onSelectPet={handleSelectPet}
          onAddPet={handleAddPet}
          onBack={handleBack}
        />
      );

    case 'instant-queue':
      if (!selectedService || !selectedPet || !customerId) {
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
            roleId="veterinarian"
            category="vet"
            serviceId={selectedService.serviceId}
            onBack={handleBack}
            onQueueJoined={(queueId) => {
              console.log('Joined queue:', queueId);
            }}
            onAccepted={handleQueueAccepted}
          />
        </div>
      );

    default:
      return (
        <ModeSelection
          onSelectScheduled={handleSelectScheduled}
          onSelectInstant={handleSelectInstant}
          onBack={onBack}
        />
      );
  }
}

export default TeleConsultationRouter;
