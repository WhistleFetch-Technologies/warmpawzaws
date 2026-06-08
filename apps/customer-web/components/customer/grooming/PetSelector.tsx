'use client';

import { useState, useEffect } from 'react';
import { Check, ArrowLeft, Plus, Home as HomeIcon, ShoppingCart, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  profilePhoto?: string;
  photo?: string;
  image?: string;
}

interface PetSelectorProps {
  phone: string;
  // New full-page props
  onBack?: () => void;
  onSelect?: (pet: any) => void;
  preSelectedPetId?: string;
  onNavigate?: (screen: string, data?: any) => void;
  // Legacy inline props (for backward compatibility)
  selectedPetId?: string;
  onPetSelect?: (petId: string) => void;
  allowMultiple?: boolean;
  selectedPetIds?: string[];
  onMultiplePetSelect?: (petIds: string[]) => void;
}

export function PetSelector({
  phone,
  onBack,
  onSelect,
  preSelectedPetId,
  onNavigate,
  selectedPetId,
  onPetSelect,
  allowMultiple = false,
  selectedPetIds = [],
  onMultiplePetSelect
}: PetSelectorProps) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);

  // Determine if we're in full-page mode or inline mode
  const isFullPageMode = !!onBack && !!onSelect;

  useEffect(() => {
    fetchPets();
  }, [phone]);

  const fetchPets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ pets?: Pet[] } | Pet[]>(`/customer/pets/${phone}`);
      
      let petList: Pet[] = [];
      if (Array.isArray(response)) {
        petList = response;
      } else if (response.pets) {
        petList = response.pets;
      }
      
      setPets(petList);
      
      // Pre-select pet if specified
      if (preSelectedPetId && petList.length > 0) {
        const preSelected = petList.find(p => p.id === preSelectedPetId);
        if (preSelected) setSelectedPet(preSelected);
      }
    } catch (err) {
      console.error('Error fetching pets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePetClick = (pet: Pet) => {
    if (isFullPageMode) {
      setSelectedPet(pet);
    } else if (allowMultiple && onMultiplePetSelect) {
      const newSelection = selectedPetIds.includes(pet.id)
        ? selectedPetIds.filter(id => id !== pet.id)
        : [...selectedPetIds, pet.id];
      onMultiplePetSelect(newSelection);
    } else if (onPetSelect) {
      onPetSelect(pet.id);
    }
  };

  const handleContinue = () => {
    if (selectedPet && onSelect) {
      onSelect(selectedPet);
    }
  };

  // Inline mode - simple component
  if (!isFullPageMode) {
    if (loading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse"></div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {pets.map((pet) => {
          const isSelected = allowMultiple
            ? selectedPetIds.includes(pet.id)
            : selectedPetId === pet.id;

          return (
            <button
              key={pet.id}
              onClick={() => handlePetClick(pet)}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? 'border-primary bg-orange-50'
                  : 'border-gray-200 hover:border-primary'
              }`}
            >
              <div className="flex items-center gap-4">
                {(pet.profilePhoto || pet.photo || pet.image) ? (
                  <img
                    src={pet.profilePhoto || pet.photo || pet.image}
                    alt={pet.name}
                    className="w-16 h-16 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center text-white text-xl font-bold">
                    {pet.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{pet.name}</h4>
                  <p className="text-sm text-gray-600">{pet.breed}</p>
                </div>
                {isSelected && (
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // Full-page mode
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-customer mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-customer mx-auto pb-32">
      {/* Header */}
      <div className="bg-[#FF8C42] text-white px-6 pt-8 pb-8 sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-white/90 hover:text-white"
        >
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </div>
        </button>
        
        <h1 className="text-2xl font-bold mb-1">Select Your Pet</h1>
        <p className="text-white/80 text-sm">Choose a pet for this service</p>
      </div>

      {/* Content */}
      <div className="bg-white rounded-t-[32px] px-6 pt-8 pb-6 -mt-4 min-h-[calc(100vh-180px)]">
        {pets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No pets found</p>
            <Button 
              onClick={() => onNavigate?.('add-pet')}
              className="bg-[#FF8C42] hover:bg-[#FF7029]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Pet
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {pets.map((pet) => {
              const isSelected = selectedPet?.id === pet.id;
              const petPhoto = pet.profilePhoto || pet.photo || pet.image;

              return (
                <Card
                  key={pet.id}
                  onClick={() => handlePetClick(pet)}
                  className={`p-4 cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-2 border-[#FF8C42] bg-orange-50' 
                      : 'border border-gray-200 hover:border-[#FF8C42]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {petPhoto ? (
                      <img
                        src={petPhoto}
                        alt={pet.name}
                        className="w-16 h-16 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-xl flex items-center justify-center text-white text-xl font-bold">
                        {pet.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{pet.name}</h4>
                      <p className="text-sm text-gray-600">{pet.breed || pet.type}</p>
                    </div>
                    {isSelected && (
                      <div className="w-8 h-8 bg-[#FF8C42] rounded-full flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}

            {/* Add Pet Button */}
            <button
              onClick={() => onNavigate?.('add-pet')}
              className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-[#FF8C42] hover:text-[#FF8C42] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Add New Pet</span>
            </button>
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      {selectedPet && (
        <div className="fixed left-0 right-0 cw-fixed-above-customer-tabbar bg-white border-t border-gray-200 px-5 py-3 sm:px-6 z-40">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1">
              <p className="text-sm text-gray-600">Selected Pet</p>
              <p className="font-semibold text-gray-900">{selectedPet.name}</p>
            </div>
          </div>
          <div className="mx-auto w-full max-w-xs sm:max-w-sm">
          <Button
            className="w-full whitespace-normal text-center rounded-full bg-[#FF8C42] text-white shadow-md hover:bg-[#FF7029] min-h-12 px-3 py-2.5 text-sm sm:h-12 sm:px-4 sm:text-base sm:py-0"
            onClick={handleContinue}
          >
            Continue with {selectedPet.name}
          </Button>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 max-w-customer mx-auto z-50">
        <div className="flex items-center justify-around">
          <button 
            onClick={() => onNavigate?.('home')}
            className="flex flex-col items-center gap-1"
          >
            <HomeIcon className="w-6 h-6 text-[#FF8C42]" />
            <span className="text-xs font-medium text-[#FF8C42]">Home</span>
          </button>
          <button 
            onClick={() => onNavigate?.('cart')}
            className="flex flex-col items-center gap-1"
          >
            <ShoppingCart className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400">Cart</span>
          </button>
          <button 
            onClick={() => onNavigate?.('my-bookings')}
            className="flex flex-col items-center gap-1"
          >
            <Calendar className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400">Bookings</span>
          </button>
          <button 
            onClick={() => onNavigate?.('profile')}
            className="flex flex-col items-center gap-1"
          >
            <User className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400">Profile</span>
          </button>
        </div>
        <div className="flex justify-center mt-2">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
