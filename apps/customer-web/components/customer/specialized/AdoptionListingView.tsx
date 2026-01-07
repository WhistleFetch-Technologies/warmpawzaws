'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Heart, MapPin, Calendar, Phone } from 'lucide-react';

interface AdoptionListingViewProps {
  vendorId: string;
  customerPhone: string;
  onApply?: (petId: string) => void;
}

interface Pet {
  id: string;
  name: string;
  pet_type: string;
  breed: string;
  age: number;
  age_unit: string;
  gender: string;
  size: string;
  color: string;
  description: string;
  medical_history?: string;
  vaccination_status?: string;
  spayed_neutered: boolean;
  microchipped: boolean;
  special_needs?: string;
  photos: string[];
  listing_type: 'adoption' | 'breeding';
  adoption_fee: number;
  location_city?: string;
  location_state?: string;
}

export function AdoptionListingView({ vendorId, customerPhone, onApply }: AdoptionListingViewProps) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'adoption' | 'breeding'>('all');
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);

  useEffect(() => {
    loadPets();
  }, [vendorId, filter]);

  const loadPets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/breeder/puppies`);
      
      if (response.success && response.puppies) {
        let filtered = response.puppies;
        if (filter === 'adoption') {
          filtered = filtered.filter((p: Pet) => p.listing_type === 'adoption');
        } else if (filter === 'breeding') {
          filtered = filtered.filter((p: Pet) => p.listing_type === 'breeding');
        }
        setPets(filtered);
      }
    } catch (err: any) {
      console.error('Error loading pets:', err);
      setError('Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (pet: Pet) => {
    if (onApply) {
      onApply(pet.id);
    } else {
      // Default application flow
      try {
        const customerResponse = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
        const customerId = customerResponse.customer?.id;

        if (!customerId) {
          alert('Customer not found');
          return;
        }

        const applicationData = {
          petId: pet.id,
          vendorId,
          customerId,
          listingType: pet.listing_type,
          message: `Interested in ${pet.name}`,
        };

        const response = await apiClient.post<any>('/adoption/apply', applicationData);
        
        if (response.success) {
          alert('Application submitted successfully!');
        } else {
          alert('Failed to submit application');
        }
      } catch (err: any) {
        console.error('Error applying:', err);
        alert('Failed to submit application');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-02">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-0">
      <div className="flex items-center justify-between mb-0">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-0">
          <Heart className="text-orange-500" size={28} />
          Available Pets
        </h2>
        <div className="flex gap-0">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-0 rounded-lg transition ${
              filter === 'all'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('adoption')}
            className={`px-4 py-0 rounded-lg transition ${
              filter === 'adoption'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Adoption
          </button>
          <button
            onClick={() => setFilter('breeding')}
            className={`px-4 py-0 rounded-lg transition ${
              filter === 'breeding'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Breeding
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-0">
          {error}
        </div>
      )}

      {pets.length === 0 ? (
        <div className="text-center py-0 bg-white rounded-xl">
          <Heart className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-500">No pets available at the moment</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
          {pets.map((pet) => (
            <div
              key={pet.id}
              className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition cursor-pointer"
              onClick={() => setSelectedPet(pet)}
            >
              {pet.photos && pet.photos.length > 0 && (
                <div className="h-48 bg-gray-200 overflow-hidden">
                  <img
                    src={pet.photos[0]}
                    alt={pet.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between mb-0">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{pet.name}</h3>
                    <p className="text-sm text-gray-500">
                      {pet.breed} • {pet.age} {pet.age_unit} old
                    </p>
                  </div>
                  <span className={`px-0 py-0 rounded text-xs ${
                    pet.listing_type === 'adoption'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {pet.listing_type}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 mt-0">
                  <span>{pet.gender}</span>
                  <span>•</span>
                  <span>{pet.size}</span>
                  <span>•</span>
                  <span>{pet.color}</span>
                </div>

                {pet.location_city && (
                  <div className="flex items-center gap-0 text-sm text-gray-500 mt-0">
                    <MapPin size={14} />
                    {pet.location_city}, {pet.location_state}
                  </div>
                )}

                {pet.description && (
                  <p className="text-sm text-gray-600 mt-0 line-clamp-0">
                    {pet.description}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-lg font-bold text-orange-600">
                    {pet.listing_type === 'adoption' ? `₹${pet.adoption_fee}` : 'Contact for Price'}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApply(pet);
                    }}
                    className="px-4 py-0 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
                  >
                    {pet.listing_type === 'adoption' ? 'Apply' : 'Inquire'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pet Detail Modal */}
      {selectedPet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-gray-900">{selectedPet.name}</h3>
                <button
                  onClick={() => setSelectedPet(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {selectedPet.photos && selectedPet.photos.length > 0 && (
                <div className="mb-4">
                  <img
                    src={selectedPet.photos[0]}
                    alt={selectedPet.name}
                    className="w-full h-64 object-cover rounded-lg"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Breed</p>
                  <p className="font-medium">{selectedPet.breed}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Age</p>
                  <p className="font-medium">{selectedPet.age} {selectedPet.age_unit}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Gender</p>
                  <p className="font-medium">{selectedPet.gender}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Size</p>
                  <p className="font-medium">{selectedPet.size}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Color</p>
                  <p className="font-medium">{selectedPet.color}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vaccination</p>
                  <p className="font-medium">{selectedPet.vaccination_status || 'Not specified'}</p>
                </div>
              </div>

              {selectedPet.description && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-0">Description</p>
                  <p className="text-gray-700">{selectedPet.description}</p>
                </div>
              )}

              {selectedPet.medical_history && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-0">Medical History</p>
                  <p className="text-gray-700">{selectedPet.medical_history}</p>
                </div>
              )}

              <div className="flex gap-0 mt-0">
                <button
                  onClick={() => {
                    handleApply(selectedPet);
                    setSelectedPet(null);
                  }}
                  className="flex-1 px-0 py-0 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600"
                >
                  {selectedPet.listing_type === 'adoption' ? 'Apply for Adoption' : 'Inquire'}
                </button>
                <button
                  onClick={() => setSelectedPet(null)}
                  className="px-0 py-0 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

