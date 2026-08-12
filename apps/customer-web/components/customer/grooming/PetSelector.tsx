'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Home as HomeIcon, ShoppingCart, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { BookingPetSelection, type BookingPet } from '../shared/BookingPetSelection';
import { mapBookingPetFromApi } from '@/lib/pet-display-photo';

interface PetSelectorProps {
  phone: string;
  onBack?: () => void;
  onSelect?: (pet: any) => void;
  preSelectedPetId?: string;
  onNavigate?: (screen: string, data?: any) => void;
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
  onMultiplePetSelect,
}: PetSelectorProps) {
  const [pets, setPets] = useState<BookingPet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPet, setSelectedPet] = useState<BookingPet | null>(null);

  const isFullPageMode = !!onBack && !!onSelect;

  useEffect(() => {
    fetchPets();
  }, [phone]);

  const fetchPets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ pets?: Record<string, unknown>[] } | Record<string, unknown>[]>(
        `/customer/pets/${phone}`
      );

      let petList: Record<string, unknown>[] = [];
      if (Array.isArray(response)) {
        petList = response;
      } else if (response.pets) {
        petList = response.pets;
      }

      const mappedPets = petList.map((p) => mapBookingPetFromApi(p));
      setPets(mappedPets);

      if (preSelectedPetId && mappedPets.length > 0) {
        const preSelected = mappedPets.find((p) => p.id === preSelectedPetId);
        if (preSelected) setSelectedPet(preSelected);
      }
    } catch (err) {
      console.error('Error fetching pets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePetClick = (pet: BookingPet) => {
    if (isFullPageMode) {
      setSelectedPet(pet);
      return;
    }
    if (allowMultiple && onMultiplePetSelect) {
      const newSelection = selectedPetIds.includes(pet.id)
        ? selectedPetIds.filter((id) => id !== pet.id)
        : [...selectedPetIds, pet.id];
      onMultiplePetSelect(newSelection);
      return;
    }
    if (onPetSelect) {
      onPetSelect(pet.id);
    }
  };

  const handleTogglePet = (pet: BookingPet) => {
    if (allowMultiple && onMultiplePetSelect) {
      const newSelection = selectedPetIds.includes(pet.id)
        ? selectedPetIds.filter((id) => id !== pet.id)
        : [...selectedPetIds, pet.id];
      onMultiplePetSelect(newSelection);
    }
  };

  const handleContinue = () => {
    if (selectedPet && onSelect) {
      onSelect(selectedPet);
    }
  };

  if (!isFullPageMode) {
    if (loading) {
      return (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="mx-auto h-20 w-20 animate-pulse rounded-full bg-gray-100" />
          ))}
        </div>
      );
    }

    return (
      <BookingPetSelection
        showHeader={false}
        showBanner={false}
        showSubtitle={false}
        pets={pets}
        selectedPet={allowMultiple ? undefined : pets.find((p) => p.id === selectedPetId) ?? null}
        allowMultiple={allowMultiple}
        selectedPetIds={selectedPetIds}
        onTogglePet={handleTogglePet}
        onSelectPet={handlePetClick}
        onAddPet={() => onNavigate?.('add-pet')}
      />
    );
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-customer items-center justify-center bg-white">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#FF8C42]" />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-customer bg-[#FF8C42] pb-32">
      <div className="sticky top-0 z-10 bg-[#FF8C42] px-6 pb-8 pt-8 text-white">
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-white/90 hover:text-white"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <ArrowLeft className="h-5 w-5 text-white" />
          </div>
        </button>

        <h1 className="mb-1 text-2xl font-bold">Select Your Pet</h1>
        <p className="text-sm text-white/80">Choose a pet profile to continue</p>
      </div>

      <div className="-mt-4 min-h-[calc(100vh-180px)] rounded-t-[32px] bg-white px-6 pb-6 pt-8">
        {pets.length === 0 ? (
          <div className="py-12 text-center">
            <p className="mb-4 text-gray-500">No pets found</p>
            <Button onClick={() => onNavigate?.('add-pet')} className="bg-[#FF8C42] hover:bg-[#FF7029]">
              <Plus className="mr-2 h-4 w-4" />
              Add Pet
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <BookingPetSelection
              showHeader={false}
              pets={pets}
              selectedPet={selectedPet}
              onSelectPet={setSelectedPet}
              onAddPet={() => onNavigate?.('add-pet')}
            />
            <button
              type="button"
              onClick={() => onNavigate?.('add-pet')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-4 text-gray-500 transition-colors hover:border-[#FF8C42] hover:text-[#FF8C42]"
            >
              <Plus className="h-5 w-5" />
              <span>Add New Pet</span>
            </button>
          </div>
        )}
      </div>

      {selectedPet && (
        <div className="cw-fixed-above-customer-tabbar fixed left-0 right-0 z-40 border-t border-gray-200 bg-white px-5 py-3 sm:px-6">
          <div className="mb-3 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-gray-600">Selected Pet</p>
              <p className="font-semibold text-gray-900">{selectedPet.name}</p>
            </div>
          </div>
          <div className="mx-auto w-full max-w-xs sm:max-w-sm">
            <Button
              className="min-h-12 w-full rounded-full bg-[#FF8C42] px-3 py-2.5 text-center text-sm text-white shadow-md hover:bg-[#FF7029] sm:h-12 sm:px-4 sm:text-base sm:py-0"
              onClick={handleContinue}
            >
              Continue with {selectedPet.name}
            </Button>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-customer border-t border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center justify-around">
          <button onClick={() => onNavigate?.('home')} className="flex flex-col items-center gap-1">
            <HomeIcon className="h-6 w-6 text-[#FF8C42]" />
            <span className="text-xs font-medium text-[#FF8C42]">Home</span>
          </button>
          <button onClick={() => onNavigate?.('cart')} className="flex flex-col items-center gap-1">
            <ShoppingCart className="h-6 w-6 text-gray-400" />
            <span className="text-xs text-gray-400">Cart</span>
          </button>
          <button onClick={() => onNavigate?.('my-bookings')} className="flex flex-col items-center gap-1">
            <Calendar className="h-6 w-6 text-gray-400" />
            <span className="text-xs text-gray-400">Bookings</span>
          </button>
          <button onClick={() => onNavigate?.('profile')} className="flex flex-col items-center gap-1">
            <User className="h-6 w-6 text-gray-400" />
            <span className="text-xs text-gray-400">Profile</span>
          </button>
        </div>
        <div className="mt-2 flex justify-center">
          <div className="h-1 w-32 rounded-full bg-black" />
        </div>
      </div>
    </div>
  );
}
