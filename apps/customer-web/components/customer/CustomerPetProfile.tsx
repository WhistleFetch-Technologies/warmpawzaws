'use client';

import { useState, useRef } from 'react';
import { Plus, Camera } from 'lucide-react';
import { apiClient, isUatMode } from '@/lib/api-client';

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  age: string;
  gender: string;
  weight: string;
  photo?: string;
  microchipId?: string;
  healthRecords?: {
    lastCheckup?: string;
    allergies?: string;
    medications?: string;
    conditions?: string;
  };
}

interface CustomerPetProfileProps {
  phone: string;
  onComplete: (pets: Pet[]) => void;
  onBack?: () => void;
}

export function CustomerPetProfile({ phone, onComplete, onBack }: CustomerPetProfileProps) {
  const [currentStep, setCurrentStep] = useState<'list' | 'basic' | 'health'>('list');
  const [pets, setPets] = useState<Pet[]>([]);
  const [currentPet, setCurrentPet] = useState<Pet>({
    id: '',
    name: '',
    type: 'Dog',
    breed: '',
    age: '',
    gender: '',
    weight: '',
    photo: '',
    microchipId: '',
    healthRecords: {
      lastCheckup: '',
      allergies: '',
      medications: '',
      conditions: ''
    }
  });
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setCurrentPet({ ...currentPet, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPet = () => {
    setCurrentPet({
      id: '',
      name: '',
      type: 'Dog',
      breed: '',
      age: '',
      gender: '',
      weight: '',
      photo: '',
      microchipId: '',
      healthRecords: {}
    });
    setPhotoPreview('');
    setCurrentStep('basic');
  };

  const handleEditPet = (pet: Pet) => {
    setCurrentPet(pet);
    setPhotoPreview(pet.photo || '');
    setCurrentStep('basic');
  };

  const handleSavePet = () => {
    if (!currentPet.name || !currentPet.type || !currentPet.breed || !currentPet.age) {
      setError('Please fill in all required fields (Name, Type, Breed, Age)');
      return;
    }

    const petId = currentPet.id || `pet_${Date.now()}`;
    const updatedPet = { ...currentPet, id: petId };

    if (currentPet.id) {
      setPets(pets.map(p => p.id === currentPet.id ? updatedPet : p));
    } else {
      setPets([...pets, updatedPet]);
    }

    setCurrentStep('list');
    resetCurrentPet();
  };

  const resetCurrentPet = () => {
    setCurrentPet({
      id: '',
      name: '',
      type: 'Dog',
      breed: '',
      age: '',
      gender: '',
      weight: '',
      photo: '',
      microchipId: '',
      healthRecords: {}
    });
    setPhotoPreview('');
    setError(null);
  };

  const handleDeletePet = (petId: string) => {
    setPets(pets.filter(p => p.id !== petId));
  };

  const handleComplete = async () => {
    if (pets.length === 0) {
      setError('Please add at least one pet profile');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // UAT Mode: Skip API call
      if (isUatMode()) {
        console.log('🔧 [UAT Mode] Pets saved locally:', pets);
        localStorage.setItem('customerPets', JSON.stringify(pets));
        onComplete(pets);
        return;
      }

      await apiClient.post('/customer/pets', {
        phone: phone,
        pets: pets,
      });

      console.log('✅ Pets saved successfully');
      localStorage.setItem('customerPets', JSON.stringify(pets));
      onComplete(pets);
    } catch (err: any) {
      console.error('Error saving pets:', err);
      
      // UAT Fallback
      if (isUatMode()) {
        console.log('🔧 [UAT Fallback] Saving pets locally');
        localStorage.setItem('customerPets', JSON.stringify(pets));
        onComplete(pets);
        return;
      }
      
      setError(err.message || 'Failed to save pets');
    } finally {
      setLoading(false);
    }
  };

  const renderPetList = () => (
    <>
      {/* Logo */}
      <div className="flex justify-center pt-8 mb-6">
        <img src="/logo.png" alt="Warmpawz" className="w-16 h-16 object-contain" />
      </div>

      {/* Header */}
      <div className="flex flex-col items-center mb-8 px-6">
        <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <ellipse cx="24" cy="30" rx="11" ry="13" fill="white"/>
            <path d="M24 28C22.5 26.5 20 26.5 18.5 28C17 29.5 17 32 18.5 33.5L24 39L29.5 33.5C31 32 31 29.5 29.5 28C28 26.5 25.5 26.5 24 28Z" fill="#FF8C42"/>
            <ellipse cx="16" cy="16" rx="5" ry="7" transform="rotate(-15 16 16)" fill="white"/>
            <ellipse cx="22" cy="12" rx="5" ry="7" transform="rotate(-5 22 12)" fill="white"/>
            <ellipse cx="26" cy="12" rx="5" ry="7" transform="rotate(5 26 12)" fill="white"/>
            <ellipse cx="32" cy="16" rx="5" ry="7" transform="rotate(15 32 16)" fill="white"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 text-center">Create Pet<br />Profile(s) 🐾</h1>
      </div>

      {/* Content */}
      <div className="px-6 mb-6">
        <p className="text-center text-gray-600 mb-6 text-sm">
          Add your furry family members 💕<br />
          You can add multiple pets
        </p>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <span className="text-red-500 text-xl">⚠️</span>
            <p className="text-red-600 text-sm flex-1">{error}</p>
          </div>
        )}

        {/* Pet Cards */}
        {pets.length > 0 ? (
          <div className="space-y-4 mb-6">
            {pets.map((pet) => (
              <div key={pet.id} className="bg-white border-2 border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 bg-orange-100 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {pet.photo ? (
                      <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">
                        {pet.type === 'Dog' ? '🐕' : pet.type === 'Cat' ? '🐈' : '🐾'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">{pet.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {pet.breed} • {pet.age} {pet.age === '1' ? 'year' : 'years'} • {pet.gender}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditPet(pet)}
                        className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePet(pet.id)}
                        className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6 mb-6 text-center">
            <span className="text-4xl mb-3 block">🐾</span>
            <p className="text-sm text-gray-700">
              No pets added yet.<br />
              Click below to add your first pet!
            </p>
          </div>
        )}

        {/* Add Pet Button */}
        <button
          onClick={handleAddPet}
          className="w-full border-2 border-dashed border-primary bg-orange-50 rounded-2xl p-4 flex items-center justify-center gap-2 text-primary hover:bg-orange-100 transition-all mb-6"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Pet</span>
        </button>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-xs text-blue-900 text-center">
            💡 You can add as many pets as you have!<br />
            Each pet gets their own health & booking history.
          </p>
        </div>
      </div>
    </>
  );

  const renderBasicInfo = () => (
    <>
      {/* Logo */}
      <div className="flex justify-center pt-8 mb-6">
        <img src="/logo.png" alt="Warmpawz" className="w-16 h-16 object-contain" />
      </div>

      {/* Header */}
      <div className="flex flex-col items-center mb-6 px-6">
        <h1 className="text-2xl font-bold text-gray-900 text-center">
          {currentPet.id ? 'Edit' : 'Add'} Pet<br />Basic Info 📝
        </h1>
      </div>

      {/* Content */}
      <div className="px-6 mb-6">
        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <span className="text-red-500 text-xl">⚠️</span>
            <p className="text-red-600 text-sm flex-1">{error}</p>
          </div>
        )}

        {/* Photo Upload */}
        <div className="flex flex-col items-center mb-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-32 h-32 bg-orange-100 rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:bg-orange-200 transition-all border-4 border-white shadow-lg mb-3 relative group"
          >
            {photoPreview ? (
              <>
                <img src={photoPreview} alt="Pet" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <Camera className="w-10 h-10 text-primary mb-2" />
                <span className="text-xs text-primary">Add Photo</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
          <p className="text-xs text-gray-500 text-center">
            Click to upload your pet's photo
          </p>
        </div>

        {/* Pet Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pet Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={currentPet.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPet({ ...currentPet, name: e.target.value })}
            placeholder="e.g., Oreo, Max, Bella"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Pet Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pet Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {['Dog', 'Cat', 'Other'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setCurrentPet({ ...currentPet, type })}
                className={`py-3 px-4 border-2 rounded-xl transition-all font-medium ${
                  currentPet.type === type
                    ? 'border-primary bg-orange-50 text-primary'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {type === 'Dog' ? '🐕' : type === 'Cat' ? '🐈' : '🐾'} {type}
              </button>
            ))}
          </div>
        </div>

        {/* Breed */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Breed <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={currentPet.breed}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPet({ ...currentPet, breed: e.target.value })}
            placeholder="e.g., Golden Retriever, Persian"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Age and Gender Row */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Age (years) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={currentPet.age}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPet({ ...currentPet, age: e.target.value })}
              placeholder="e.g., 3"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gender
            </label>
            <select
              value={currentPet.gender}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCurrentPet({ ...currentPet, gender: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all"
            >
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
        </div>

        {/* Weight */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Weight (kg)
          </label>
          <input
            type="number"
            step="0.1"
            value={currentPet.weight}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPet({ ...currentPet, weight: e.target.value })}
            placeholder="e.g., 12.5"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={() => { setCurrentStep('list'); resetCurrentPet(); }}
            className="flex-1 h-12 border-2 border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSavePet}
            className="flex-1 h-12 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary/30"
          >
            Save Pet
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col w-full max-w-[430px] mx-auto">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        {currentStep === 'list' && renderPetList()}
        {currentStep === 'basic' && renderBasicInfo()}
      </div>

      {/* Fixed Bottom Navigation - Only show on list view */}
      {currentStep === 'list' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 max-w-[430px] mx-auto w-full">
          <button
            onClick={handleComplete}
            disabled={loading || pets.length === 0}
            className="w-full h-14 bg-primary hover:bg-primary-dark text-white font-semibold rounded-2xl disabled:opacity-50 transition-all shadow-lg shadow-primary/30"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </span>
            ) : (
              `Continue with ${pets.length} Pet${pets.length !== 1 ? 's' : ''}`
            )}
          </button>
          
          {onBack && (
            <button
              onClick={onBack}
              className="w-full mt-3 py-3 text-gray-600 text-sm hover:text-gray-800 transition"
            >
              Go Back
            </button>
          )}
        </div>
      )}
    </div>
  );
}

