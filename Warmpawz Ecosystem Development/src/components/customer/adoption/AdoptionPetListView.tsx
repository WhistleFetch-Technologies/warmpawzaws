import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Calendar } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';
import { ImageWithFallback } from '../../figma/ImageWithFallback';

interface AdoptionPetListViewProps {
  phone: string;
  centerId: string;
  centerName: string | null;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function AdoptionPetListView({ phone, centerId, centerName, onBack, onNavigate }: AdoptionPetListViewProps) {
  const [pets, setPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock pets for now - can be replaced with real API call
    setPets([
      { id: '1', name: 'Max', breed: 'Golden Retriever', age: '2 years', gender: 'Male', vaccinated: true },
      { id: '2', name: 'Bella', breed: 'Labrador', age: '1 year', gender: 'Female', vaccinated: true },
      { id: '3', name: 'Charlie', breed: 'Beagle', age: '3 years', gender: 'Male', vaccinated: true }
    ]);
    setLoading(false);
  }, [centerId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold">Available Pets</h1>
            <p className="text-sm text-gray-600">{centerName}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {pets.map((pet) => (
          <div key={pet.id} className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex gap-3">
              <div className="w-24 h-24 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold">
                {pet.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{pet.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{pet.breed}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>{pet.age}</span>
                  <span>•</span>
                  <span>{pet.gender}</span>
                  {pet.vaccinated && (
                    <>
                      <span>•</span>
                      <span className="text-green-600">✓ Vaccinated</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => onNavigate('apply', { petId: pet.id, petData: pet })}
              className="w-full mt-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white py-2 rounded-lg font-medium hover:shadow-lg transition-all"
            >
              Apply to Adopt
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
