import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { ArrowLeft, Plus, Check } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface PetSelectorProps {
  phone: string;
  onBack: () => void;
  onSelect: (pet: any) => void;
  preSelectedPetId?: string;
}

export function PetSelector({ phone, onBack, onSelect, preSelectedPetId }: PetSelectorProps) {
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<any>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadPets();
  }, []);

  const loadPets = async () => {
    try {
      setLoading(true);
      
      console.log('🐾 [PET-SELECTOR] Loading pets for phone:', phone);
      
      const response = await fetch(
        `${API_BASE}/customer/pets/${phone}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('🐾 [PET-SELECTOR] API Response:', data);
        
        // Handle different response formats
        let petsArray = [];
        
        if (Array.isArray(data)) {
          // Direct array response
          petsArray = data;
        } else if (data.pets?.pets && Array.isArray(data.pets.pets)) {
          // Nested pets.pets structure (most common)
          petsArray = data.pets.pets;
          console.log('✅ [PET-SELECTOR] Found nested pets.pets array');
        } else if (data.pets && Array.isArray(data.pets)) {
          // Direct pets array
          petsArray = data.pets;
        } else if (data.success && data.data && Array.isArray(data.data)) {
          // Success wrapper with data
          petsArray = data.data;
        } else if (data.success && data.data?.pets && Array.isArray(data.data.pets)) {
          // Success wrapper with nested pets
          petsArray = data.data.pets;
        } else {
          console.warn('⚠️ [PET-SELECTOR] Unexpected response format:', data);
          petsArray = [];
        }
        
        console.log('✅ [PET-SELECTOR] Loaded pets:', petsArray.length);
        setPets(petsArray);
        
        // Pre-select pet if provided
        if (preSelectedPetId && petsArray.length > 0) {
          const preSelected = petsArray.find((p: any) => p.id === preSelectedPetId);
          if (preSelected) {
            setSelectedPet(preSelected);
            console.log('✅ [PET-SELECTOR] Pre-selected pet:', preSelected.name);
          }
        }
      } else {
        console.error('❌ [PET-SELECTOR] API Error:', response.status);
        const errorText = await response.text();
        console.error('❌ [PET-SELECTOR] Error details:', errorText);
        setPets([]);
      }
    } catch (error) {
      console.error('❌ [PET-SELECTOR] Error loading pets:', error);
      setPets([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white px-6 pt-8 pb-6">
        <button 
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-white/90 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <h1 className="text-2xl font-bold mb-2">Select Your Pet</h1>
        <p className="text-white/80 text-sm">Choose which pet to groom</p>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {!pets || pets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No pets found. Please add a pet first.</p>
            <Button 
              className="bg-[#FF8C42] text-white hover:bg-[#FF7029]"
              onClick={() => {/* Navigate to add pet */}}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Pet
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {pets.map((pet, petIndex) => {
                const petId = pet.id || pet.petId || `pet-${petIndex}`;
                const isSelected = selectedPet?.id === petId || selectedPet === pet;
                
                return (
                  <Card
                    key={petId}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-2 border-[#FF8C42] bg-orange-50' 
                        : 'border border-gray-200 hover:border-[#FF8C42] bg-white'
                    }`}
                    onClick={() => setSelectedPet(pet)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-14 h-14 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-full flex items-center justify-center text-white text-xl font-bold">
                          {pet.name?.charAt(0) || 'P'}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{pet.name || 'Unnamed Pet'}</h3>
                          <p className="text-sm text-gray-600">{pet.type || 'Pet'} • {pet.breed || 'Unknown'}</p>
                          <div className="flex gap-2 mt-1">
                            {pet.age && (
                              <Badge variant="secondary" className="text-xs">
                                {pet.age} {pet.age === 1 ? 'year' : 'years'}
                              </Badge>
                            )}
                            {pet.weight && (
                              <Badge variant="secondary" className="text-xs">
                                {pet.weight}kg
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {isSelected && (
                        <div className="w-6 h-6 bg-[#FF8C42] rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Add New Pet Option */}
            <Card className="p-4 border-2 border-dashed border-gray-300 cursor-pointer hover:border-[#FF8C42] transition-all mb-6">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                  <Plus className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Add New Pet</h3>
                  <p className="text-sm text-gray-500">Register another pet</p>
                </div>
              </div>
            </Card>

            {/* Continue Button */}
            <Button
              className="w-full bg-[#FF8C42] text-white hover:bg-[#FF7029]"
              disabled={!selectedPet}
              onClick={() => selectedPet && onSelect(selectedPet)}
            >
              Continue with {selectedPet?.name || 'Selected Pet'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}