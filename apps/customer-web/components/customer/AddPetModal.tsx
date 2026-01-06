'use client';

import { useState, useRef } from 'react';
import { X, Camera, Upload, ChevronRight, ChevronLeft } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  age: string;
  gender: string;
  weight: string;
  color?: string;
  photo?: string;
  microchipId?: string;
  medicalHistory?: string;
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

interface AddPetModalProps {
  phone: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPetModal({ phone, isOpen, onClose, onSuccess }: AddPetModalProps) {
  const [currentStep, setCurrentStep] = useState<'basic' | 'health' | 'vaccination'>('basic');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [petData, setPetData] = useState<Pet>({
    id: `pet_${Date.now()}`,
    name: '',
    type: 'Dog',
    breed: '',
    age: '',
    gender: '',
    weight: '',
    color: '',
    photo: '',
    microchipId: '',
    medicalHistory: '',
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
  
  const [photoPreview, setPhotoPreview] = useState<string>('');

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPhotoPreview(base64String);
        setPetData({ ...petData, photo: base64String });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePet = async () => {
    if (!petData.name || !petData.type || !petData.breed || !petData.age) {
      alert('Please fill in all required fields (Name, Type, Breed, Age)');
      return;
    }
    
    setLoading(true);
    
    try {
      const getPetsResponse: any = await apiClient.get(`/customer/pets/${phone}`);
      
      let existingPets: Pet[] = [];
      if (Array.isArray(getPetsResponse)) {
        existingPets = getPetsResponse;
      } else if (Array.isArray(getPetsResponse.pets)) {
        existingPets = getPetsResponse.pets;
      } else if (getPetsResponse.pets?.pets && Array.isArray(getPetsResponse.pets.pets)) {
        existingPets = getPetsResponse.pets.pets;
      }
      
      const updatedPets = [...existingPets, petData];
      
      await apiClient.post('/customer/pets', {
        phone: phone,
        pets: updatedPets
      });
      
      alert('✅ Pet added successfully!');
      onSuccess();
      onClose();
      
      // Reset form
      setPetData({
        id: `pet_${Date.now()}`,
        name: '',
        type: 'Dog',
        breed: '',
        age: '',
        gender: '',
        weight: '',
        color: '',
        photo: '',
        microchipId: '',
        medicalHistory: '',
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
    } catch (error) {
      console.error('Error saving pet:', error);
      alert('❌ Error saving pet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-[430px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary to-primary-dark px-6 py-6 flex items-center justify-between z-10">
          <h2 className="text-white font-bold text-lg">Add New Pet</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {(['basic', 'health', 'vaccination'] as const).map((step, index) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                    currentStep === step 
                      ? 'bg-primary text-white' 
                      : index < (['basic', 'health', 'vaccination'].indexOf(currentStep))
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                  }`}>
                    {index < (['basic', 'health', 'vaccination'].indexOf(currentStep)) ? '✓' : index + 1}
                  </div>
                  <span className={`text-xs mt-1 ${
                    currentStep === step ? 'text-primary font-semibold' : 'text-gray-500'
                  }`}>
                    {step === 'basic' ? 'Basic' : step === 'health' ? 'Health' : 'Vaccination'}
                  </span>
                </div>
                {index < 2 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    index < (['basic', 'health', 'vaccination'].indexOf(currentStep))
                      ? 'bg-green-500'
                      : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* Basic Info Step */}
          {currentStep === 'basic' && (
            <div className="space-y-5">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Basic Information</h3>
              
              {/* Photo Upload */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 border-4 border-white shadow-lg">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Pet" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-5xl">
                          {petData.type === 'Dog' ? '🐕' : petData.type === 'Cat' ? '🐈' : '🐾'}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                  >
                    <Camera className="w-5 h-5 text-white" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Tap to add photo</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Pet Name *</label>
                <input
                  type="text"
                  value={petData.name}
                  onChange={(e) => setPetData({ ...petData, name: e.target.value })}
                  placeholder="Enter pet name"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Type *</label>
                <select
                  value={petData.type}
                  onChange={(e) => setPetData({ ...petData, type: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                >
                  <option value="Dog">Dog</option>
                  <option value="Cat">Cat</option>
                  <option value="Bird">Bird</option>
                  <option value="Rabbit">Rabbit</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Breed *</label>
                <input
                  type="text"
                  value={petData.breed}
                  onChange={(e) => setPetData({ ...petData, breed: e.target.value })}
                  placeholder="Enter breed"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Age *</label>
                  <input
                    type="text"
                    value={petData.age}
                    onChange={(e) => setPetData({ ...petData, age: e.target.value })}
                    placeholder="e.g., 2 years"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Gender</label>
                  <select
                    value={petData.gender}
                    onChange={(e) => setPetData({ ...petData, gender: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Weight</label>
                <input
                  type="text"
                  value={petData.weight}
                  onChange={(e) => setPetData({ ...petData, weight: e.target.value })}
                  placeholder="e.g., 15 kg"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                />
              </div>

              <button
                onClick={() => setCurrentStep('health')}
                className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
              >
                Next: Health Info
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Health Info Step */}
          {currentStep === 'health' && (
            <div className="space-y-5">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Health Information</h3>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Last Checkup Date</label>
                <input
                  type="date"
                  value={petData.healthRecords?.lastCheckup || ''}
                  onChange={(e) => setPetData({
                    ...petData,
                    healthRecords: { ...petData.healthRecords!, lastCheckup: e.target.value }
                  })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Allergies</label>
                <textarea
                  value={petData.healthRecords?.allergies || ''}
                  onChange={(e) => setPetData({
                    ...petData,
                    healthRecords: { ...petData.healthRecords!, allergies: e.target.value }
                  })}
                  placeholder="List any allergies"
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Current Medications</label>
                <textarea
                  value={petData.healthRecords?.medications || ''}
                  onChange={(e) => setPetData({
                    ...petData,
                    healthRecords: { ...petData.healthRecords!, medications: e.target.value }
                  })}
                  placeholder="List current medications"
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Medical Conditions</label>
                <textarea
                  value={petData.healthRecords?.conditions || ''}
                  onChange={(e) => setPetData({
                    ...petData,
                    healthRecords: { ...petData.healthRecords!, conditions: e.target.value }
                  })}
                  placeholder="List any medical conditions"
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep('basic')}
                  className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep('vaccination')}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
                >
                  Next: Vaccination
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Vaccination Step */}
          {currentStep === 'vaccination' && (
            <div className="space-y-5">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Vaccination Records</h3>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Rabies</label>
                <input
                  type="date"
                  value={petData.vaccinations?.rabies || ''}
                  onChange={(e) => setPetData({
                    ...petData,
                    vaccinations: { ...petData.vaccinations!, rabies: e.target.value }
                  })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Distemper</label>
                <input
                  type="date"
                  value={petData.vaccinations?.distemper || ''}
                  onChange={(e) => setPetData({
                    ...petData,
                    vaccinations: { ...petData.vaccinations!, distemper: e.target.value }
                  })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Parvovirus</label>
                <input
                  type="date"
                  value={petData.vaccinations?.parvovirus || ''}
                  onChange={(e) => setPetData({
                    ...petData,
                    vaccinations: { ...petData.vaccinations!, parvovirus: e.target.value }
                  })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Other Vaccinations</label>
                <textarea
                  value={petData.vaccinations?.other || ''}
                  onChange={(e) => setPetData({
                    ...petData,
                    vaccinations: { ...petData.vaccinations!, other: e.target.value }
                  })}
                  placeholder="List other vaccinations"
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setCurrentStep('health')}
                  className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>
                <button
                  onClick={handleSavePet}
                  disabled={loading}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      Save Pet
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

