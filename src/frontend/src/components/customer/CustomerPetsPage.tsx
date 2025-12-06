import { useState, useEffect } from 'react';
import { LoadingState, ErrorState, EmptyState } from '../ui/states';
import { Button } from '../../../../components/ui/button';
import { Card } from '../../../../components/ui/card';
import { ArrowLeft, Plus, Calendar, Activity, Weight } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

interface Pet {
  id: string;
  name: string;
  type: string;
  breed?: string;
  age?: number;
  gender?: 'male' | 'female';
  weight?: number;
  image?: string;
}

interface CustomerPetsPageProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  onAddPet: () => void;
}

export function CustomerPetsPage({ phone, onBack, onNavigate, onAddPet }: CustomerPetsPageProps) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchPets();
  }, [phone]);

  const fetchPets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `${API_BASE}/customer/pets?phone=${encodeURIComponent(phone)}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch pets');
      }
      
      const data = await response.json();
      setPets(data.pets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pets');
      console.error('Error fetching pets:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">My Pets</h1>
        </div>
        <Button 
          size="sm" 
          className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
          onClick={onAddPet}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Pet
        </Button>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <LoadingState message="Loading your pets..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchPets} />
        ) : pets.length === 0 ? (
          <EmptyState 
            message="You haven't added any pets yet."
            action={
              <Button onClick={onAddPet} className="bg-[#FF8C42]">
                Add Your First Pet
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {pets.map((pet) => (
              <PetCard 
                key={pet.id} 
                pet={pet} 
                onClick={() => onNavigate('pet-details', { petId: pet.id })} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PetCard({ pet, onClick }: { pet: Pet; onClick: () => void }) {
  return (
    <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-all" onClick={onClick}>
      <div className="p-4 flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden">
          {pet.image ? (
            <img src={pet.image} alt={pet.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-2xl">🐾</div>
          )}
        </div>
        
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-gray-900">{pet.name}</h3>
              <p className="text-sm text-gray-500">{pet.breed || pet.type}</p>
            </div>
            <span className={`px-2 py-1 text-xs rounded-full ${
              pet.gender === 'male' ? 'bg-blue-50 text-blue-600' : 
              pet.gender === 'female' ? 'bg-pink-50 text-pink-600' : 
              'bg-gray-100 text-gray-600'
            }`}>
              {pet.gender === 'male' ? '♂ Male' : pet.gender === 'female' ? '♀ Female' : 'Unknown'}
            </span>
          </div>
          
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {pet.age ? `${pet.age} yrs` : 'Age N/A'}
            </div>
            <div className="flex items-center gap-1">
              <Weight className="w-3 h-3" />
              {pet.weight ? `${pet.weight} kg` : 'Weight N/A'}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
