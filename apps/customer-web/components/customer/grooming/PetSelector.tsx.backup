'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  profilePhoto?: string;
}

interface PetSelectorProps {
  phone: string;
  selectedPetId?: string;
  onPetSelect: (petId: string) => void;
  allowMultiple?: boolean;
  selectedPetIds?: string[];
  onMultiplePetSelect?: (petIds: string[]) => void;
}

export function PetSelector({
  phone,
  selectedPetId,
  onPetSelect,
  allowMultiple = false,
  selectedPetIds = [],
  onMultiplePetSelect
}: PetSelectorProps) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPets();
  }, [phone]);

  const fetchPets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ pets: Pet[] }>(`/customer/pets?phone=${encodeURIComponent(phone)}`);
      if (response.pets) {
        setPets(response.pets);
      }
    } catch (err) {
      console.error('Error fetching pets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePetClick = (petId: string) => {
    if (allowMultiple && onMultiplePetSelect) {
      const newSelection = selectedPetIds.includes(petId)
        ? selectedPetIds.filter(id => id !== petId)
        : [...selectedPetIds, petId];
      onMultiplePetSelect(newSelection);
    } else {
      onPetSelect(petId);
    }
  };

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
            onClick={() => handlePetClick(pet.id)}
            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
              isSelected
                ? 'border-primary bg-orange-50'
                : 'border-gray-200 hover:border-primary'
            }`}
          >
            <div className="flex items-center gap-4">
              {pet.profilePhoto ? (
                <img
                  src={pet.profilePhoto}
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

