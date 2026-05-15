"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Star, MapPin, Filter, Search, ChevronRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface AdoptionPetCatalogProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
}

interface Pet {
  id: string;
  name: string;
  petType: string;
  breed: string;
  age: number;
  ageUnit: string;
  gender: string;
  size: string;
  color: string;
  description: string;
  photos: string[];
  adoptionFee: number;
  vaccinated: boolean;
  spayedNeutered: boolean;
  microchipped: boolean;
  specialNeeds: string;
  vendor: {
    id: string;
    name: string;
    city: string;
    rating: string;
  };
  location: string;
  featured: boolean;
}

export function AdoptionPetCatalog({ 
  phone, 
  customerPhone, 
  customerId,
  vendorId,
  onBack, 
  onNavigate,
  onSuccess 
}: AdoptionPetCatalogProps) {
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    petType: '',
    breed: '',
    gender: '',
    size: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const userPhone = customerPhone || phone;

  useEffect(() => {
    loadPets();
  }, [filters, vendorId]);

  const loadPets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.petType) params.append('petType', filters.petType);
      if (filters.breed) params.append('breed', filters.breed);
      if (filters.gender) params.append('gender', filters.gender);
      if (filters.size) params.append('size', filters.size);
      if (vendorId) params.append('vendorId', vendorId);

      const response = await apiClient.get<any>(`/adoption/pets?${params.toString()}`);
      setPets(response.pets || []);
    } catch (error) {
      console.error('Error loading pets:', error);
      setPets([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePetSelect = (pet: Pet) => {
    setSelectedPet(pet);
    setShowDetailModal(true);
  };

  const handleAdoptRequest = async (pet: Pet) => {
    try {
      // Navigate to questionnaire with pet info
      onNavigate?.('adoption_questionnaire', { 
        petId: pet.id, 
        vendorId: pet.vendor.id,
        petName: pet.name,
      });
    } catch (error) {
      console.error('Error creating adoption request:', error);
      toast.error('Failed to process request');
    }
  };

  const filteredPets = pets.filter(pet => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      pet.name.toLowerCase().includes(query) ||
      pet.breed.toLowerCase().includes(query) ||
      pet.petType.toLowerCase().includes(query)
    );
  });

  const petTypes = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Fish', 'Other'];
  const sizes = ['Small', 'Medium', 'Large', 'Extra Large'];
  const genders = ['Male', 'Female'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Finding adorable pets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white max-w-md mx-auto pb-24">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-pink-500 to-rose-600 pb-6 pl-[max(1.5rem,env(safe-area-inset-left,0px))] pr-[max(1.5rem,env(safe-area-inset-right,0px))] text-white cw-header-safe-top">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 flex min-h-[44px] items-center gap-2 text-white/90 hover:text-white touch-manipulation"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Find Your Pet</h1>
            <p className="text-white/80 text-sm">{pets.length} pets waiting for homes</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search by name, breed..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/95 border-0 text-gray-800 placeholder:text-gray-400"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
          >
            <Filter className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white px-6 py-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-wrap gap-2">
            {petTypes.map(type => (
              <button
                key={type}
                onClick={() => setFilters({ ...filters, petType: filters.petType === type ? '' : type })}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filters.petType === type
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map(size => (
              <button
                key={size}
                onClick={() => setFilters({ ...filters, size: filters.size === size ? '' : size })}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filters.size === size
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {genders.map(gender => (
              <button
                key={gender}
                onClick={() => setFilters({ ...filters, gender: filters.gender === gender ? '' : gender })}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filters.gender === gender
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {gender}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pet Grid */}
      <div className="px-4 py-6">
        {filteredPets.length === 0 ? (
          <Card className="p-8 text-center">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">No Pets Found</h3>
            <p className="text-sm text-gray-500">Try adjusting your filters or check back later</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredPets.map((pet) => (
              <div
                key={pet.id}
                onClick={() => handlePetSelect(pet)}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-gradient-to-br from-pink-100 to-rose-100 relative">
                  {pet.photos && pet.photos[0] ? (
                    <img
                      src={pet.photos[0]}
                      alt={pet.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-5xl">
                        {pet.petType?.toLowerCase() === 'dog' ? '🐕' : 
                         pet.petType?.toLowerCase() === 'cat' ? '🐱' : '🐾'}
                      </span>
                    </div>
                  )}
                  {pet.featured && (
                    <Badge className="absolute top-2 left-2 bg-pink-500 text-white text-xs">
                      Featured
                    </Badge>
                  )}
                  <button className="absolute top-2 right-2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center">
                    <Heart className="w-4 h-4 text-pink-500" />
                  </button>
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-gray-900 text-sm truncate">{pet.name}</h3>
                  <p className="text-xs text-gray-500 truncate">{pet.breed}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <span>{pet.age} {pet.ageUnit}</span>
                      <span>•</span>
                      <span>{pet.gender}</span>
                    </div>
                  </div>
                  {pet.adoptionFee > 0 && (
                    <p className="text-pink-600 font-bold text-sm mt-1">₹{pet.adoptionFee.toLocaleString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pet Detail Modal */}
      {showDetailModal && selectedPet && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl max-h-[90vh] overflow-y-auto">
            {/* Pet Image */}
            <div className="aspect-video bg-gradient-to-br from-pink-100 to-rose-100 relative">
              {selectedPet.photos && selectedPet.photos[0] ? (
                <img
                  src={selectedPet.photos[0]}
                  alt={selectedPet.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-7xl">
                    {selectedPet.petType?.toLowerCase() === 'dog' ? '🐕' : 
                     selectedPet.petType?.toLowerCase() === 'cat' ? '🐱' : '🐾'}
                  </span>
                </div>
              )}
              <button 
                onClick={() => setShowDetailModal(false)}
                className="absolute top-4 right-4 w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Pet Info */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold text-gray-900">{selectedPet.name}</h2>
                  {selectedPet.adoptionFee > 0 && (
                    <span className="text-pink-600 font-bold text-xl">₹{selectedPet.adoptionFee.toLocaleString()}</span>
                  )}
                </div>
                <p className="text-gray-600">{selectedPet.breed} • {selectedPet.age} {selectedPet.ageUnit} • {selectedPet.gender}</p>
              </div>

              {/* Quick Info Badges */}
              <div className="flex flex-wrap gap-2">
                {selectedPet.vaccinated && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Check className="w-3 h-3 mr-1" /> Vaccinated
                  </Badge>
                )}
                {selectedPet.spayedNeutered && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    <Check className="w-3 h-3 mr-1" /> Spayed/Neutered
                  </Badge>
                )}
                {selectedPet.microchipped && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    <Check className="w-3 h-3 mr-1" /> Microchipped
                  </Badge>
                )}
              </div>

              {/* Description */}
              {selectedPet.description && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">About {selectedPet.name}</h3>
                  <p className="text-gray-600 text-sm">{selectedPet.description}</p>
                </div>
              )}

              {/* Shelter Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center text-xl">
                    {selectedPet.vendor?.name?.charAt(0) || 'S'}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{selectedPet.vendor?.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" />
                      <span>{selectedPet.location || selectedPet.vendor?.city}</span>
                      <span>•</span>
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span>{selectedPet.vendor?.rating}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDetailModal(false)}
                >
                  Close
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-pink-500 to-rose-600 text-white"
                  onClick={() => {
                    setShowDetailModal(false);
                    handleAdoptRequest(selectedPet);
                  }}
                >
                  <Heart className="w-4 h-4 mr-2" />
                  Start Adoption
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 px-4 py-3 z-40">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-bold text-pink-600">{filteredPets.length}</span> pets available
          </div>
          <Button
            onClick={() => onNavigate?.('adoption_questionnaire')}
            className="bg-gradient-to-r from-pink-500 to-rose-600 text-white"
          >
            Fill Questionnaire First
          </Button>
        </div>
      </div>
    </div>
  );
}
