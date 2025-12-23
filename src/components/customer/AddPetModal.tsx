import React, { useState, useRef } from 'react';
import { Button } from '../ui/button';
import { X, Camera, Upload } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { LOGO_CIRCULAR_ORANGE, WARM_ORANGE } from '../../assets/design-tokens';
import { WarmpawzButton } from '../shared/design-system/WarmpawzButton';

const logoImage = LOGO_CIRCULAR_ORANGE;

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
      // Check file size (max 5MB)
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
    // Validate required fields
    if (!petData.name || !petData.type || !petData.breed || !petData.age) {
      alert('Please fill in all required fields (Name, Type, Breed, Age)');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('=== SAVING PET (SQL) ===');
      console.log('Phone:', phone);
      console.log('Pet Data:', petData);
      
      // ✅ SQL: Use phone directly as customerId (endpoint resolves phone to customer ID)
      const customerId = phone;
      
      // ✅ SQL: Create pet using single pet endpoint
      const petPayload = {
        name: petData.name,
        type: petData.type,
        breed: petData.breed,
        age: String(petData.age),
        gender: petData.gender || '',
        weight: petData.weight || '',
        color: petData.color || '',
        photo: petData.photo || '',
        medicalConditions: petData.healthRecords?.conditions || '',
        allergies: petData.healthRecords?.allergies || '',
        vaccinations: petData.vaccinations || {}
      };
      
      console.log('Creating pet with payload:', petPayload);
      
      const saveResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${customerId}/pets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(petPayload)
        }
      );
      
      const saveData = await saveResponse.json();
      
      if (!saveResponse.ok) {
        console.error('Save failed:', saveData);
        throw new Error(saveData.error || saveData.message || 'Failed to save pet');
      }
      
      console.log('✅ Pet saved successfully:', saveData);
      console.log('=== SAVE COMPLETE ===');
      
      // Show success message
      alert(`${petData.name} added successfully! 🎉`);
      
      // Call success callback to refresh data
      onSuccess();
      onClose();
      
    } catch (error) {
      console.error('❌ Error saving pet:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to save pet. Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const renderBasicInfo = () => (
    <div className="space-y-3">
      <h2 className="font-bold text-gray-900 text-center mb-1">Add Pet Basic Info</h2>
      
      {/* Photo Upload */}
      <div className="flex flex-col items-center mb-3">
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="w-24 h-24 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-80 transition-all border-4 border-white shadow-lg relative group"
        >
          {photoPreview ? (
            <>
              <img src={photoPreview} alt="Pet" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center" style={{ color: WARM_ORANGE }}>
              <Upload className="w-8 h-8 mb-1" />
              <span className="text-[10px] font-medium">Upload Photo</span>
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
        <p className="text-[10px] text-gray-500 mt-1.5 text-center">
          Click to upload pet photo (Optional)
        </p>
      </div>

      {/* Pet Name */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Pet Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={petData.name}
          onChange={(e) => setPetData({ ...petData, name: e.target.value })}
          placeholder="e.g., Oreo, Max, Bella"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none text-sm"
          onFocus={(e) => {
            e.currentTarget.style.borderColor = WARM_ORANGE;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${WARM_ORANGE}33`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#E5E7EB';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Pet Type */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Pet Type <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {['Dog', 'Cat', 'Other'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setPetData({ ...petData, type })}
              className={`py-2.5 px-3 border-2 rounded-xl transition-all font-medium text-xs ${
                petData.type === type
                  ? 'bg-orange-50'
                  }
                  style={{
                    borderColor: petData.type === type ? WARM_ORANGE : '#E5E7EB',
                    color: petData.type === type ? WARM_ORANGE : '#374151',
                    borderWidth: '2px'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              {type === 'Dog' ? '🐕' : type === 'Cat' ? '🐈' : '🐾'} {type}
            </button>
          ))}
        </div>
      </div>

      {/* Breed */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Breed <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={petData.breed}
          onChange={(e) => setPetData({ ...petData, breed: e.target.value })}
          placeholder="e.g., Golden Retriever, Persian"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none text-sm"
          onFocus={(e) => {
            e.currentTarget.style.borderColor = WARM_ORANGE;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${WARM_ORANGE}33`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#E5E7EB';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Age and Gender Row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Age (years) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={petData.age}
            onChange={(e) => setPetData({ ...petData, age: e.target.value })}
            placeholder="e.g., 3"
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none text-sm"
          onFocus={(e) => {
            e.currentTarget.style.borderColor = WARM_ORANGE;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${WARM_ORANGE}33`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#E5E7EB';
            e.currentTarget.style.boxShadow = 'none';
          }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Gender
          </label>
          <select
            value={petData.gender}
            onChange={(e) => setPetData({ ...petData, gender: e.target.value })}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none text-sm"
          onFocus={(e) => {
            e.currentTarget.style.borderColor = WARM_ORANGE;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${WARM_ORANGE}33`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#E5E7EB';
            e.currentTarget.style.boxShadow = 'none';
          }}
          >
            <option value="">Select</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      </div>

      {/* Weight and Color Row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Weight (kg)
          </label>
          <input
            type="number"
            step="0.1"
            value={petData.weight}
            onChange={(e) => setPetData({ ...petData, weight: e.target.value })}
            placeholder="e.g., 12.5"
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none text-sm"
          onFocus={(e) => {
            e.currentTarget.style.borderColor = WARM_ORANGE;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${WARM_ORANGE}33`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#E5E7EB';
            e.currentTarget.style.boxShadow = 'none';
          }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Color
          </label>
          <input
            type="text"
            value={petData.color}
            onChange={(e) => setPetData({ ...petData, color: e.target.value })}
            placeholder="e.g., Golden"
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none text-sm"
          onFocus={(e) => {
            e.currentTarget.style.borderColor = WARM_ORANGE;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${WARM_ORANGE}33`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#E5E7EB';
            e.currentTarget.style.boxShadow = 'none';
          }}
          />
        </div>
      </div>

      {/* Microchip ID */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Microchip ID (Optional)
        </label>
        <input
          type="text"
          value={petData.microchipId}
          onChange={(e) => setPetData({ ...petData, microchipId: e.target.value })}
          placeholder="e.g., 123456789012345"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none text-sm"
          onFocus={(e) => {
            e.currentTarget.style.borderColor = WARM_ORANGE;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${WARM_ORANGE}33`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#E5E7EB';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Medical History */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Medical History (Optional)
        </label>
        <textarea
          value={petData.medicalHistory}
          onChange={(e) => setPetData({ ...petData, medicalHistory: e.target.value })}
          placeholder="Any medical history, allergies, or special notes..."
          rows={2}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none text-sm"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2.5 pt-3">
        <Button
          onClick={onClose}
          variant="outline"
          className="flex-1 h-11 border-2 border-gray-300 rounded-xl text-sm"
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          onClick={() => setCurrentStep('health')}
          className="flex-1 h-11 rounded-xl text-white text-sm"
          style={{ backgroundColor: WARM_ORANGE }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#FF7A2E';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = WARM_ORANGE;
          }}
          disabled={loading}
        >
          Next: Health
        </Button>
      </div>
      
      <button
        onClick={handleSavePet}
        disabled={loading}
        className="w-full py-2.5 text-blue-600 text-xs font-medium hover:text-blue-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Skip & Save Pet'}
      </button>
    </div>
  );

  const renderHealthRecords = () => (
    <div className="space-y-3">
      <h2 className="font-bold text-gray-900 text-center mb-1">Health Records</h2>
      <p className="text-xs text-gray-600 text-center mb-2">
        Optional: Add health information for better care
      </p>

      {/* Last Checkup */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Last Checkup Date
        </label>
        <input
          type="date"
          value={petData.healthRecords?.lastCheckup || ''}
          onChange={(e) => setPetData({
            ...petData,
            healthRecords: { ...petData.healthRecords, lastCheckup: e.target.value }
          })}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none text-sm"
          onFocus={(e) => {
            e.currentTarget.style.borderColor = WARM_ORANGE;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${WARM_ORANGE}33`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#E5E7EB';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Allergies */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Known Allergies
        </label>
        <textarea
          value={petData.healthRecords?.allergies || ''}
          onChange={(e) => setPetData({
            ...petData,
            healthRecords: { ...petData.healthRecords, allergies: e.target.value }
          })}
          placeholder="e.g., Chicken, Pollen"
          rows={2}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none text-sm"
        />
      </div>

      {/* Medications */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Current Medications
        </label>
        <textarea
          value={petData.healthRecords?.medications || ''}
          onChange={(e) => setPetData({
            ...petData,
            healthRecords: { ...petData.healthRecords, medications: e.target.value }
          })}
          placeholder="e.g., Antibiotics, Supplements"
          rows={2}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none text-sm"
        />
      </div>

      {/* Medical Conditions */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Medical Conditions
        </label>
        <textarea
          value={petData.healthRecords?.conditions || ''}
          onChange={(e) => setPetData({
            ...petData,
            healthRecords: { ...petData.healthRecords, conditions: e.target.value }
          })}
          placeholder="e.g., Diabetes, Hip Dysplasia"
          rows={2}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none text-sm"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2.5 pt-3">
        <Button
          onClick={() => setCurrentStep('basic')}
          variant="outline"
          className="flex-1 h-11 border-2 border-gray-300 rounded-xl text-sm"
          disabled={loading}
        >
          Back
        </Button>
        <Button
          onClick={() => setCurrentStep('vaccination')}
          className="flex-1 h-11 rounded-xl text-white text-sm"
          style={{ backgroundColor: WARM_ORANGE }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#FF7A2E';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = WARM_ORANGE;
          }}
          disabled={loading}
        >
          Next: Vaccines
        </Button>
      </div>
      
      <button
        onClick={handleSavePet}
        disabled={loading}
        className="w-full py-2.5 text-blue-600 text-xs font-medium hover:text-blue-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Skip & Save Pet'}
      </button>
    </div>
  );

  const renderVaccinations = () => (
    <div className="space-y-3">
      <h2 className="font-bold text-gray-900 text-center mb-1">Vaccination Records</h2>
      <p className="text-xs text-gray-600 text-center mb-2">
        Optional: Track vaccination dates
      </p>

      {/* Rabies */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Rabies Vaccine Date
        </label>
        <input
          type="date"
          value={petData.vaccinations?.rabies || ''}
          onChange={(e) => setPetData({
            ...petData,
            vaccinations: { ...petData.vaccinations, rabies: e.target.value }
          })}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none text-sm"
          onFocus={(e) => {
            e.currentTarget.style.borderColor = WARM_ORANGE;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${WARM_ORANGE}33`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#E5E7EB';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Distemper */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Distemper Vaccine Date
        </label>
        <input
          type="date"
          value={petData.vaccinations?.distemper || ''}
          onChange={(e) => setPetData({
            ...petData,
            vaccinations: { ...petData.vaccinations, distemper: e.target.value }
          })}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none text-sm"
          onFocus={(e) => {
            e.currentTarget.style.borderColor = WARM_ORANGE;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${WARM_ORANGE}33`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#E5E7EB';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Parvovirus */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Parvovirus Vaccine Date
        </label>
        <input
          type="date"
          value={petData.vaccinations?.parvovirus || ''}
          onChange={(e) => setPetData({
            ...petData,
            vaccinations: { ...petData.vaccinations, parvovirus: e.target.value }
          })}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none text-sm"
          onFocus={(e) => {
            e.currentTarget.style.borderColor = WARM_ORANGE;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${WARM_ORANGE}33`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#E5E7EB';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Other Vaccinations */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Other Vaccinations
        </label>
        <textarea
          value={petData.vaccinations?.other || ''}
          onChange={(e) => setPetData({
            ...petData,
            vaccinations: { ...petData.vaccinations, other: e.target.value }
          })}
          placeholder="e.g., Bordetella - Jan 2024"
          rows={2}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none text-sm"
        />
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
        <p className="text-[10px] text-blue-900 text-center">
          💡 Keeping vaccination records helps vets provide better care!
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2.5 pt-3">
        <Button
          onClick={() => setCurrentStep('health')}
          variant="outline"
          className="flex-1 h-11 border-2 border-gray-300 rounded-xl text-sm"
          disabled={loading}
        >
          Back
        </Button>
        <Button
          onClick={handleSavePet}
          disabled={loading}
          className="flex-1 h-11 rounded-xl text-white text-sm"
          style={{ backgroundColor: WARM_ORANGE }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#FF7A2E';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = WARM_ORANGE;
          }}
        >
          {loading ? 'Saving...' : 'Save Pet'}
        </Button>
      </div>
    </div>
  );

  // Don't render anything if modal is not open
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 transition-opacity duration-300 z-50"
      onClick={onClose}
    >
      <div 
        className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl transform transition-transform duration-300 ease-out flex flex-col translate-y-0 max-w-[430px] mx-auto"
        style={{ 
          height: '95vh',
          maxHeight: '95vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Gradient */}
        <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF6B1A] p-4 pb-4 rounded-t-3xl flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <img src={logoImage} alt="WarmPawz" className="w-10 h-10 object-contain" />
            <button
              onClick={onClose}
              disabled={loading}
              className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm active:scale-95 transition-transform disabled:opacity-50"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <h3 className="font-bold text-white">Add New Pet 🐾</h3>
        </div>

        {/* Step Indicator */}
        <div className="px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            {['basic', 'health', 'vaccination'].map((step, index) => (
              <div key={step} className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all shadow-sm ${
                  currentStep === step
                    ? 'text-white scale-110'
                  }
                  style={{
                    backgroundColor: currentStep === step ? WARM_ORANGE : undefined
                    : step === 'basic' || (step === 'health' && (currentStep === 'health' || currentStep === 'vaccination')) || currentStep === 'vaccination'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {index + 1}
                </div>
                {index < 2 && (
                  <div className={`h-1 flex-1 mx-1.5 rounded-full transition-colors ${
                    (step === 'basic' && (currentStep === 'health' || currentStep === 'vaccination')) ||
                    (step === 'health' && currentStep === 'vaccination')
                      ? 'bg-green-500'
                      : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] font-medium text-gray-600">Basic Info</span>
            <span className="text-[10px] font-medium text-gray-600">Health</span>
            <span className="text-[10px] font-medium text-gray-600">Vaccines</span>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto" style={{ 
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: '#FF8C42 #f3f4f6'
        }}>
          <div className="p-4 pb-24">
            {currentStep === 'basic' && renderBasicInfo()}
            {currentStep === 'health' && renderHealthRecords()}
            {currentStep === 'vaccination' && renderVaccinations()}
          </div>
        </div>
      </div>
    </div>
  );
}