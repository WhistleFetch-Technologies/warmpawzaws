'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Plus, Camera, X } from 'lucide-react';
// ImageWithFallback component not found - using img tag instead
import { apiClient } from '@/lib/api-client';

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  age: string;
  gender: string;
  weight: string;
  photo?: string;
  color?: string;
  microchipId?: string;
  healthRecords?: {
    lastCheckup?: string;
    allergies?: string;
    medications?: string;
    conditions?: string;
  };
  vaccinations?: {
    rabies?: string;
    distemper?: string;
    parvovirus?: string;
    other?: string;
  };
}

interface CustomerPetProfileProps {
  session: any;
  prefillData?: any;
  onComplete: (pets: Pet[]) => void;
  onBack?: () => void;
}

export function CustomerPetProfile({ session, prefillData, onComplete, onBack }: CustomerPetProfileProps) {
  const [currentStep, setCurrentStep] = useState<'list' | 'basic' | 'health' | 'vaccination'>('list');
  const [pets, setPets] = useState<Pet[]>([]);
  const [currentPet, setCurrentPet] = useState<Pet>({
    id: '',
    name: prefillData?.petName || '',
    type: prefillData?.petType || 'Dog',
    breed: prefillData?.breed || '',
    age: prefillData?.age || prefillData?.petAge || '',
    gender: prefillData?.gender || '',
    weight: prefillData?.weight || '',
    photo: '',
    microchipId: '',
    healthRecords: {
      lastCheckup: '',
      allergies: prefillData?.healthInfo?.allergies || '',
      medications: prefillData?.healthInfo?.medications || '',
      conditions: ''
    },
    vaccinations: {
      rabies: '',
      distemper: '',
      parvovirus: '',
      other: ''
    }
  });
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  // Load existing pets from backend on mount
  useEffect(() => {
    const loadExistingPets = async () => {
      if (!session?.phone) return;
      try {
        const response = await apiClient.get(`/customer/pets/${session.phone}`) as any;
        if (response?.pets && Array.isArray(response.pets) && response.pets.length > 0) {
          const mappedPets: Pet[] = response.pets.map((p: any) => ({
            id: p.id,
            name: p.name || '',
            type: p.type || p.species || 'Dog',
            breed: p.breed || '',
            age: String(p.age || p.age_years || ''),
            gender: p.gender || '',
            weight: String(p.weight || p.weight_kg || ''),
            photo: p.photo || p.profile_photo_url || '',
            microchipId: p.microchipId || p.microchip_id || '',
            healthRecords: p.healthRecords || {},
            vaccinations: p.vaccinations || {},
          }));
          setPets(mappedPets);
          console.log('✅ Loaded existing pets:', mappedPets.length);
        }
      } catch (error) {
        console.error('Error loading existing pets:', error);
      }
    };
    loadExistingPets();
  }, [session?.phone]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      
      // Show preview immediately
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Upload to S3
      try {
        setLoading(true);
        const { uploadPetPhoto } = await import('@/lib/photo-upload');
        const result = await uploadPetPhoto(file, currentPet.id || `pet_${Date.now()}`, session.phone);
        
        if (result.success && result.publicUrl) {
          setCurrentPet({ ...currentPet, photo: result.publicUrl });
          console.log('✅ Pet photo uploaded to S3:', result.publicUrl);
        } else {
          console.error('Failed to upload photo:', result.error);
          // Fallback to base64 if S3 upload fails
          const base64Reader = new FileReader();
          base64Reader.onloadend = () => {
            setCurrentPet({ ...currentPet, photo: base64Reader.result as string });
          };
          base64Reader.readAsDataURL(file);
        }
      } catch (error) {
        console.error('Error uploading photo to S3:', error);
        // Fallback to base64
        const base64Reader = new FileReader();
        base64Reader.onloadend = () => {
          setCurrentPet({ ...currentPet, photo: base64Reader.result as string });
        };
        base64Reader.readAsDataURL(file);
      } finally {
        setLoading(false);
      }
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
      healthRecords: {
        lastCheckup: '',
        allergies: '',
        medications: '',
        conditions: ''
      },
      vaccinations: {
        rabies: '',
        distemper: '',
        parvovirus: '',
        other: ''
      }
    });
    setPhotoPreview('');
    setCurrentStep('basic');
  };

  const handleEditPet = (pet: Pet) => {
    setCurrentPet(pet);
    setPhotoPreview(pet.photo || '');
    setCurrentStep('basic');
  };

  const handleSavePet = async () => {
    if (!currentPet.name || !currentPet.type || !currentPet.breed || !currentPet.age) {
      alert('Please fill in all required fields (Name, Type, Breed, Age)');
      return;
    }

    setLoading(true);
    try {
      const petId = currentPet.id || `pet_${Date.now()}`;
      const updatedPet = { ...currentPet, id: petId };

      // Save to backend immediately
      try {
        // Get existing pets
        const getPetsData = await apiClient.get(`/customer/pets/${session.phone}`) as any;
        let existingPets = [];
        const petsData = getPetsData as any;
        if (Array.isArray(petsData)) {
          existingPets = petsData;
        } else if (Array.isArray(petsData.pets)) {
          existingPets = petsData.pets;
        } else if (petsData.pets?.pets && Array.isArray(petsData.pets.pets)) {
          existingPets = petsData.pets.pets;
        }

        // Update or add pet
        let updatedPets;
        if (currentPet.id) {
          // Update existing pet
          updatedPets = existingPets.map((p: any) => p.id === currentPet.id ? updatedPet : p);
        } else {
          // Add new pet
          updatedPets = [...existingPets, updatedPet];
        }

        // Save to backend
        await apiClient.post('/customer/pets', {
          phone: session.phone,
          pets: updatedPets,
        });

        console.log('✅ Pet saved to backend');
      } catch (error) {
        console.error('Error saving pet to backend:', error);
        // Continue with local state update even if backend save fails
      }

      // Update local state
      if (currentPet.id) {
        // Update existing pet
        setPets(pets.map(p => p.id === currentPet.id ? updatedPet : p));
      } else {
        // Add new pet
        setPets([...pets, updatedPet]);
      }

      setCurrentStep('list');
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
        healthRecords: {},
        vaccinations: {}
      });
      setPhotoPreview('');
      
      alert(`${updatedPet.name} saved successfully! 🎉`);
    } catch (error) {
      console.error('Error saving pet:', error);
      alert('Error saving pet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePet = (petId: string) => {
    setPets(pets.filter(p => p.id !== petId));
  };

  const handleComplete = async () => {
    if (pets.length === 0) {
      alert('Please add at least one pet profile');
      return;
    }
    
    setLoading(true);
    try {
      // Save pets data to backend - AWS Serverless compatible
      await apiClient.post('/customer/pets', {
        phone: session.phone,
        pets: pets,
      });

      console.log('Pets saved successfully');
      onComplete(pets);
    } catch (error) {
      console.error('Error saving pets:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const renderPetList = () => (
    <>
      {/* Logo */}
      <div className="flex justify-center pt-8 mb-6">
        <img src={'/logo.png'} alt="WarmPawz" className="w-16 h-16 object-contain" />
      </div>

      {/* Orange Circle Icon */}
      <div className="flex flex-col items-center mb-8 px-6">
        <div className="w-24 h-24 bg-[#FF8C42] rounded-full flex items-center justify-center mb-4">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <ellipse cx="24" cy="30" rx="11" ry="13" fill="white"/>
            <path d="M24 28C22.5 26.5 20 26.5 18.5 28C17 29.5 17 32 18.5 33.5L24 39L29.5 33.5C31 32 31 29.5 29.5 28C28 26.5 25.5 26.5 24 28Z" fill="#FF8C42"/>
            <ellipse cx="16" cy="16" rx="5" ry="7" transform="rotate(-15 16 16)" fill="white"/>
            <ellipse cx="22" cy="12" rx="5" ry="7" transform="rotate(-5 22 12)" fill="white"/>
            <ellipse cx="26" cy="12" rx="5" ry="7" transform="rotate(5 26 12)" fill="white"/>
            <ellipse cx="32" cy="16" rx="5" ry="7" transform="rotate(15 32 16)" fill="white"/>
          </svg>
        </div>
        <h1 className="text-black text-center">Create Pet<br />Profile(s) 🐾</h1>
      </div>

      {/* Content */}
      <div className="px-6 mb-6">
        <p className="text-center text-gray-700 mb-6 text-sm">
          Add your furry family members 💕<br />
          You can add multiple pets
        </p>

        {/* Pet Cards */}
        {pets.length > 0 ? (
          <div className="space-y-4 mb-6">
            {pets.map((pet) => (
              <div key={pet.id} className="bg-white border-2 border-gray-200 rounded-2xl p-4">
                <div className="flex items-start gap-4">
                  {/* Pet Photo */}
                  <div className="w-20 h-20 bg-orange-100 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {pet.photo ? (
                      <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">
                        {pet.type === 'Dog' ? '🐕' : pet.type === 'Cat' ? '🐈' : '🐾'}
                      </span>
                    )}
                  </div>

                  {/* Pet Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-black font-semibold mb-1">{pet.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {pet.breed} • {pet.age} {pet.age === '1' ? 'year' : 'years'} • {pet.gender}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditPet(pet)}
                        className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded-lg"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePet(pet.id)}
                        className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-lg"
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
          className="w-full border-2 border-dashed border-[#FF8C42] bg-orange-50 rounded-2xl p-4 flex items-center justify-center gap-2 text-[#FF8C42] hover:bg-orange-100 transition-all mb-6"
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
        <img src={'/logo.png'} alt="WarmPawz" className="w-16 h-16 object-contain" />
      </div>

      {/* Header */}
      <div className="flex flex-col items-center mb-6 px-6">
        <h1 className="text-black text-center">{currentPet.id ? 'Edit' : 'Add'} Pet<br />Basic Info 📝</h1>
      </div>

      {/* Content */}
      <div className="px-6 mb-6">
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
                <Camera className="w-10 h-10 text-[#FF8C42] mb-2" />
                <span className="text-xs text-[#FF8C42]">Add Photo</span>
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
            onChange={(e) => setCurrentPet({ ...currentPet, name: e.target.value })}
            placeholder="e.g., Oreo, Max, Bella"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
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
                onClick={() => setCurrentPet({ ...currentPet, type })}
                className={`py-3 px-4 border-2 rounded-xl transition-all ${
                  currentPet.type === type
                    ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                    : 'border-gray-200 text-gray-700'
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
            onChange={(e) => setCurrentPet({ ...currentPet, breed: e.target.value })}
            placeholder="e.g., Golden Retriever, Persian"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
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
              onChange={(e) => setCurrentPet({ ...currentPet, age: e.target.value })}
              placeholder="e.g., 3"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gender
            </label>
            <select
              value={currentPet.gender}
              onChange={(e) => setCurrentPet({ ...currentPet, gender: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
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
            onChange={(e) => setCurrentPet({ ...currentPet, weight: e.target.value })}
            placeholder="e.g., 12.5"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
          />
        </div>

        {/* Microchip ID */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Microchip ID (Optional)
          </label>
          <input
            type="text"
            value={currentPet.microchipId}
            onChange={(e) => setCurrentPet({ ...currentPet, microchipId: e.target.value })}
            placeholder="e.g., 123456789012345"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={() => setCurrentStep('health')}
            className="flex-1 h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-xl text-white"
          >
            Next: Health Records
          </Button>
        </div>

        <button
          onClick={() => {
            setCurrentStep('list');
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
              healthRecords: {},
              vaccinations: {}
            });
            setPhotoPreview('');
          }}
          className="w-full mt-3 py-3 text-gray-600 text-sm"
        >
          Cancel
        </button>
      </div>
    </>
  );

  const renderHealthRecords = () => (
    <>
      {/* Logo */}
      <div className="flex justify-center pt-8 mb-6">
        <img src={'/logo.png'} alt="WarmPawz" className="w-16 h-16 object-contain" />
      </div>

      {/* Header */}
      <div className="flex flex-col items-center mb-6 px-6">
        <div className="w-24 h-24 bg-[#FF8C42] rounded-full flex items-center justify-center mb-4">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="14" y="10" width="20" height="28" rx="2" stroke="white" strokeWidth="3" fill="none"/>
            <path d="M20 18H28M20 24H28M20 30H25" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="text-black text-center">Health<br />Records 🏥</h1>
      </div>

      {/* Content */}
      <div className="px-6 mb-6">
        <p className="text-center text-gray-700 mb-6 text-sm">
          Keep track of {currentPet.name}'s health<br />
          (You can skip and add later)
        </p>

        {/* Last Checkup */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Last Checkup Date
          </label>
          <input
            type="date"
            value={currentPet.healthRecords?.lastCheckup || ''}
            onChange={(e) => setCurrentPet({
              ...currentPet,
              healthRecords: { ...currentPet.healthRecords, lastCheckup: e.target.value }
            })}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
          />
        </div>

        {/* Allergies */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Known Allergies
          </label>
          <textarea
            value={currentPet.healthRecords?.allergies || ''}
            onChange={(e) => setCurrentPet({
              ...currentPet,
              healthRecords: { ...currentPet.healthRecords, allergies: e.target.value }
            })}
            placeholder="e.g., Chicken, Pollen"
            rows={2}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none"
          />
        </div>

        {/* Medications */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current Medications
          </label>
          <textarea
            value={currentPet.healthRecords?.medications || ''}
            onChange={(e) => setCurrentPet({
              ...currentPet,
              healthRecords: { ...currentPet.healthRecords, medications: e.target.value }
            })}
            placeholder="e.g., Antibiotics, Supplements"
            rows={2}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none"
          />
        </div>

        {/* Medical Conditions */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Medical Conditions
          </label>
          <textarea
            value={currentPet.healthRecords?.conditions || ''}
            onChange={(e) => setCurrentPet({
              ...currentPet,
              healthRecords: { ...currentPet.healthRecords, conditions: e.target.value }
            })}
            placeholder="e.g., Diabetes, Hip Dysplasia"
            rows={2}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-3">
          <Button
            onClick={() => setCurrentStep('basic')}
            variant="outline"
            className="flex-1 h-12 border-2 border-gray-300 rounded-xl"
          >
            Back
          </Button>
          <Button
            onClick={() => setCurrentStep('vaccination')}
            className="flex-1 h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-xl text-white"
          >
            Next: Vaccinations
          </Button>
        </div>

        <button
          onClick={handleSavePet}
          className="w-full py-3 text-blue-600 text-sm"
        >
          Skip & Save Pet
        </button>
      </div>
    </>
  );

  const renderVaccinations = () => (
    <>
      {/* Logo */}
      <div className="flex justify-center pt-8 mb-6">
        <img src={'/logo.png'} alt="WarmPawz" className="w-16 h-16 object-contain" />
      </div>

      {/* Header */}
      <div className="flex flex-col items-center mb-6 px-6">
        <div className="w-24 h-24 bg-[#FF8C42] rounded-full flex items-center justify-center mb-4">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="14" stroke="white" strokeWidth="3" fill="none"/>
            <path d="M18 24L22 28L30 20" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-black text-center">Vaccination<br />Records 💉</h1>
      </div>

      {/* Content */}
      <div className="px-6 mb-6">
        <p className="text-center text-gray-700 mb-6 text-sm">
          Track {currentPet.name}'s vaccination dates<br />
          (Optional - add when available)
        </p>

        {/* Rabies */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rabies Vaccine Date
          </label>
          <input
            type="date"
            value={currentPet.vaccinations?.rabies || ''}
            onChange={(e) => setCurrentPet({
              ...currentPet,
              vaccinations: { ...currentPet.vaccinations, rabies: e.target.value }
            })}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
          />
        </div>

        {/* Distemper */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Distemper Vaccine Date
          </label>
          <input
            type="date"
            value={currentPet.vaccinations?.distemper || ''}
            onChange={(e) => setCurrentPet({
              ...currentPet,
              vaccinations: { ...currentPet.vaccinations, distemper: e.target.value }
            })}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
          />
        </div>

        {/* Parvovirus */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Parvovirus Vaccine Date
          </label>
          <input
            type="date"
            value={currentPet.vaccinations?.parvovirus || ''}
            onChange={(e) => setCurrentPet({
              ...currentPet,
              vaccinations: { ...currentPet.vaccinations, parvovirus: e.target.value }
            })}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
          />
        </div>

        {/* Other Vaccinations */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Other Vaccinations
          </label>
          <textarea
            value={currentPet.vaccinations?.other || ''}
            onChange={(e) => setCurrentPet({
              ...currentPet,
              vaccinations: { ...currentPet.vaccinations, other: e.target.value }
            })}
            placeholder="e.g., Bordetella - Jan 2024"
            rows={2}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none"
          />
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-xs text-blue-900 text-center">
            💡 Keeping vaccination records updated helps<br />
            veterinarians provide better care!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={() => setCurrentStep('health')}
            variant="outline"
            className="flex-1 h-12 border-2 border-gray-300 rounded-xl"
          >
            Back
          </Button>
          <Button
            onClick={handleSavePet}
            className="flex-1 h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-xl text-white"
          >
            Save Pet
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col w-full max-w-[430px] mx-auto">
      {/* Status Bar */}
      <div className="px-6 pt-3 pb-2 flex justify-between items-center">
        <span className="text-black text-sm">09:41</span>
        <div className="flex gap-1.5 items-center">
          <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
            <rect y="8" width="3" height="4" rx="0.5" fill="black"/>
            <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="black"/>
            <rect x="9" y="2" width="3" height="10" rx="0.5" fill="black"/>
            <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="black"/>
          </svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <path d="M0.5 7.5C2.5 5.5 5.5 4 8 4C10.5 4 13.5 5.5 15.5 7.5M3.5 10C5 8.5 6.5 8 8 8C9.5 8 11 8.5 12.5 10" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
            <rect x="0.75" y="1.5" width="20" height="9" rx="2" stroke="black" strokeWidth="1.5"/>
            <rect x="2.5" y="3" width="16.5" height="6" rx="1" fill="black"/>
            <rect x="22" y="4" width="2.5" height="4" rx="1" fill="black"/>
          </svg>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        {currentStep === 'list' && renderPetList()}
        {currentStep === 'basic' && renderBasicInfo()}
        {currentStep === 'health' && renderHealthRecords()}
        {currentStep === 'vaccination' && renderVaccinations()}
      </div>

      {/* Fixed Bottom Navigation */}
      {currentStep === 'list' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 max-w-[430px] mx-auto w-full">
          {onBack && (
            <Button
              onClick={onBack}
              variant="outline"
              className="w-full h-12 border-2 border-gray-300 rounded-xl mb-3"
            >
              Back
            </Button>
          )}
          <Button
            onClick={handleComplete}
            disabled={pets.length === 0 || loading}
            className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-xl text-white disabled:opacity-50"
          >
            {loading ? 'Saving...' : `Continue with ${pets.length} ${pets.length === 1 ? 'Pet' : 'Pets'}`}
          </Button>

          {/* Home Indicator */}
          <div className="flex justify-center mt-4">
            <div className="w-32 h-1 bg-black rounded-full"></div>
          </div>
        </div>
      )}
    </div>
  );
}